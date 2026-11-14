// Solves the makeup gain for a noise voice.
//
//   node --experimental-strip-types --import ./tests/hook.mjs tests/calibrate.mjs
//
// A bandpass throws most of a noise burst's energy away, so every noise
// voice carries a makeup gain. Guessing these has been wrong by 4 to 12 dB
// every time it has been tried, hence this.
import * as C from '../src/game/constants.ts'

const M = globalThis.Math
const FS = 48000
const TARGET_DB = -26
const CEILING_DB = -3

function bandpass(f0, Q) {
  const w0 = (2 * M.PI * f0) / FS
  const alpha = M.sin(w0) / (2 * Q)
  const a0 = 1 + alpha
  return {
    b0: alpha / a0,
    b2: -alpha / a0,
    a1: (-2 * M.cos(w0)) / a0,
    a2: (1 - alpha) / a0,
  }
}

/** One burst at gain 1 and master 1, so the result scales linearly. */
function render(fromHz, toHz, ms, Q, seed) {
  const n = M.round((ms / 1000) * FS)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, sum = 0, peak = 0
  let s = seed >>> 0
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return (s / 2 ** 32) * 2 - 1
  }
  const atk = M.min(C.SFX_ATTACK_MS / 1000, ms / 2000)
  for (let i = 0; i < n; i++) {
    const t = i / n
    const sec = i / FS
    const f = fromHz * M.pow(toHz / fromHz, t)
    const c = bandpass(f, Q)
    const x = rnd()
    const y = c.b0 * x + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
    x2 = x1; x1 = x; y2 = y1; y1 = y
    const env =
      sec < atk ? sec / atk : M.pow(0.0001, (sec - atk) / (ms / 1000 - atk))
    const v = y * env
    sum += v * v
    peak = M.max(peak, M.abs(v))
  }
  return { rms: M.sqrt(sum / n), peak }
}

const db = (v) => 20 * M.log10(v)

/**
 * One oscillator sweeping in pitch, at gain 1 and master 1.
 *
 * Tones get their own renderer because the paper arithmetic for a triangle
 * wave (peak over root three) ignores the decay envelope, and that is how
 * the arpeggio's gain came out 12dB low the first time.
 */
function renderTone(fromHz, toHz, ms, shape) {
  const n = M.round((ms / 1000) * FS)
  const dur = ms / 1000
  const atk = M.min(C.SFX_ATTACK_MS / 1000, dur / 2)
  let phase = 0
  let sum = 0
  let peak = 0
  for (let i = 0; i < n; i++) {
    const sec = i / FS
    // Web Audio's exponentialRampToValueAtTime, which is what the voice uses.
    const f = fromHz * M.pow(toHz / fromHz, sec / dur)
    phase += (2 * M.PI * f) / FS
    const raw =
      shape === 'triangle'
        ? (2 / M.PI) * M.asin(M.sin(phase))
        : M.sin(phase)
    const env =
      sec < atk ? sec / atk : M.pow(0.0001, (sec - atk) / (dur - atk))
    const v = raw * env
    sum += v * v
    peak = M.max(peak, M.abs(v))
  }
  return { rms: M.sqrt(sum / n), peak }
}

