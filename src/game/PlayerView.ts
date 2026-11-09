import * as Phaser from 'phaser'
import {
  COLOR_PLAYER,
  COLOR_PLAYER_LINE,
  SQUASH_RECOVER,
} from './constants.ts'

const RECOVER = SQUASH_RECOVER / 1000

type Tri = [number, number, number, number, number, number]

// Local coordinates: x across the body, y measured up from the feet at 0.
// Drawing from the feet means squash and stretch scale around the ground
// contact point, so a squashed figure stays planted instead of sinking.

const STANDING: Tri[] = [
  [0, -30, -5, -21, 5, -21], // head
  [0, -22, -8, -10, 8, -10], // torso
  [-7, -19, -13, -12, -5, -14], // left arm
  [7, -19, 13, -12, 5, -14], // right arm
  [-7, -11, -2, -11, -5, 0], // left leg
  [7, -11, 2, -11, 5, 0], // right leg
]

const FLAT: Tri[] = [
  [-15, 0, 2, -11, 15, 0], // the folded sheet
  [-15, 0, -6, -7, -2, 0], // creases
  [15, 0, 6, -7, 2, 0],
]

/**
 * The figure, drawn in code. Owns nothing but appearance: the hitbox stays
 * with Player and is never scaled.
 */
export class PlayerView {
  readonly gfx: Phaser.GameObjects.Graphics

  private flat = false
  private pulseX = 1
  private pulseY = 1
  private left = 0

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics()
    this.redraw()
  }

  setForm(flat: boolean): void {
    if (flat === this.flat) return
    this.flat = flat
    this.redraw()
  }

  /** Kick the scale, then let it settle back over SQUASH_RECOVER. */
  pulse(x: number, y: number): void {
    this.pulseX = x
    this.pulseY = y
    this.left = RECOVER
  }

  update(dt: number, x: number, footY: number, facing: number): void {
    if (this.left > 0) this.left = Math.max(0, this.left - dt)
    const k = this.left / RECOVER
    this.gfx.setPosition(x, footY)
    this.gfx.setScale((1 + (this.pulseX - 1) * k) * facing, 1 + (this.pulseY - 1) * k)
  }

  private redraw(): void {
    this.gfx.clear()
    this.gfx.fillStyle(COLOR_PLAYER, 1)
    this.gfx.lineStyle(1, COLOR_PLAYER_LINE, 1)
    for (const t of this.flat ? FLAT : STANDING) {
      this.gfx.fillTriangle(t[0], t[1], t[2], t[3], t[4], t[5])
      this.gfx.strokeTriangle(t[0], t[1], t[2], t[3], t[4], t[5])
    }
  }
}
