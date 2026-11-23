/**
 * Generates assets/sounds/alarm.wav: an original, synthesized alarm tone.
 *
 * Pattern: three rising tones (a "step up" motif) then a short rest, repeated
 * for ~28 s. Android plays a notification sound once, so the long file plus a
 * follow-up notification every 30 s gives near-continuous ringing even when the
 * app isn't running.
 *
 * Run: node scripts/generate-alarm-sound.js
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const DURATION_S = 28;
const TONES = [740, 988, 1319]; // F#5, B5, E6
const TONE_MS = 140;
const GAP_MS = 45;
const REST_MS = 520;
const AMPLITUDE = 0.82;

const total = SAMPLE_RATE * DURATION_S;
const samples = new Float32Array(total);
const cycleMs = TONES.length * (TONE_MS + GAP_MS) + REST_MS;

for (let i = 0; i < total; i++) {
  const tMs = (i / SAMPLE_RATE) * 1000;
  const inCycle = tMs % cycleMs;
  const slot = Math.floor(inCycle / (TONE_MS + GAP_MS));
  if (slot >= TONES.length) continue;
  const inSlot = inCycle - slot * (TONE_MS + GAP_MS);
  if (inSlot > TONE_MS) continue;

  // Smooth 8 ms attack/release so there are no clicks.
  const edge = 8;
  const env = Math.min(1, inSlot / edge, (TONE_MS - inSlot) / edge);
  const f = TONES[slot];
  const t = i / SAMPLE_RATE;
  // Fundamental plus a little third harmonic: brighter, cuts through noise.
  const v = Math.sin(2 * Math.PI * f * t) * 0.8 + Math.sin(2 * Math.PI * f * 3 * t) * 0.2;
  samples[i] = v * env * AMPLITUDE;
}

const dataBytes = total * 2;
const buf = Buffer.alloc(44 + dataBytes);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + dataBytes, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); // PCM chunk size
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(SAMPLE_RATE, 24);
buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(dataBytes, 40);
for (let i = 0; i < total; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
}

const out = path.join(__dirname, '..', 'assets', 'sounds', 'alarm.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buf);
console.log(`Wrote ${out} (${(buf.length / 1024).toFixed(0)} KB, ${DURATION_S}s)`);
