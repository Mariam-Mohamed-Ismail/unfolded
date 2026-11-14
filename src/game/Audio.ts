import {
  FAN_HUM_GAIN,
  FAN_HUM_HZ,
  FAN_HUM_Q,
  SFX_ATTACK_MS,
  SFX_HIT_FROM_HZ,
  SFX_HIT_GAIN,
  SFX_HIT_MS,
  SFX_HIT_Q,
  SFX_HIT_TO_HZ,
  SFX_SWOOSH_FROM_HZ,
  SFX_SWOOSH_GAIN,
  SFX_SWOOSH_MS,
  SFX_SWOOSH_Q,
  SFX_SWOOSH_TO_HZ,
  SFX_TEAR_FROM_HZ,
  SFX_TEAR_GAIN,
  SFX_TEAR_MS,
  SFX_TEAR_Q,
  SFX_TEAR_TO_HZ,
  SFX_PICKUP_GAIN,
  SFX_PICKUP_NOTES,
  SFX_PICKUP_NOTE_MS,
  SFX_PICKUP_STEP_MS,
  SFX_WHOOSH_FROM_HZ,
  SFX_WHOOSH_GAIN,
  SFX_WHOOSH_MS,
  SFX_WHOOSH_Q,
  SFX_WHOOSH_TO_HZ,
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
  SFX_STING_GAIN,
  SFX_STING_NOTES,
  SFX_STING_NOTE_MS,
  SFX_STING_STEP_MS,
  SFX_THUD_FROM_HZ,
  SFX_THUD_GAIN,
  SFX_THUD_MS,
  SFX_THUD_TO_HZ,
  SFX_UNFOLD_FROM_HZ,
  SFX_UNFOLD_GAIN,
  SFX_UNFOLD_TO_HZ,
  SFX_VOLUME,
} from './constants.ts'

// An exponential ramp can never reach zero, so decays land here instead.
const SILENT = 0.0001
const ATTACK = SFX_ATTACK_MS / 1000
// How quickly a hum slides to a new level. Short enough to track walking
// toward a fan, long enough not to step.
const HUM_GLIDE = 0.08

