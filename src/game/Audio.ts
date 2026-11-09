import {
  SFX_ATTACK_MS,
  SFX_DASH_FROM_HZ,
  SFX_DASH_GAIN,
  SFX_DASH_Q,
  SFX_DASH_MS,
  SFX_DASH_TO_HZ,
  SFX_FOLD_GAIN,
  SFX_FOLD_HZ,
  SFX_FOLD_MS,
  SFX_FOLD_Q,
  SFX_JUMP_GAIN,
  SFX_JUMP_HZ,
  SFX_JUMP_MS,
  SFX_JUMP_Q,
  SFX_JUMP_TONE_GAIN,
  SFX_JUMP_TONE_HZ,
  SFX_LAND_GAIN,
  SFX_LAND_HZ,
  SFX_LAND_MS,
  SFX_LAND_Q,
  SFX_RESPAWN_FROM_HZ,
  SFX_RESPAWN_GAIN,
  SFX_RESPAWN_MS,
  SFX_RESPAWN_Q,
  SFX_RESPAWN_TO_HZ,
  SFX_UNFOLD_FROM_HZ,
  SFX_UNFOLD_GAIN,
  SFX_UNFOLD_MS,
  SFX_UNFOLD_Q,
  SFX_UNFOLD_TO_HZ,
  SFX_VOLUME,
} from './constants.ts'

// An exponential ramp can never reach zero, so decays land here instead.
const SILENT = 0.0001
const ATTACK = SFX_ATTACK_MS / 1000

/**
 * Every sound is synthesised: a burst of white noise pushed through a
 * bandpass filter, which reads as paper rather than as a console. No audio
 * files, and no Phaser sound manager.
 */
export class Audio {
  muted = false

  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null

  jump(): void {
    // A puff of air plus a hint of pitch, so a jump has a note and a landing
    // does not.
    this.noiseHit(SFX_JUMP_HZ, SFX_JUMP_HZ, SFX_JUMP_MS, SFX_JUMP_Q, SFX_JUMP_GAIN)
    this.tone(
      SFX_JUMP_TONE_HZ,
      SFX_JUMP_TONE_HZ * 1.6,
      SFX_JUMP_MS,
      SFX_JUMP_TONE_GAIN,
    )
  }

  land(): void {
    this.noiseHit(SFX_LAND_HZ, SFX_LAND_HZ * 0.5, SFX_LAND_MS, SFX_LAND_Q, SFX_LAND_GAIN)
  }

  dash(): void {
    this.noiseHit(SFX_DASH_FROM_HZ, SFX_DASH_TO_HZ, SFX_DASH_MS, SFX_DASH_Q, SFX_DASH_GAIN)
  }

  fold(): void {
    this.noiseHit(SFX_FOLD_HZ, SFX_FOLD_HZ * 0.7, SFX_FOLD_MS, SFX_FOLD_Q, SFX_FOLD_GAIN)
  }

  unfold(): void {
    this.noiseHit(SFX_UNFOLD_FROM_HZ, SFX_UNFOLD_TO_HZ, SFX_UNFOLD_MS, SFX_UNFOLD_Q, SFX_UNFOLD_GAIN)
  }

  respawn(): void {
    this.noiseHit(
      SFX_RESPAWN_FROM_HZ,
      SFX_RESPAWN_TO_HZ,
      SFX_RESPAWN_MS,
      SFX_RESPAWN_Q,
      SFX_RESPAWN_GAIN,
    )
  }

  /** Returns the new state, so the caller can report it. */
  toggleMute(): boolean {
    this.muted = !this.muted
    const master = this.master
    if (master && this.ctx) {
      master.gain.setTargetAtTime(
        this.muted ? 0 : SFX_VOLUME,
        this.ctx.currentTime,
        0.01,
      )
    }
    return this.muted
  }

  /**
   * Built on first use, not at startup: browsers refuse to start an
   * AudioContext until the page has been interacted with, and every sound
   * here follows a key press.
   */
  private wake(): AudioContext | null {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : SFX_VOLUME
      this.master.connect(this.ctx.destination)

      // One second of white noise, generated once and replayed per hit.
      const rate = this.ctx.sampleRate
      this.noise = this.ctx.createBuffer(1, rate, rate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    // resume() rejects if the page has not been interacted with yet.
    // Swallow it: the next sound will try again, and an unhandled rejection
    // would be noise in the console.
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    return this.ctx
  }

  private noiseHit(
    fromHz: number,
    toHz: number,
    ms: number,
    q: number,
    gain: number,
  ): void {
    const ctx = this.wake()
    if (!ctx || !this.master || !this.noise) return

    const now = ctx.currentTime
    const dur = ms / 1000

    const src = ctx.createBufferSource()
    src.buffer = this.noise
    // Start somewhere random in the buffer so repeats do not sound identical.
    const offset = Math.random() * (this.noise.duration - dur)

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = q
    filter.frequency.setValueAtTime(fromHz, now)
    if (toHz !== fromHz) {
      filter.frequency.exponentialRampToValueAtTime(toHz, now + dur)
    }

    const env = ctx.createGain()
    // Open over ATTACK rather than starting at full, or the burst begins
    // with a click louder than the sound itself.
    env.gain.setValueAtTime(SILENT, now)
    env.gain.linearRampToValueAtTime(gain, now + Math.min(ATTACK, dur / 2))
    env.gain.exponentialRampToValueAtTime(SILENT, now + dur)

    src.connect(filter)
    filter.connect(env)
    env.connect(this.master)
    src.start(now, Math.max(0, offset), dur)
    src.stop(now + dur)
  }

  private tone(fromHz: number, toHz: number, ms: number, gain: number): void {
    const ctx = this.wake()
    if (!ctx || !this.master) return

    const now = ctx.currentTime
    const dur = ms / 1000

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(fromHz, now)
    osc.frequency.exponentialRampToValueAtTime(toHz, now + dur)

    const env = ctx.createGain()
    env.gain.setValueAtTime(SILENT, now)
    env.gain.linearRampToValueAtTime(gain, now + Math.min(ATTACK, dur / 2))
    env.gain.exponentialRampToValueAtTime(SILENT, now + dur)

    osc.connect(env)
    env.connect(this.master)
    osc.start(now)
    osc.stop(now + dur)
  }
}
