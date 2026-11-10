import * as Phaser from 'phaser'
import type { Player } from './Player.ts'
import type { Point } from './geom.ts'
import { rotAbout } from './geom.ts'
import {
  AFTERIMAGE_ALPHA,
  AFTERIMAGE_EVERY_MS,
  AFTERIMAGE_FADE_MS,
  COLOR_PLAYER,
  COLOR_PLAYER_LINE,
  DASH_STRETCH_X,
  DASH_STRETCH_Y,
  FALL_LEG_TRAIL_DEG,
  FALL_STRETCH_X,
  FALL_STRETCH_Y,
  IDLE_BOB_PX,
  IDLE_BREATH,
  IDLE_BREATH_HZ,
  JUMP_STRETCH_X,
  JUMP_STRETCH_Y,
  PLAYER_FLAT_H,
  PLAYER_FLAT_W,
  PLAYER_H,
  PLAYER_OUTLINE,
  PLAYER_W,
  RUN_ARM_SWING_DEG,
  RUN_CYCLE_PX,
  RUN_LEAN_DEG,
  RUN_SWING_DEG,
  SCALE_LERP,
  SHRUG_DEG,
  SHRUG_EVERY_MS,
  SHRUG_MS,
  SQUASH_RECOVER,
} from './constants.ts'

const RECOVER = SQUASH_RECOVER / 1000
const TRAIL_EVERY = AFTERIMAGE_EVERY_MS / 1000
const TRAIL_FADE = AFTERIMAGE_FADE_MS / 1000
const SHRUG = SHRUG_MS / 1000
const RAD = Math.PI / 180

type Tri = [Point, Point, Point]

/**
 * Which joint a piece hangs off. The chain is hip to upper body to arms,
 * and hip to upper leg to lower leg, so a lean at the hip carries the head
 * with it while the legs stay planted.
 */
type Limb = 'upper' | 'armL' | 'armR' | 'legUL' | 'legUR' | 'legLL' | 'legLR'

type Piece = { tri: Tri; limb: Limb }

// Body-local coordinates: x across the body, y measured up from the feet at
// 0. Drawing from the feet is what keeps a squashed figure planted.
const HIP: Point = [0, -11]
const SHOULDER_L: Point = [-6, -19]
const SHOULDER_R: Point = [6, -19]
const KNEE_L: Point = [-4, -6]
const KNEE_R: Point = [4, -6]

const PIECES: Piece[] = [
  // head
  { limb: 'upper', tri: [[0, -30], [-5, -22], [5, -22]] },
  // neck and chest
  { limb: 'upper', tri: [[0, -23], [-6, -17], [6, -17]] },
  // torso, pointing down into the hips
  { limb: 'upper', tri: [[-7, -18], [7, -18], [0, -10]] },
  // arms
  { limb: 'armL', tri: [[-6, -19], [-12, -13], [-5, -14]] },
  { limb: 'armR', tri: [[6, -19], [12, -13], [5, -14]] },
  // legs, two pieces each
  { limb: 'legUL', tri: [[-6, -11], [-2, -11], [-4, -6]] },
  { limb: 'legUR', tri: [[6, -11], [2, -11], [4, -6]] },
  { limb: 'legLL', tri: [[-5.5, -6], [-2.5, -6], [-4, 0]] },
  { limb: 'legLR', tri: [[5.5, -6], [2.5, -6], [4, 0]] },
]

type Trail = { tris: Tri[]; life: number }

/**
 * The figure: nine triangles that rotate independently, drawn in code.
 * Appearance only. The hitbox lives on Player and nothing here scales it.
 */
export class PlayerView {
  readonly gfx: Phaser.GameObjects.Graphics

  private scaleX = 1
  private scaleY = 1
  private pulseX = 1
  private pulseY = 1
  private pulseLeft = 0