/** The voices whose gains are solved rather than chosen. */
const VOICES = [
  ['STEP', C.SFX_STEP_HZ, C.SFX_STEP_HZ, C.SFX_STEP_MS, C.SFX_STEP_Q, -34, C.SFX_STEP_GAIN],
  ['JUMP', C.SFX_JUMP_FROM_HZ, C.SFX_JUMP_TO_HZ, C.SFX_JUMP_MS, C.SFX_JUMP_Q, -26, C.SFX_JUMP_GAIN],
  ['LAND', C.SFX_LAND_FROM_HZ, C.SFX_LAND_TO_HZ, C.SFX_LAND_MS, C.SFX_LAND_Q, -26, C.SFX_LAND_GAIN],
  ['DASH', C.SFX_DASH_FROM_HZ, C.SFX_DASH_TO_HZ, C.SFX_DASH_MS, C.SFX_DASH_Q, -26, C.SFX_DASH_GAIN],
  ['WHOOSH', C.SFX_WHOOSH_FROM_HZ, C.SFX_WHOOSH_TO_HZ, C.SFX_WHOOSH_MS, C.SFX_WHOOSH_Q, -26, C.SFX_WHOOSH_GAIN],
  ['SWOOSH', C.SFX_SWOOSH_FROM_HZ, C.SFX_SWOOSH_TO_HZ, C.SFX_SWOOSH_MS, C.SFX_SWOOSH_Q, -26, C.SFX_SWOOSH_GAIN],
  ['HIT', C.SFX_HIT_FROM_HZ, C.SFX_HIT_TO_HZ, C.SFX_HIT_MS, C.SFX_HIT_Q, -26, C.SFX_HIT_GAIN],
  ['TEAR', C.SFX_TEAR_FROM_HZ, C.SFX_TEAR_TO_HZ, C.SFX_TEAR_MS, C.SFX_TEAR_Q, -26, C.SFX_TEAR_GAIN],
]

console.log(`At SFX_VOLUME ${C.SFX_VOLUME}, target ${TARGET_DB} dBFS, ceiling ${CEILING_DB}\n`)
console.log('  voice    solved   current   rms dBFS   peak dBFS')

for (const [name, a, b, ms, q, targetDb, current] of VOICES) {
  const u = render(a, b, ms, q, 20250101)
  const want = M.pow(10, targetDb / 20)
  let gain = want / (u.rms * C.SFX_VOLUME)

  // Hold the ceiling against the worst peak over many seeds: noise peaks
  // vary, and one seed underestimates them.
  let worst = 0
  for (let k = 0; k < 160; k++) {
    worst = M.max(worst, render(a, b, ms, q, 7919 * k + 13).peak)
  }
  const ceiling = M.pow(10, CEILING_DB / 20)
  const peakAt = worst * gain * C.SFX_VOLUME
  if (peakAt > ceiling) gain *= ceiling / peakAt
  gain = Number(gain.toFixed(2))

  const rms = db(u.rms * gain * C.SFX_VOLUME)
  const peak = db(worst * gain * C.SFX_VOLUME)
  const flag = M.abs(gain - current) / current > 0.1 ? '  <-- differs' : ''
  console.log(
    `  ${name.padEnd(8)} ${String(gain).padStart(6)}   ${String(current).padStart(7)}   ${rms.toFixed(1).padStart(8)}   ${peak.toFixed(1).padStart(9)}${flag}`,
  )
}

/** The tone voices, solved the same way. */
const TONES = [
  ['THUD', C.SFX_THUD_FROM_HZ, C.SFX_THUD_TO_HZ, C.SFX_THUD_MS, 'triangle', -26, C.SFX_THUD_GAIN],
]

for (const [name, a, b, ms, shape, targetDb, current] of TONES) {
  const u = renderTone(a, b, ms, shape)
  const want = M.pow(10, targetDb / 20)
  let gain = want / (u.rms * C.SFX_VOLUME)
  const ceiling = M.pow(10, CEILING_DB / 20)
  const peakAt = u.peak * gain * C.SFX_VOLUME
  if (peakAt > ceiling) gain *= ceiling / peakAt
  gain = Number(gain.toFixed(2))

  const rms = db(u.rms * gain * C.SFX_VOLUME)
  const peak = db(u.peak * gain * C.SFX_VOLUME)
  const flag = M.abs(gain - current) / current > 0.1 ? '  <-- differs' : ''
  console.log(
    `  ${name.padEnd(8)} ${String(gain).padStart(6)}   ${String(current).padStart(7)}   ${rms.toFixed(1).padStart(8)}   ${peak.toFixed(1).padStart(9)}${flag}`,
  )
}
