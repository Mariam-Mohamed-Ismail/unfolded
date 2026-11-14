import type * as Phaser from 'phaser'
import { rotAbout } from './geom.ts'
import type { Box, Fx } from './entities/Entity.ts'
import type { Level } from './Level.ts'
import type { Player } from './Player.ts'
import type { Point } from './geom.ts'
import {
  COLOR_FORM,
  COLOR_INK,
  FOLD_OUTLINE,
  KNOCKBACK,
  PARTICLES_HIT,
  SLASH_ACTIVE_MS,
  SLASH_ARC,
  SLASH_BOX_H,
  SLASH_BOX_W,
  SLASH_HITSTOP_MS,
  SLASH_RECOVER_MS,
  SLASH_SHAKE,
  SLASH_SHAKE_MS,
  SLASH_SPEED_SCALE,
  SLASH_WINDUP_MS,
  SWORD_LEN,
  SWORD_W,
  TRAIL_FADE_MS,
  TRAIL_TRIS,
} from './constants.ts'

const WINDUP = SLASH_WINDUP_MS / 1000
const ACTIVE = SLASH_ACTIVE_MS / 1000
const RECOVER = SLASH_RECOVER_MS / 1000
const SWING = WINDUP + ACTIVE + RECOVER
const FADE = TRAIL_FADE_MS / 1000

export type SlashPhase = 'idle' | 'windup' | 'active' | 'recovery'

type TrailTri = { tris: Point[][]; life: number }

/**
 * The swing.
 *
 * This lives outside the entity layer on purpose. The spec asks for two
 * things an entity cannot do — refuse to swing while flat or dashing, and
 * hold the player to 60% speed mid-swing — and EntityWorld is deliberately
 * a read-only view. So the scene owns this, and it is the one place that
 * sees the player, the input and the level at once.
 *
 * The pieces themselves stay with Pickup; this draws the blade and what it
 * leaves behind.
 */
export class Sword {
  private phase: SlashPhase = 'idle'
  /** Seconds since the swing started. */
  private clock = 0
  /** Which way the blade is sweeping, latched when the swing starts. */
  private dir = 1
  /** Ids already hit this swing, so one target takes one hit per swing. */
  private struck = new Set<string>()
  private trail: TrailTri[] = []

  /** What the player's top speed is scaled by right now. */
  speedScale(): number {
    return this.phase === 'active' ? SLASH_SPEED_SCALE : 1
  }

  current(): SlashPhase {
    return this.phase
  }

  /** How many trail triangles are still fading. */
  trailCount(): number {
    return this.trail.length
  }

  swinging(): boolean {
    return this.phase !== 'idle'
  }

  /** The live hit area, or null when nothing is out. */
  hitBox(player: Player): Box | null {
    if (this.phase !== 'active') return null
    return this.box(player)
  }

  /** How far through the swing, 0 to 1, for the blade's angle. */
  progress(): number {
    return Math.min(1, this.clock / SWING)
  }

  update(
    dt: number,
    player: Player,
    slashPressed: boolean,
    level: Level,
    fx: Fx,
  ): void {
    // Hit-stop holds the swing too, so a connecting hit does not eat the
    // frames the blade is meant to be live for.
    if (!player.frozen()) {
      this.advance(dt, player, level, fx)
      this.fadeTrail(dt)
    }

    if (!slashPressed || this.phase !== 'idle') return
    // The blade has to be out, and the spec forbids swinging while flat or
    // mid-dash. In the air is fine.
    if (!level.swordOut()) return
    if (player.flat || player.isDashing()) return

    this.phase = 'windup'
    this.clock = 0
    this.dir = player.facing
    this.struck.clear()
    fx.sound('swoosh')
  }

  reset(): void {
    this.phase = 'idle'
    this.clock = 0
    this.struck.clear()
    this.trail.length = 0
  }

