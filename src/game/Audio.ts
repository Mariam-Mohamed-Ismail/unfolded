import {
  SFX_ATTACK_MS,
  SFX_CRINKLE_BURSTS,
  SFX_CRINKLE_BURST_MS,
  SFX_CRINKLE_Q,
  SFX_CRINKLE_SPREAD_MS,
  SFX_DASH_FROM_HZ,
  SFX_DASH_GAIN,
  SFX_DASH_MS,
  SFX_DASH_Q,
  SFX_DASH_TO_HZ,
  SFX_FOLD_FROM_HZ,
  SFX_FOLD_GAIN,
  SFX_FOLD_TO_HZ,
  SFX_JUMP_FROM_HZ,
  SFX_JUMP_GAIN,
  SFX_JUMP_MS,
  SFX_JUMP_Q,
  SFX_JUMP_TO_HZ,
  SFX_LAND_FROM_HZ,
  SFX_LAND_GAIN,
  SFX_LAND_MS,
  SFX_LAND_Q,
  SFX_LAND_TO_HZ,
  SFX_RESPAWN_FROM_HZ,
  SFX_RESPAWN_GAIN,
  SFX_RESPAWN_MS,
  SFX_RESPAWN_Q,
  SFX_RESPAWN_TO_HZ,
  SFX_STEP_GAIN,
  SFX_STEP_HZ,
  SFX_STEP_MS,
  SFX_STEP_Q,
  SFX_UNFOLD_FROM_HZ,
  SFX_UNFOLD_GAIN,
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
  private played = 0

  /**
   * Open the context from a real gesture handler. Creating it from inside
   * the game loop usually works, because user activation is sticky, but a
   * gesture handler is the case browsers actually guarantee. Both listeners
   * are one-shot and wake() is idempotent.
   */
  constructor() {
    if (typeof window === 'undefined') return
    const unlock = () => this.wake()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
  }

  /** For the F1 overlay: what the audio is actually doing. */
  state(): { context: string; muted: boolean; played: number } {
    return {
      context: this.ctx ? this.ctx.state : 'not created',
      muted: this.muted,
      played: this.played,
    }
  }

  /** A 20ms tick under each running footfall. */
  footstep(): void {
    this.noiseHit(SFX_STEP_HZ, SFX_STEP_HZ, SFX_STEP_MS, SFX_STEP_Q, SFX_STEP_GAIN)
  }

  /** A rising whoosh. */
  jump(): void {
    this.noiseHit(SFX_JUMP_FROM_HZ, SFX_JUMP_TO_HZ, SFX_JUMP_MS, SFX_JUMP_Q, SFX_JUMP_GAIN)
  }

  /** A low thud. */
  land(): void {
    this.noiseHit(SFX_LAND_FROM_HZ, SFX_LAND_TO_HZ, SFX_LAND_MS, SFX_LAND_Q, SFX_LAND_GAIN)
  }

  /** A bandpass sweep up through the spectrum. */
  dash(): void {
    this.noiseHit(SFX_DASH_FROM_HZ, SFX_DASH_TO_HZ, SFX_DASH_MS, SFX_DASH_Q, SFX_DASH_GAIN)
  }

  fold(): void {
    this.crinkle(SFX_FOLD_FROM_HZ, SFX_FOLD_TO_HZ, SFX_FOLD_GAIN)
  }

  unfold(): void {
    this.crinkle(SFX_UNFOLD_FROM_HZ, SFX_UNFOLD_TO_HZ, SFX_UNFOLD_GAIN)
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
   * Paper does not make one sound, it makes a handful of tiny ones. Several
   * short bursts scattered across a few tens of milliseconds, each picking a
   * frequency somewhere in the band, reads as a crinkle where a single hit
   * reads as a tap.
   */
  private crinkle(fromHz: number, toHz: number, gain: number): void {
    for (let i = 0; i < SFX_CRINKLE_BURSTS; i++) {
      const at = (i / SFX_CRINKLE_BURSTS) * (SFX_CRINKLE_SPREAD_MS / 1000)
      const hz = fromHz + (toHz - fromHz) * Math.random()
      this.noiseHit(hz, hz * 0.85, SFX_CRINKLE_BURST_MS, SFX_CRINKLE_Q, gain, at)
    }
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

  /** `delay` schedules the burst that far ahead, which is how a crinkle is built. */
  private noiseHit(
    fromHz: number,
    toHz: number,
    ms: number,
    q: number,
    gain: number,
    delay = 0,
  ): void {
    const ctx = this.wake()
    if (!ctx || !this.master || !this.noise) return
    this.played++

    // A suspended context has a frozen currentTime, so everything scheduled
    // while it is waking would stack at the same instant. Nudge past it.
    const now = Math.max(ctx.currentTime, 0) + delay
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
}
