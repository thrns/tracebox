/** Minimal page interface needed for audio injection */
interface EvaluatablePageLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluate<T>(fn: (arg: any) => T | Promise<T>, arg?: any): Promise<T>
}

/**
 * Injects TTS audio into the browser page by swapping the outbound audio track
 * on all active RTCPeerConnection senders via `replaceTrack()`.
 *
 * Flow:
 *   1. Build an AudioBuffer from raw PCM data
 *   2. Route it through a MediaStreamDestination to get a MediaStreamTrack
 *   3. Replace the outbound mic track on all peer connections with the TTS track
 *   4. Wait for playback to finish
 *   5. Restore the original mic track
 *
 * Requires `setupAudioCapture()` to have been called before page.goto() so that
 * `__replaceOutboundAudioTrack` and `__originalMicTrack` are available on window.
 */
export async function injectAudio(page: EvaluatablePageLike, audioBuffer: Buffer): Promise<void> {
  const audioBase64 = audioBuffer.toString('base64')

  // Use new Function() with a string literal to prevent esbuild/tsx from injecting
  // __name() helpers into the serialized function body (causes ReferenceError in browser).
  const script = `
    async function inject(audioData) {
      var win = window;
      var replaceTrack = win.__replaceOutboundAudioTrack;
      var originalMicTrack = win.__originalMicTrack;

      var SAMPLE_RATE = 16000;
      var raw = atob(audioData);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      var int16 = new Int16Array(bytes.buffer);
      var numFrames = int16.length;

      var audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      var buf = audioContext.createBuffer(1, numFrames, SAMPLE_RATE);
      var channelData = buf.getChannelData(0);
      for (var j = 0; j < numFrames; j++) {
        channelData[j] = int16[j] / 32768.0;
      }

      var source = audioContext.createBufferSource();
      source.buffer = buf;

      var dest = audioContext.createMediaStreamDestination();
      source.connect(dest);

      // Feed TTS audio into the bot recording mixer (uses its own AudioContext).
      // We pipe via a MediaStream bridge to avoid cross-context connect() errors.
      var botDest = win.__botAudioDest;
      if (botDest) {
        try {
          var botCtx = botDest.context;
          var bridgeSource = botCtx.createMediaStreamSource(dest.stream);
          bridgeSource.connect(botDest);
        } catch (e) {
          // Non-fatal — recording just won't include bot audio this turn
        }
      }

      var ttsTrack = dest.stream.getAudioTracks()[0];

      if (replaceTrack && ttsTrack) {
        await replaceTrack(ttsTrack);
      }

      source.start();

      await new Promise(function(resolve) {
        source.onended = function() { resolve(); };
      });

      if (replaceTrack && originalMicTrack) {
        await replaceTrack(originalMicTrack);
      }
    }
    return inject(args);
  `

  await page.evaluate(
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    new Function('args', script) as (args: string) => Promise<void>,
    audioBase64
  )
}

/**
 * Saves audio buffer to a temp file and restarts the browser with it as fake mic input.
 * Fallback approach — simpler but requires browser restart per utterance.
 */
export async function saveTtsToFile(audioBuffer: Buffer, filePath: string): Promise<void> {
  const { writeFile } = await import('fs/promises')
  await writeFile(filePath, audioBuffer)
}