  draw(g: Phaser.GameObjects.Graphics, player: Player, out: boolean): void {
    // The trail first, so the blade reads on top of it.
    for (const t of this.trail) {
      const a = Math.max(0, t.life / FADE)
      g.fillStyle(COLOR_FORM, a * 0.55)
      for (const tri of t.tris) {
        g.fillTriangle(tri[0][0], tri[0][1], tri[1][0], tri[1][1], tri[2][0], tri[2][1])
      }
    }

    if (!out) return
    const blade = this.bladeTri(player)
    g.fillStyle(COLOR_FORM, 1)
    g.fillTriangle(
      blade[0][0], blade[0][1],
      blade[1][0], blade[1][1],
      blade[2][0], blade[2][1],
    )
    g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
    g.strokeTriangle(
      blade[0][0], blade[0][1],
      blade[1][0], blade[1][1],
      blade[2][0], blade[2][1],
    )
  }

  /** Runs the phase clock and resolves hits during the active window. */
  private advance(dt: number, player: Player, level: Level, fx: Fx): void {
    if (this.phase === 'idle') return
    const was = this.phase
    this.clock += dt

    if (this.clock < WINDUP) this.phase = 'windup'
    else if (this.clock < WINDUP + ACTIVE) this.phase = 'active'
    else if (this.clock < SWING) this.phase = 'recovery'
    else {
      this.phase = 'idle'
      this.clock = 0
      return
    }

    if (this.phase === 'active') {
      // A triangle of trail per frame of the sweep.
      if (was !== 'active') this.trail.length = 0
      this.trail.push({ tris: this.trailTris(player), life: FADE })
      if (this.trail.length > TRAIL_TRIS) this.trail.shift()
      this.resolve(player, level, fx)
    }
  }

  private resolve(player: Player, level: Level, fx: Fx): void {
    const box = this.box(player)
    for (const target of level.hurtTargets()) {
      if (this.struck.has(target.id)) continue
      const hurt = target.hurtBox()
      if (!hurt || !overlaps(box, hurt)) continue
      this.struck.add(target.id)

      // Contact point: the middle of where the two boxes meet.
      const cx = (Math.max(box.left, hurt.left) + Math.min(box.right, hurt.right)) / 2
      const cy = (Math.max(box.top, hurt.top) + Math.min(box.bottom, hurt.bottom)) / 2

      const survived = target.hurt(this.dir)
      player.freezeFor(SLASH_HITSTOP_MS / 1000)
      fx.shake(SLASH_SHAKE, SLASH_SHAKE_MS)
      fx.dust(cx, cy, PARTICLES_HIT, COLOR_FORM)
      fx.sound('hit')
      // Only something still standing gets shoved.
      if (survived) target.knock(this.dir * KNOCKBACK)
    }
  }

  private fadeTrail(dt: number): void {
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt
      if (this.trail[i].life <= 0) this.trail.splice(i, 1)
    }
  }

  /** The hit area: in front of the player, facing-flipped. */
  private box(player: Player): Box {
    const front = player.x + (this.dir > 0 ? 0 : -SLASH_BOX_W)
    return {
      left: front,
      right: front + SLASH_BOX_W,
      top: player.y - SLASH_BOX_H / 2,
      bottom: player.y + SLASH_BOX_H / 2,
    }
  }

  /** Where the blade is pointing, given how far through the swing it is. */
  private bladeTri(player: Player): Point[] {
    const swept =
      this.phase === 'idle' ? 0 : -SLASH_ARC / 2 + SLASH_ARC * this.progress()
    const o: Point = [player.x, player.y]
    const reach = SWORD_LEN * this.dir
    const half = SWORD_W / 2
    return [
      [o[0] + reach, o[1]],
      [o[0], o[1] - half],
      [o[0], o[1] + half],
    ].map((pt) => rotAbout(pt as Point, swept * this.dir, o))
  }

  private trailTris(player: Player): Point[][] {
    return [this.bladeTri(player)]
  }
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}