type Hum = { gain: GainNode; asked: boolean }

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
  private hums = new Map<string, Hum>()

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

  /** The swing: the spec's descending sweep. */
  swoosh(): void {
    this.noiseHit(
      SFX_SWOOSH_FROM_HZ,
      SFX_SWOOSH_TO_HZ,
      SFX_SWOOSH_MS,
      SFX_SWOOSH_Q,
      SFX_SWOOSH_GAIN,
    )
  }

  /** Cutting a seal: paper tearing, pitch falling away. */
  tear(): void {
    this.noiseHit(
      SFX_TEAR_FROM_HZ,
      SFX_TEAR_TO_HZ,
      SFX_TEAR_MS,
      SFX_TEAR_Q,
      SFX_TEAR_GAIN,
    )
  }

  /** Connecting: a short low crunch. */
  hit(): void {
    this.noiseHit(
      SFX_HIT_FROM_HZ,
      SFX_HIT_TO_HZ,
      SFX_HIT_MS,
      SFX_HIT_Q,
      SFX_HIT_GAIN,
    )
  }

  /** The sword folding: a bright sweep upward. */
  whoosh(): void {
    this.noiseHit(
      SFX_WHOOSH_FROM_HZ,
      SFX_WHOOSH_TO_HZ,
      SFX_WHOOSH_MS,
      SFX_WHOOSH_Q,
      SFX_WHOOSH_GAIN,
    )
  }

  /**
   * The pickup: the spec's three-note arpeggio. The only voice here that is
   * a tone rather than filtered noise, so it is the only one with an
   * oscillator — and the only one whose gain is arithmetic, because a
   * triangle wave's level is exactly its peak over root three.
   */
  arpeggio(): void {
    const ctx = this.wake()
    if (!ctx || !this.master) return
    this.played++

    const dur = SFX_PICKUP_NOTE_MS / 1000
    for (let i = 0; i < SFX_PICKUP_NOTES.length; i++) {
      const at = ctx.currentTime + (i * SFX_PICKUP_STEP_MS) / 1000
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(SFX_PICKUP_NOTES[i], at)

      const env = ctx.createGain()
      env.gain.setValueAtTime(SILENT, at)
      env.gain.linearRampToValueAtTime(SFX_PICKUP_GAIN, at + Math.min(ATTACK, dur / 2))
      env.gain.exponentialRampToValueAtTime(SILENT, at + dur)

      osc.connect(env)
      env.connect(this.master)
      osc.start(at)
      osc.stop(at + dur)
    }
  }

  /**
   * The bat's telegraph: two sine notes, 880 then 660. Short and bare on
   * purpose — it has to be recognisable through whatever else is playing,
   * because it is the half-second of warning the player gets.
   */
  sting(): void {
    const ctx = this.wake()
    if (!ctx || !this.master) return
    this.played++

    const dur = SFX_STING_NOTE_MS / 1000
    for (let i = 0; i < SFX_STING_NOTES.length; i++) {
      const at = ctx.currentTime + (i * SFX_STING_STEP_MS) / 1000
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(SFX_STING_NOTES[i], at)

      const env = ctx.createGain()
      env.gain.setValueAtTime(SILENT, at)
      env.gain.linearRampToValueAtTime(SFX_STING_GAIN, at + Math.min(ATTACK, dur / 2))
      env.gain.exponentialRampToValueAtTime(SILENT, at + dur)

      osc.connect(env)
      env.connect(this.master)
      osc.start(at)
      osc.stop(at + dur)
    }
  }

  /**
   * Taking a hit: a low thud whose pitch drops away. The second voice here
   * that is a tone rather than filtered noise, because a thud is pitched —
   * noise through a low bandpass reads as a rumble, not an impact.
   */
  thud(): void {
    const ctx = this.wake()
    if (!ctx || !this.master) return
    this.played++

    const at = ctx.currentTime
    const dur = SFX_THUD_MS / 1000

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(SFX_THUD_FROM_HZ, at)
    // Exponential, so the drop is heard as pitch rather than as a slide.
    osc.frequency.exponentialRampToValueAtTime(SFX_THUD_TO_HZ, at + dur)

    const env = ctx.createGain()
    env.gain.setValueAtTime(SILENT, at)
    env.gain.linearRampToValueAtTime(SFX_THUD_GAIN, at + Math.min(ATTACK, dur / 2))
    env.gain.exponentialRampToValueAtTime(SILENT, at + dur)

    osc.connect(env)
    env.connect(this.master)
    osc.start(at)
    osc.stop(at + dur)
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

  /**
   * A continuous low loop at `level` (0 to 1), for a fan. Unlike every other
   * voice here this one never stops: it is built once and then its gain is
   * slid about, which is what "volume follows distance" needs. It runs into
   * the master gain, so M mutes it with everything else.
   */
  hum(id: string, level: number): void {
    const ctx = this.wake()
    if (!ctx || !this.master || !this.noise) return

    let hum = this.hums.get(id)
    if (!hum) {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      src.loop = true

      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = FAN_HUM_HZ
      filter.Q.value = FAN_HUM_Q

      const gain = ctx.createGain()
      gain.gain.value = 0

      src.connect(filter)
      filter.connect(gain)
      gain.connect(this.master)
      src.start()
      hum = { gain, asked: true }
      this.hums.set(id, hum)
    }

    hum.asked = true
    const want = Math.max(0, Math.min(1, level)) * FAN_HUM_GAIN
    hum.gain.gain.setTargetAtTime(want, ctx.currentTime, HUM_GLIDE)
  }

  /**
   * Fade out any hum nothing asked for this frame. Entities outside the
   * current room stop updating, so without this a fan would keep humming
   * at whatever level it was at when you left the room.
   */
  humSweep(): void {
    if (!this.ctx) return
    for (const hum of this.hums.values()) {
      if (!hum.asked) hum.gain.gain.setTargetAtTime(0, this.ctx.currentTime, HUM_GLIDE)
      hum.asked = false
    }
  }

  /**
   * Freeze or unfreeze the whole graph, for the pause overlay.
   *
   * Suspending stops the fan's loop, any decaying tail, and currentTime
   * itself, so a resume continues at exactly the level it left off with and
   * there is no bookkeeping to get wrong. Note that every voice calls
   * wake(), which resumes a suspended context — so anything that plays a
   * sound while paused would unfreeze it.
   */
  setPaused(paused: boolean): void {
    const ctx = this.ctx
    if (!ctx) return
    if (paused) ctx.suspend().catch(() => {})
    else ctx.resume().catch(() => {})
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
