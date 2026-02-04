/** Minimal page interface needed for audio capture setup */
interface PageLike {
  addInitScript(script: string | (() => void)): Promise<void>
}

/**
 * Sets up WebRTC audio capture AND outbound mic hooking BEFORE the page loads.
 * Hooks RTCPeerConnection to capture remote audio tracks and stores all peer
 * connections so that outbound audio senders can be swapped dynamically via
 * `replaceTrack()` when TTS audio needs to be injected.
 *
 * Also intercepts `getUserMedia` to capture the original mic track reference,
 * enabling restore after TTS playback completes.
 *
 * Must be called before page.goto().
 */
export async function setupAudioCapture(page: PageLike): Promise<void> {
  await page.addInitScript(() => {
    const win = window as unknown as Record<string, unknown>
    const peerConnections: RTCPeerConnection[] = []
    win['__peerConnections'] = peerConnections
    win['__originalMicTrack'] = null
    win['__remoteAudioTrack'] = null
    win['__remoteAudioStream'] = null

    // Shared mixer node for recording the bot's own TTS audio.
    // The audio-injector connects its AudioBufferSourceNode here during playback,
    // and audio-recorder mixes this stream alongside the remote tutor stream.
    try {
      const botCtx = new AudioContext()
      const botDest = botCtx.createMediaStreamDestination()
      win['__botAudioDest'] = botDest
      win['__botAudioStream'] = botDest.stream
    } catch {
      win['__botAudioDest'] = null
      win['__botAudioStream'] = null
    }

    // -------------------------------------------------------------------------
    // Polyfill navigator.mediaDevices if it is missing or incomplete.
    // In headless Chrome, navigator.mediaDevices can be undefined when the page
    // is served over HTTP (non-secure context) or when no media devices are
    // enumerated. Next.js apps that access mediaDevices during SSR hydration
    // will throw a client-side exception if this is undefined.
    // -------------------------------------------------------------------------
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        writable: true,
        configurable: true,
      })
    }
    if (!navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices = async () => []
    }
    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = async () => new MediaStream()
    }

    // -------------------------------------------------------------------------
    // Stub WebGL context so pages using Three.js / WebGL avatars don't crash.
    //
    // Headless Chrome on Mac and Linux (without a GPU) returns null for
    // canvas.getContext('webgl'), causing "Cannot set properties of null"
    // errors that crash Next.js hydration. We intercept getContext() and
    // return a minimal no-op stub so the page initialises without errors.
    // The avatar simply won't render visually — which is fine for a bot.
    // -------------------------------------------------------------------------
    const _origGetContext = HTMLCanvasElement.prototype.getContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(HTMLCanvasElement.prototype as any).getContext = function(type: string, ...args: unknown[]) {
      const ctx = _origGetContext.call(this, type, ...args)
      if (ctx !== null) return ctx
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        const noop = () => {}
        return new Proxy({}, {
          get(_t, prop) {
            if (prop === 'canvas') return this
            if (prop === 'drawingBufferWidth' || prop === 'drawingBufferHeight') return 0
            return noop
          },
          set() { return true },
        })
      }
      return null
    }

    // -------------------------------------------------------------------------
    // Hook RTCPeerConnection via Proxy so instanceof, static properties, and
    // the prototype chain all remain intact. Plain function replacement breaks
    // WebRTC frameworks (LiveKit, Agora, Daily, etc.) that inspect the constructor.
    // -------------------------------------------------------------------------
    if (window.RTCPeerConnection) {
      const OriginalRTC = window.RTCPeerConnection
      window.RTCPeerConnection = new Proxy(OriginalRTC, {
        construct(target, args, newTarget) {
          const pc = Reflect.construct(target, args, newTarget)
          peerConnections.push(pc)
          pc.addEventListener('track', (event: RTCTrackEvent) => {
            if (event.track.kind === 'audio') {
              win['__remoteAudioTrack'] = event.track
              win['__remoteAudioStream'] = new MediaStream([event.track])
            }
          })
          return pc
        },
      })
    }

    // -------------------------------------------------------------------------
    // Hook getUserMedia to capture the original mic track reference so we can
    // restore it after TTS audio injection. Wraps the existing implementation
    // (real or polyfilled above) without breaking error behavior.
    // -------------------------------------------------------------------------
    const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async function (constraints) {
      const stream = await origGUM(constraints)
      try {
        if (constraints?.audio) {
          const audioTrack = stream.getAudioTracks()[0]
          if (audioTrack) win['__originalMicTrack'] = audioTrack
        }
      } catch {
        // Never let our hook break the caller
      }
      return stream
    }

    win['__replaceOutboundAudioTrack'] = async (newTrack: MediaStreamTrack): Promise<number> => {
      let replaced = 0
      for (const pc of peerConnections) {
        if (pc.connectionState === 'closed') continue
        for (const sender of pc.getSenders()) {
          if (sender.track?.kind === 'audio') {
            try {
              await sender.replaceTrack(newTrack)
              replaced++
            } catch {
              // sender may have been removed
            }
          }
        }
      }
      return replaced
    }
  })
}

