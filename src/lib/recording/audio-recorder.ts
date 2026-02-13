import fs from 'fs'
import path from 'path'

/** Minimal page interface needed for in-browser evaluate calls */
interface EvaluatablePageLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluate<T>(fn: (...args: any[]) => T | Promise<T>): Promise<T>
}

/**
 * Sets up in-browser audio recording that captures ALL audio (bot TTS + system responses).
 * Must be called after page loads.
 */
export async function startAudioRecording(page: EvaluatablePageLike): Promise<void> {
  // Use new Function() to prevent esbuild/tsx from injecting __name() helpers
  // into the serialized function body (causes ReferenceError in page context).
  const script = `
    function startRecording() {
      window.__audioRecorder = null;
      window.__audioChunks = [];

      var audioContext = new AudioContext();
      var dest = audioContext.createMediaStreamDestination();

      var remoteStream = window.__remoteAudioStream;
      if (remoteStream) {
        var remoteSource = audioContext.createMediaStreamSource(remoteStream);
        remoteSource.connect(dest);
      }

      var botStream = window.__botAudioStream;
      if (botStream) {
        var botSource = audioContext.createMediaStreamSource(botStream);
        botSource.connect(dest);
      }

      var recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
      var chunks = [];

      recorder.ondataavailable = function(e) { chunks.push(e.data); };
      window.__audioRecorder = recorder;
      window.__audioChunks = chunks;

      recorder.start(1000);
    }
    startRecording();
  `
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  await page.evaluate(new Function(script) as () => void)
}

export async function stopAudioRecording(page: EvaluatablePageLike): Promise<Buffer> {
  const script = `
    function stopRecording() {
      return new Promise(function(resolve) {
        var recorder = window.__audioRecorder;
        var chunks = window.__audioChunks || [];

        if (!recorder) { resolve(''); return; }

        recorder.onstop = async function() {
          var blob = new Blob(chunks, { type: 'audio/webm' });
          var buffer = await blob.arrayBuffer();
          var bytes = new Uint8Array(buffer);
          var base64 = btoa(Array.from(bytes, function(b) { return String.fromCharCode(b); }).join(''));
          resolve(base64);
        };

        recorder.stop();
      });
    }
    return stopRecording();
  `
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const audioBase64 = await page.evaluate(new Function(script) as () => Promise<string>)

  if (!audioBase64) return Buffer.alloc(0)
  return Buffer.from(audioBase64, 'base64')
}

export async function saveAudioBuffer(
  audioBuffer: Buffer,
  outputDir: string,
  botId: string
): Promise<string> {
  const filePath = path.join(outputDir, `${botId}-audio.webm`)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  fs.writeFileSync(filePath, audioBuffer)
  return filePath
}
