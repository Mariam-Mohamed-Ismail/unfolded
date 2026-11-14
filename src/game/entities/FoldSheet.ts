import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { dashedLine } from '../geom.ts'
import { Thread } from '../ui/thread.ts'
import type {
  Box,
  EntityContext,
  EntitySnapshot,
  EntityWorld,
  FoldMode,
} from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Solid } from '../Player.ts'
import {
  COLOR_FOLD_LINE,
  FOLD_OUTLINE,
  LINK_DOT_GAP,
  LINK_DOT_PX,
  SHEET_FOLD_MS,
  SHEET_PX,
} from '../constants.ts'

const FOLD = SHEET_FOLD_MS / 1000

/**
 * A thin horizontal sheet that blocks the way up until something folds it
 * aside.
 *
 * It starts **closed**, which is the opposite of FoldPlatform, so the words
 * are worth spelling out: `trigger(_, 'unfold')` folds this sheet *away* and
 * opens the path; `'fold'` brings it back. That inversion is what lets a
 * switch drive it with no special case at either end.
 *
 * It knows nothing about fans. It blocks a draught by being solid, and Fan
 * cuts its column off under whatever solid is above it — so the column grows
 * when this opens with no link between the two classes.
 */
export class FoldSheet extends Entity {
  private ctx: EntityContext
  private purple: number
  private solid: Solid
  private sheetY: number

  /** 0 closed and solid, 1 folded fully aside. */
  private t = 0
  /** Which way it is moving: open, close, or neither. */
  private going: 'open' | 'close' | null = null
  private solidOn = false
  /**
   * Asked to close but something is in the way. It waits here rather than
   * closing on whoever it is — the spec is explicit that nobody gets
   * crushed.
   */
  private blocked = false
  /** The thread to the seal holding it shut, if one is. */
  private thread = new Thread()

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    this.ctx = ctx
    this.purple = ctx.palette.fold
    // `h` is the surface it sits at; the sheet hangs just under that line.
    this.sheetY = this.y
    this.solid = { x: this.x, y: this.sheetY, w: this.w, h: SHEET_PX }
    this.reset()
  }

  /** Is the way still blocked? */
  isClosed(): boolean {
    return this.solidOn
  }

  /** 0 closed, 1 folded aside. */
  progress(): number {
    return this.t
  }

  /** Waiting for its space to clear before it closes. */
  isWaiting(): boolean {
    return this.blocked
  }

  /** Is the thread to its seal still whole? */
  isHeld(): boolean {
    return this.thread.held(this.holder)
  }

  /** A folded sheet is a solved lesson, which is what a tag would ask. */
  done(): boolean {
    return this.t >= 1
  }

  /** The space it would occupy closed, which is what must be clear. */
  space(): Box {
    return {
      left: this.x,
      right: this.x + this.w,
      top: this.sheetY,
      bottom: this.sheetY + SHEET_PX,
    }
  }

  trigger(_delay: number, mode: FoldMode = 'unfold'): void {
    // 'unfold' opens the path by folding the sheet away; 'fold' closes it.
    if (mode === 'unfold') {
      if (this.t >= 1 && this.going === null) return
      this.going = 'open'
      // The way clears at once, so there is no edge to be caught on.
      this.setSolid(false)
      this.blocked = false
      return
    }
    if (this.t <= 0 && this.going === null) return
    this.going = 'close'
  }

  update(dt: number, world: EntityWorld): void {
    // A seal may be holding it shut. The frame that seal reports itself
    // cut, the thread snaps and the sheet folds itself aside — the same
    // rule the fold bridge runs, out of the same shared Thread.
    if (this.thread.tick(this.holder, dt)) {
      world.fx.sound('twang')
      this.trigger(0, 'unfold')
    }

    if (this.going === null) return

    if (this.going === 'open') {
      this.t = Math.min(1, this.t + dt / FOLD)
      if (this.t >= 1) {
        this.going = null
        world.fx.sound('fold')
      }
      return
    }

    // Closing. Never onto anybody: hold open until the space is clear.
    if (world.occupied(this.space())) {
      this.blocked = true
      return
    }
    this.blocked = false
    this.t = Math.max(0, this.t - dt / FOLD)
    if (this.t > 0) return
    this.going = null
    // Solid again only once it has arrived.
    this.setSolid(true)
    world.fx.sound('fold')
  }

  reset(): void {
    this.t = 0
    this.going = null
    this.blocked = false
    this.thread.reset()
    this.setSolid(true)
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    const full = this.w
    // Folding aside: it draws back toward its left edge, which is its crease.
    const wide = full * (1 - this.t)

    if (wide > 1) {
      g.fillStyle(this.purple, 1)
      g.fillRect(this.x, this.sheetY, wide, SHEET_PX)
      g.lineStyle(FOLD_OUTLINE, COLOR_FOLD_LINE, 1)
      g.strokeRect(this.x, this.sheetY, wide, SHEET_PX)
      // The thickening fold at the leading edge, so it reads as paper
      // gathering rather than a bar shrinking.
      const gather = Math.min(10, 10 * this.t)
      if (gather > 0.5) {
        g.fillRect(this.x + wide - 2, this.sheetY - gather / 2, 3, SHEET_PX + gather)
      }
    }

    // Where it will come back to, while it is away: a dotted line, so the
    // player can see the sheet is a thing that returns.
    if (this.t > 0) {
      g.lineStyle(FOLD_OUTLINE, this.purple, 0.35 * this.t)
      dashedLine(
        g,
        this.x + wide,
        this.sheetY + SHEET_PX / 2,
        this.x + full,
        this.sheetY + SHEET_PX / 2,
        LINK_DOT_PX,
        LINK_DOT_GAP,
      )
    }

    // And the thread up to the seal holding it shut, anchored at the
    // sheet's crease.
    const seal = this.holder
    if (seal) {
      this.thread.draw(
        g,
        seal,
        [this.x, this.sheetY + SHEET_PX / 2],
        [seal.centerX(), seal.y],
      )
    }
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: {
        closed: this.solidOn,
        open: Math.round(this.t * 100) / 100,
        waiting: this.blocked,
        held: this.isHeld(),
      },
    }
  }

  private setSolid(on: boolean): void {
    if (on === this.solidOn) return
    this.solidOn = on
    if (on) this.ctx.addSolid(this.solid)
    else this.ctx.removeSolid(this.solid)
  }
}
