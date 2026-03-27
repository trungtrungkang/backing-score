/**
 * MP3 encoder using a local copy of lamejs (lame.all.js).
 *
 * Why a local copy?
 * The lamejs npm package's CJS entry point (src/js/index.js) uses internal
 * require('./MPEGMode.js') calls. Webpack's module concatenation (scope hoisting)
 * breaks these, causing "MPEGMode is not defined" at runtime.
 *
 * The bundled lame.all.js has zero internal require() calls — everything is
 * self-contained in a single function scope. We copied it to lamejs-bundle.js
 * and added module.exports at the end.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Mp3Encoder } = require("./lamejs-bundle.js");

export async function encodePcmToMp3(
  pcmChunks: Float32Array[],
  sampleRate: number,
): Promise<Blob> {
  // Merge all PCM chunks into a single buffer
  const totalLength = pcmChunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of pcmChunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert Float32 (-1..1) to Int16 (-32768..32767)
  const samples = new Int16Array(merged.length);
  for (let i = 0; i < merged.length; i++) {
    const s = Math.max(-1, Math.min(1, merged[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Encode to MP3 using lamejs (mono, 128kbps)
  const mp3Encoder = new Mp3Encoder(1, sampleRate, 128);
  const mp3Data: Uint8Array[] = [];
  const blockSize = 1152;

  for (let i = 0; i < samples.length; i += blockSize) {
    const chunk = samples.subarray(i, i + blockSize);
    const mp3buf = mp3Encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  const end = mp3Encoder.flush();
  if (end.length > 0) {
    mp3Data.push(new Uint8Array(end));
  }

  return new Blob(mp3Data as BlobPart[], { type: "audio/mpeg" });
}