  private phase = 0
  private clock = 0
  private shrugLeft = 0
  private sinceShrug = 0
  private trailLeft = 0
  private trails: Trail[] = []

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics()
  }

  /** Kept for the land squash, which is a kick rather than a held pose. */
  pulse(x: number, y: number): void {
    this.pulseX = x
    this.pulseY = y
    this.pulseLeft = RECOVER
  }

  /** The flat form compresses the figure, so there is no shape to swap. */
  setForm(_flat: boolean): void {}

  update(dt: number, p: Player): void {
    this.clock += dt
    this.advance(dt, p)

    const target = this.poseScale(p)
    // Settle onto the pose rather than snapping, so a state change reads as
    // movement instead of a jump cut.
    const k = Math.min(1, SCALE_LERP * dt)
    this.scaleX += (target[0] - this.scaleX) * k
    this.scaleY += (target[1] - this.scaleY) * k

    if (this.pulseLeft > 0) this.pulseLeft = Math.max(0, this.pulseLeft - dt)
    const pk = this.pulseLeft / RECOVER
    const sx = this.scaleX * (1 + (this.pulseX - 1) * pk) * p.facing
    const sy = this.scaleY * (1 + (this.pulseY - 1) * pk)

    const tris = this.build(p, sx, sy)
    this.trackTrail(dt, p, tris)
    this.render(tris)
  }

  // --- timers ---

  private advance(dt: number, p: Player): void {
    // The run cycle is driven by distance travelled, so the legs keep pace
    // with however fast you are actually going.
    if (p.grounded && (p.state === 'run' || p.state === 'skid')) {
      this.phase += (Math.abs(p.vx) * dt) / RUN_CYCLE_PX
    } else if (p.state === 'idle') {
      this.phase = 0
    }

    if (p.state === 'idle') {
      if (this.shrugLeft > 0) {
        this.shrugLeft = Math.max(0, this.shrugLeft - dt)
      } else {
        this.sinceShrug += dt
        if (this.sinceShrug > SHRUG_EVERY_MS / 1000) {
          this.shrugLeft = SHRUG
          this.sinceShrug = 0
        }
      }
    } else {
      this.shrugLeft = 0
      this.sinceShrug = 0
    }
  }

  /** The pose the current state holds, before the landing pulse. */
  private poseScale(p: Player): [number, number] {
    if (p.foldT > 0) {
      // Folding compresses the figure into the flat hitbox, which is what
      // reads as the fold.
      const w = PLAYER_W + (PLAYER_FLAT_W - PLAYER_W) * p.foldT
      const h = PLAYER_H + (PLAYER_FLAT_H - PLAYER_H) * p.foldT
      return [w / PLAYER_W, h / PLAYER_H]
    }
    switch (p.state) {
      case 'dash':
        return [DASH_STRETCH_X, DASH_STRETCH_Y]
      case 'jumpUp':
        return [JUMP_STRETCH_X, JUMP_STRETCH_Y]
      case 'fall':
        return [FALL_STRETCH_X, FALL_STRETCH_Y]
      default:
        return [1, 1]
    }
  }

  // --- posing ---

  private build(p: Player, sx: number, sy: number): Tri[] {
    const swing = Math.sin(this.phase * Math.PI * 2)
    const running = p.state === 'run' || p.state === 'skid'

    // Lean into the run. A skid leans the other way, against the slide.
    let lean = 0
    if (p.state === 'run') lean = RUN_LEAN_DEG * RAD * p.facing
    else if (p.state === 'skid') lean = -RUN_LEAN_DEG * RAD * p.facing

    const legSwing = running ? RUN_SWING_DEG * RAD * swing : 0
    const armSwing = running ? -RUN_ARM_SWING_DEG * RAD * swing : 0
    // Falling lets the legs trail upward behind the body.
    const trail = p.state === 'fall' ? FALL_LEG_TRAIL_DEG * RAD : 0

    const shrug =
      this.shrugLeft > 0
        ? Math.sin((1 - this.shrugLeft / SHRUG) * Math.PI) * SHRUG_DEG * RAD
        : 0

    const still = p.state === 'idle'
    const wave = Math.sin(this.clock * Math.PI * 2 * IDLE_BREATH_HZ)
    const breath = still ? 1 + (IDLE_BREATH - 1) * (0.5 + 0.5 * wave) : 1
    const bob = still ? wave * IDLE_BOB_PX : 0

    const foot = p.footY()
    const out: Tri[] = []

    for (const piece of PIECES) {
      const posed: Point[] = []

      for (const pt of piece.tri) {
        let q: Point = [pt[0], pt[1]]

        if (piece.limb === 'upper') {
          // Breathe about the hip, bob, then lean.
          q = [q[0], HIP[1] + (q[1] - HIP[1]) * breath + bob]
          q = rotAbout(q, lean, HIP)
        } else if (piece.limb === 'armL') {
          q = rotAbout(q, armSwing - shrug, SHOULDER_L)
          q = rotAbout(q, lean, HIP)
        } else if (piece.limb === 'armR') {
          q = rotAbout(q, -armSwing + shrug, SHOULDER_R)
          q = rotAbout(q, lean, HIP)
        } else if (piece.limb === 'legUL') {
          q = rotAbout(q, legSwing + trail, HIP)
        } else if (piece.limb === 'legUR') {
          q = rotAbout(q, -legSwing + trail, HIP)
        } else if (piece.limb === 'legLL') {
          q = rotAbout(q, legSwing * 0.5, KNEE_L)
          q = rotAbout(q, legSwing + trail, HIP)
        } else {
          q = rotAbout(q, -legSwing * 0.5, KNEE_R)
          q = rotAbout(q, -legSwing + trail, HIP)
        }

        // Body scale, then out into the world, anchored at the feet.
        posed.push([p.x + q[0] * sx, foot + q[1] * sy])
      }

      out.push([posed[0], posed[1], posed[2]])
    }

    return out
  }

  // --- dash trail ---

  private trackTrail(dt: number, p: Player, tris: Tri[]): void {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      this.trails[i].life -= dt
      if (this.trails[i].life <= 0) this.trails.splice(i, 1)
    }

    if (p.state !== 'dash') {
      this.trailLeft = 0
      return
    }

    this.trailLeft -= dt
    if (this.trailLeft > 0) return
    this.trailLeft = TRAIL_EVERY
    this.trails.push({ tris: tris.map((t) => [t[0], t[1], t[2]] as Tri), life: TRAIL_FADE })
  }

  private render(tris: Tri[]): void {
    this.gfx.clear()

    // Afterimages first, so the figure sits on top of its own trail.
    for (const t of this.trails) {
      this.gfx.fillStyle(COLOR_PLAYER, AFTERIMAGE_ALPHA * (t.life / TRAIL_FADE))
      for (const tri of t.tris) {
        this.gfx.fillTriangle(
          tri[0][0], tri[0][1], tri[1][0], tri[1][1], tri[2][0], tri[2][1],
        )
      }
    }

    this.gfx.fillStyle(COLOR_PLAYER, 1)
    this.gfx.lineStyle(PLAYER_OUTLINE, COLOR_PLAYER_LINE, 1)
    for (const tri of tris) {
      this.gfx.fillTriangle(
        tri[0][0], tri[0][1], tri[1][0], tri[1][1], tri[2][0], tri[2][1],
      )
      this.gfx.strokeTriangle(
        tri[0][0], tri[0][1], tri[1][0], tri[1][1], tri[2][0], tri[2][1],
      )
    }
  }
}
