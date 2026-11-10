import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { rotAbout } from '../geom.ts'
import type { Box, EntityContext, EntitySnapshot, EntityWorld } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Point } from '../geom.ts'
import {
  COLOR_FORM,
  COLOR_INK,
  COLOR_PAPER,
  DOOR_H,
  DOOR_NEAR_PX,
  DOOR_OPEN_MS,
  DOOR_W,
  FOLD_OUTLINE,
  PARTICLES_LAND,
  PROMPT_FONT_PX,
  PROMPT_LIFT,
} from '../constants.ts'

const OPEN = DOOR_OPEN_MS / 1000
const QUARTER = Math.PI / 2

/**
 * The way out: a folded paper door that opens as you approach, and finishes
 * the level when you walk into it.
 *
 * "Finishing" here means latching done() and saying so on screen. The spec's
 * end screen, with the time and the reset count, is a screen rather than an
 * entity, so it is not this component's business.
 */
export class ExitDoor extends Entity {
  private doorX: number
  private doorY: number
  /** 0 shut, 1 fully unfolded. */
  private openT = 0
  private finished = false

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    // Centred in its tile, standing on the surface it was placed on.
    this.doorX = this.centerX() - DOOR_W / 2
    this.doorY = this.y - DOOR_H
  }

  done(): boolean {
    return this.finished
  }

  /** 0 shut, 1 open. */
  openness(): number {
    return this.openT
  }

  update(dt: number, world: EntityWorld): void {
    const box = world.player.box
    const px = (box.left + box.right) / 2
    const py = (box.top + box.bottom) / 2
    const near = Math.hypot(px - this.centerX(), py - (this.y - DOOR_H / 2))

    // Opens as you come, closes again if you wander off, unless it is done.
    const want = near <= DOOR_NEAR_PX || this.finished ? 1 : 0
    const move = dt / OPEN
    this.openT = Math.max(0, Math.min(1, this.openT + (want ? move : -move)))

    if (!this.finished && this.overlaps(box)) {
      this.finished = true
      world.fx.sound('pickup')
      world.fx.dust(this.centerX(), this.y - 8, PARTICLES_LAND, COLOR_FORM)
    }

    if (this.finished) {
      world.fx.label(
        this.id,
        this.centerX(),
        this.y - PROMPT_LIFT - DOOR_H,
        'level complete',
        PROMPT_FONT_PX,
        1,
      )
    }
  }

  /**
   * Finishing is not undone by a reset: Backspace is for getting unstuck,
   * not for taking the ending back.
   */
  reset(): void {
    this.openT = this.finished ? 1 : 0
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    const left = this.doorX
    const right = this.doorX + DOOR_W
    const top = this.doorY
    const bottom = this.y
    const mid = (left + right) / 2

    // The frame behind, so an open door reads as a way through.
    g.fillStyle(COLOR_INK, 0.25)
    g.fillRect(left, top, DOOR_W, DOOR_H)

    // Two leaves, each swinging about its own outer hinge. At openT 0 they
    // meet in the middle; at 1 they have folded back against the frame.
    const a = this.openT * QUARTER
    for (const side of [-1, 1]) {
      const hinge: Point = [side < 0 ? left : right, bottom]
      const innerTop: Point = [mid, top]
      const innerBottom: Point = [mid, bottom]
      const outerTop: Point = [side < 0 ? left : right, top]
      const leaf = [outerTop, innerTop, innerBottom].map((p) =>
        rotAbout(p, -side * a, hinge),
      )
      const points = [
        { x: hinge[0], y: hinge[1] },
        ...leaf.map(([x, y]) => ({ x, y })),
      ]
      g.fillStyle(COLOR_PAPER, 1)
      g.fillPoints(points, true)
      g.lineStyle(FOLD_OUTLINE, COLOR_INK, 1)
      g.strokePoints(points, true)
    }

    // A teal sliver down the crease, so the door reads as the form colour.
    g.lineStyle(FOLD_OUTLINE, COLOR_FORM, 0.6 + 0.4 * this.openT)
    g.lineBetween(mid, top, mid, bottom)
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: { open: Math.round(this.openT * 100) / 100, finished: this.finished },
    }
  }

  /** The doorway you have to walk into. */
  private overlaps(box: Box): boolean {
    return (
      box.right > this.doorX &&
      box.left < this.doorX + DOOR_W &&
      box.bottom > this.doorY &&
      box.top < this.y
    )
  }
}
