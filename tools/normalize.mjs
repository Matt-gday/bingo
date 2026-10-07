// Brings a sound effect up (or down) to an even, sensible level. ElevenLabs makes some sounds very quiet
// (a low thud especially), so every sound is scaled until its loudest moment sits at a fixed level.
// The game then sets how loud each sound plays with its "volume" in Data/sounds.json.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { MPEGDecoder } from 'mpg123-decoder';

// The MP3 encoder's normal entry point is broken under Node, so run its ready-made bundle in a
// small sandbox of its own and take the encoder from there.
const require = createRequire(import.meta.url);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${readFileSync(require.resolve('lamejs/lame.all.js'), 'utf8')}
;this.lamejs = lamejs;`, sandbox);
const lamejs = sandbox.lamejs;

export const TARGET_PEAK_DB = -3;
export const SILENT_BELOW_DB = -45; // a take quieter than this is treated as a failed take, not boosted

export async function analyseMp3(mp3) {
  const decoder = new MPEGDecoder();
  await decoder.ready;
  const { channelData, sampleRate } = decoder.decode(new Uint8Array(mp3));
  decoder.free();
  const samples = channelData[0];
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  return { samples, sampleRate, peak, peakDb: 20 * Math.log10(peak || 1e-9) };
}

function encodeMp3(samples, sampleRate, kbps = 64) {
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const part = encoder.encodeBuffer(pcm.subarray(i, i + 1152));
    if (part.length) chunks.push(Buffer.from(part));
  }
  const end = encoder.flush();
  if (end.length) chunks.push(Buffer.from(end));
  return Buffer.concat(chunks);
}

// Returns { buffer, beforeDb, afterDb, silent }. A silent take comes back unchanged with silent: true.
export async function normalizeMp3(mp3) {
  const { samples, sampleRate, peak, peakDb } = await analyseMp3(mp3);
  if (peakDb < SILENT_BELOW_DB) return { buffer: Buffer.from(mp3), beforeDb: peakDb, afterDb: peakDb, silent: true };
  const gain = 10 ** (TARGET_PEAK_DB / 20) / peak;
  const scaled = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) scaled[i] = samples[i] * gain;
  return { buffer: encodeMp3(scaled, sampleRate), beforeDb: peakDb, afterDb: TARGET_PEAK_DB, silent: false };
}
