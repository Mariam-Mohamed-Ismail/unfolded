import {
  HEALTH_MAX,
  HEALTH_PIP_FADE_S,
  HURT_BLINK_HZ,
  HURT_INVULN_MS,
} from './constants.ts'

/**
 * The player's three hits, and the two clocks a hit starts: the
 * invulnerability window and the fade of the pip that was just lost.
 *
 * No Phaser and no knowledge of the player — it is only the counting. What a
 * hit does to the figure is Player's business, and what it looks like is the
 * Hud's and the Camera's. That keeps the rule that matters ("you cannot be
 * hit twice inside a second") in one readable place.
 */
export class Health {
  hits = HEALTH_MAX

  /** Seconds of invulnerability left. */
  private invuln = 0
  /** Counts up while invulnerable, so the blink is a function of time. */
  private clock = 0
  /**
   * Seconds since each pip was lost, or null while it is still full. Indexed
   * so that pip 0 is the leftmost — the last one you lose.
   */
  private lost: (number | null)[] = []

  constructor() {
    this.refill()
  }

  /**
   * Take one hit. False means nothing happened — already dead, or still
   * inside the invulnerability window — and the caller should not play any
   * of the feedback.
   */
  take(): boolean {
    if (this.hits <= 0) return false
    if (this.invuln > 0) return false
    this.hits--
    this.lost[this.hits] = 0
    this.invuln = HURT_INVULN_MS / 1000
    this.clock = 0
    return true
  }

  refill(): void {
    this.hits = HEALTH_MAX
    this.invuln = 0
    this.clock = 0
    this.lost = []
    for (let i = 0; i < HEALTH_MAX; i++) this.lost.push(null)
  }

  update(dt: number): void {
    if (this.invuln > 0) {
      this.invuln = Math.max(0, this.invuln - dt)
      this.clock += dt
    }
    for (let i = 0; i < this.lost.length; i++) {
      const age = this.lost[i]
      if (age !== null && age < HEALTH_PIP_FADE_S) {
        this.lost[i] = Math.min(HEALTH_PIP_FADE_S, age + dt)
      }
    }
  }

  invulnerable(): boolean {
    return this.invuln > 0
  }

  /** Seconds of invulnerability left, for anything that wants to show it. */
  shield(): number {
    return this.invuln
  }

  /** The blink's on half. False while not invulnerable, so the figure is solid. */
  blinkOn(): boolean {
    if (this.invuln <= 0) return false
    return Math.floor(this.clock * HURT_BLINK_HZ * 2) % 2 === 1
  }

  dead(): boolean {
    return this.hits <= 0
  }

  /**
   * How long ago pip `i` was lost, or null if the player still has it. The
   * Hud draws a full triangle, a cracking one, or an empty slot from this.
   */
  pipAge(i: number): number | null {
    return this.lost[i] ?? null
  }
}