/** Minimal page interface needed for audio capture and evaluate */
interface EvaluatablePageLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluate<T>(fn: (arg: any) => T | Promise<T>, arg?: any): Promise<T>
}

/**
 * Captures audio from the remote WebRTC stream using VAD (silence detection).
 * Returns a Buffer of the captured audio in webm format.
 */
export async function captureSystemAudio(
  page: EvaluatablePageLike,
  options: {
    silenceThreshold?: number
    silenceDurationMs?: number
    maxDurationMs?: number
  } = {}
): Promise<Buffer> {
  const {
    silenceThreshold = 0.01,
    silenceDurationMs = 1500,
    maxDurationMs = 30000,
  } = options

  // Pass the browser-side function as a string to prevent esbuild/tsx from
  // injecting __name() helpers (used for named functions) into the serialized
  // function body. Those helpers only exist in the Node.js module scope and
  // cause "ReferenceError: __name is not defined" inside page.evaluate().
  const captureScript = `
    async function captureAudio({ silenceThreshold, silenceDurationMs, maxDurationMs }) {
      // Wait up to 15s for WebRTC to establish and populate __remoteAudioStream
      var stream = window.__remoteAudioStream;
      if (!stream) {
        var waited = 0;
        while (!stream && waited < 15000) {
          await new Promise(function(r) { setTimeout(r, 500); });
          waited += 500;
          stream = window.__remoteAudioStream;
        }
      }
      if (!stream) return '';

      return new Promise(function(resolve) {
        var recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        var chunks = [];

        recorder.ondataavailable = function(e) { chunks.push(e.data); };
        recorder.onstop = async function() {
          var blob = new Blob(chunks, { type: 'audio/webm' });
          var buffer = await blob.arrayBuffer();
          var bytes = new Uint8Array(buffer);
          var base64 = btoa(Array.from(bytes, function(b) { return String.fromCharCode(b); }).join(''));
          resolve(base64);
        };

        recorder.start();

        var audioContext = new AudioContext();
        var source = audioContext.createMediaStreamSource(stream);
        var analyser = audioContext.createAnalyser();
        source.connect(analyser);

        var silenceStart = Date.now();
        var hasSpeechStarted = false;
        var startTime = Date.now();

        function checkSilence() {
          if (Date.now() - startTime > maxDurationMs) {
            recorder.stop();
            return;
          }
          var data = new Float32Array(analyser.frequencyBinCount);
          analyser.getFloatTimeDomainData(data);
          var rms = Math.sqrt(data.reduce(function(sum, x) { return sum + x * x; }, 0) / data.length);
          if (rms >= silenceThreshold) {
            hasSpeechStarted = true;
            silenceStart = Date.now();
          } else if (hasSpeechStarted && Date.now() - silenceStart > silenceDurationMs) {
            recorder.stop();
            return;
          }
          setTimeout(checkSilence, 50);
        }

        checkSilence();
      });
    }
    return captureAudio(args);
  `

  const audioBase64 = await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    new Function('args', captureScript) as (args: { silenceThreshold: number; silenceDurationMs: number; maxDurationMs: number }) => Promise<string>,
    { silenceThreshold, silenceDurationMs, maxDurationMs }
  )

  if (!audioBase64) return Buffer.alloc(0)
  return Buffer.from(audioBase64, 'base64')
}
