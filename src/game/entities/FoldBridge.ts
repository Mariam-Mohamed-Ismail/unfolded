import type * as Phaser from 'phaser'
import { Entity } from './Entity.ts'
import { dashedRect, mixColor, rotAbout } from '../geom.ts'
import { Thread } from '../ui/thread.ts'
import type {
  EntityContext,
  EntitySnapshot,
  EntityWorld,
  FoldMode,
} from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'
import type { Point } from '../geom.ts'
import type { Solid } from '../Player.ts'
import {
  BRIDGE_DECK_PX,
  BRIDGE_SEGMENTS,
  BRIDGE_STAGGER_MS,
  COLOR_FOLD_LINE,
  COLOR_FOLD_SHADE,
  FOLD_DASH_GAP,
  FOLD_DASH_PX,
  FOLD_GHOST_ALPHA,
  FOLD_OPEN_MS,
  FOLD_OUTLINE,
  PARTICLES_FOLD_OPEN,
} from '../constants.ts'

const OPEN = FOLD_OPEN_MS / 1000
const STAGGER = BRIDGE_STAGGER_MS / 1000
const QUARTER = Math.PI / 2

type Segment = {
  /** Left edge and width, in pixels. */
  x: number
  w: number
  /** 0 folded, 1 landed. */
  t: number
  solid: Solid
  solidOn: boolean
  /** Latched so the landing effects fire once. */
  landed: boolean
}

/**
 * A bridge that starts folded and opens like a concertina.
 *
 * Five panels rather than five entities: the data gives it one id and one
 * seal to be held by, and a concertina is one thing. Each panel keeps its
 * own angle and its own solid, which goes in the moment that panel lands —
 * so the bridge carries weight from the left end while the right is still
 * swinging.
 *
 * Its deck is a slab flush with the floor either side, not a column: it
 * bridges the gap rather than filling it. Flush matters, because without
 * step-up a solid whose top sits above the floor would be a wall to walk
 * into rather than a bridge to walk onto.
 */
export class FoldBridge extends Entity {
  private ctx: EntityContext
  private purple: number
  private topY: number
  private segs: Segment[] = []

  private opening = false
  private clock = 0
  /** The thread to its seal, and the released-once latch inside it. */
  private thread = new Thread()

  constructor(spec: EntitySpec, ctx: EntityContext) {
    super(spec, ctx)
    this.ctx = ctx
    this.purple = ctx.palette.fold
    this.topY = ctx.surfaceY(spec.topH ?? this.th)

    const count = Math.max(1, spec.segments ?? BRIDGE_SEGMENTS)
    const each = this.w / count
    for (let i = 0; i < count; i++) {
      const x = this.x + i * each
      this.segs.push({
        x,
        w: each,
        t: 0,
        solid: { x, y: this.topY, w: each, h: BRIDGE_DECK_PX },
        solidOn: false,
        landed: false,
      })
    }
    this.reset()
  }

  /** How many panels are carrying weight. */
  openSegments(): number {
    return this.segs.filter((s) => s.solidOn).length
  }

  segmentCount(): number {
    return this.segs.length
  }

  /** How far along panel `i` is, 0 folded to 1 landed. */
  segmentProgress(i: number): number {
    return this.segs[i]?.t ?? 0
  }

  /** Every panel down and solid. */
  isOpen(): boolean {
    return this.segs.every((s) => s.solidOn)
  }

  done(): boolean {
    return this.isOpen()
  }

  /** Is the thread to its seal still whole? */
  isHeld(): boolean {
    return this.thread.held(this.holder)
  }

  trigger(_delay: number, mode: FoldMode = 'unfold'): void {
    if (mode !== 'unfold' || this.opening || this.isOpen()) return
    this.opening = true
    this.clock = 0
  }

  update(dt: number, world: EntityWorld): void {
    // A seal holding it closed: the moment that seal reports itself cut,
    // the thread snaps and the bridge opens itself. Polled rather than
    // pushed, so the seal needs to know nothing about what it holds.
    if (this.thread.tick(this.holder, dt)) {
      world.fx.sound('twang')
      this.trigger(0, 'unfold')
    }

    if (!this.opening) return
    this.clock += dt

    let all = true
    for (let i = 0; i < this.segs.length; i++) {
      const seg = this.segs[i]
      // One clock for the whole bridge, with each panel reading its own
      // offset out of it: the stagger then cannot drift from the swing.
      const p = (this.clock - i * STAGGER) / OPEN
      if (p < 1) all = false
      if (p <= 0) continue
      seg.t = Math.min(1, p)
      if (seg.t < 1 || seg.landed) continue

      seg.landed = true
      this.setSolid(seg, true)
      world.fx.dust(
        seg.x + seg.w / 2,
        this.topY,
        PARTICLES_FOLD_OPEN,
        this.purple,
      )
      world.fx.sound('fold')
    }
    if (all) this.opening = false
  }

  reset(): void {
    this.opening = false
    this.clock = 0
    this.thread.reset()
    for (const seg of this.segs) {
      seg.t = 0
      seg.landed = false
      this.setSolid(seg, false)
    }
  }

  draw(g: Phaser.GameObjects.Graphics): void {
    // Folded: a dashed ghost of the whole span, so the way across is
    // legible before it exists.
    if (this.segs.every((s) => s.t <= 0)) {
      g.lineStyle(FOLD_OUTLINE, this.purple, FOLD_GHOST_ALPHA)
      dashedRect(
        g,
        this.x,
        this.topY,
        this.w,
        BRIDGE_DECK_PX,
        FOLD_DASH_PX,
        FOLD_DASH_GAP,
      )
    }

    for (const seg of this.segs) {
      if (seg.t <= 0) continue
      // Each panel swings up about its left crease, from hanging straight
      // down to flat. The shading comes off the angle, so a panel mid-swing
      // reads as paper catching the light rather than a box appearing.
      const angle = -QUARTER * (1 - seg.t)
      const crease: Point = [seg.x, this.topY]
      const corners: Point[] = [
        [seg.x, this.topY],
        [seg.x + seg.w, this.topY],
        [seg.x + seg.w, this.topY + BRIDGE_DECK_PX],
        [seg.x, this.topY + BRIDGE_DECK_PX],
      ]
      const turned = corners.map((c) => rotAbout(c, angle, crease))
      const shade = mixColor(this.purple, COLOR_FOLD_SHADE, 1 - seg.t)
      g.fillStyle(shade, 1)
      g.fillPoints(
        turned.map((p) => ({ x: p[0], y: p[1] })),
        true,
      )
      g.lineStyle(FOLD_OUTLINE, COLOR_FOLD_LINE, 1)
      g.strokePoints(
        turned.map((p) => ({ x: p[0], y: p[1] })),
        true,
      )
    }

    const seal = this.holder
    if (seal) {
      this.thread.draw(g, seal, [this.x, this.topY], [seal.centerX(), seal.y])
    }
  }

  serialize(): EntitySnapshot {
    return {
      ...super.serialize(),
      state: {
        open: this.openSegments(),
        segments: this.segs.length,
        held: this.isHeld(),
      },
    }
  }

  private setSolid(seg: Segment, on: boolean): void {
    if (on === seg.solidOn) return
    seg.solidOn = on
    if (on) this.ctx.addSolid(seg.solid)
    else this.ctx.removeSolid(seg.solid)
  }
}
