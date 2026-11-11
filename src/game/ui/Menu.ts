import * as Phaser from 'phaser'
import {
  COLOR_FOLD,
  COLOR_INK,
  COLOR_PAPER,
  GAME_WIDTH,
  MENU_FOLD_PX,
  MENU_FONT_PX,
  MENU_GAP,
  MENU_GAP_SMALL,
  MENU_H,
  MENU_HEAD_H,
  MENU_H_SMALL,
  MENU_W,
} from '../constants.ts'

const INK = '#' + COLOR_INK.toString(16).padStart(6, '0')
const PAPER = '#' + COLOR_PAPER.toString(16).padStart(6, '0')

/**
 * One choice. The label is a function, not a string, so an item whose text
 * depends on something live — "Sound: on" — reads it each frame instead of
 * having to be rebuilt.
 */
export type MenuItem = {
  label: () => string
  /**
   * Absent makes this a heading: a row with nothing to do is a row you
   * cannot select. The cursor steps over it and the mouse ignores it.
   */
  choose?: () => void
}

/**
 * A list of paper buttons with one highlighted. Shared by every screen, so
 * they cannot drift apart.
 *
 * Keyboard and mouse are both polled in update() rather than wired to
 * scene.input listeners: a scene that restarts leaves listeners behind, and
 * it keeps this in step with how Input.ts reads the keyboard.
 */
export class Menu {
  private scene: Phaser.Scene
  private gfx: Phaser.GameObjects.Graphics
  private labels: Phaser.GameObjects.Text[] = []
  private items: MenuItem[] = []
  private top: number
  private index = 0
  private compact = false

  private up: Phaser.Input.Keyboard.Key[] = []
  private down: Phaser.Input.Keyboard.Key[] = []
  private upHeld = false
  private downHeld = false
  /**
   * Enter starts armed, and a release re-arms it.
   *
   * Edges come from keydown/keyup rather than from polling isDown, because
   * keys are per scene: one created mid-hold reads up, and the browser's
   * key-repeat then fires a keydown that polling cannot tell from a fresh
   * press. Armed to begin with because Enter is never the key that opened
   * a menu — unlike Esc on the pause overlay, which starts disarmed.
   */
  private enterArmed = true
  private clickHeld = false
  private pointerWas = { x: -1, y: -1 }

  constructor(scene: Phaser.Scene, top: number) {
    this.scene = scene
    this.top = top
    this.gfx = scene.add.graphics()

    const kb = scene.input.keyboard
    if (kb) {
      this.up = [kb.addKey('UP')]
      this.down = [kb.addKey('DOWN')]
      kb.on('keyup-ENTER', () => {
        this.enterArmed = true
      })
      kb.on('keydown-ENTER', () => {
        if (!this.enterArmed) return
        this.enterArmed = false
        this.choose()
      })
    }

    // The cursor keys only move a highlight, so a stray repeat is harmless
    // and polling is fine. The pointer is game-wide rather than per scene,
    // so its current state is trustworthy and seeding it works.
    this.upHeld = anyDown(this.up)
    this.downHeld = anyDown(this.down)
    this.clickHeld = scene.input.activePointer.leftButtonDown()
  }

  /** Shorter rows, for a page with too many items to fit otherwise. */
  setCompact(compact: boolean): void {
    this.compact = compact
  }

  /** Replaces the whole list, which is how the menu changes page. */
  setItems(items: MenuItem[]): void {
    this.items = items
    // Never start on a heading.
    this.index = items.findIndex((i) => i.choose)
    if (this.index < 0) this.index = 0
    for (const label of this.labels) label.destroy()
    this.labels = items.map(() =>
      this.scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: `${MENU_FONT_PX}px`,
          color: INK,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(10),
    )
  }

  /** Moves the whole list, for a page that needs room above it. */
  setTop(y: number): void {
    this.top = y
  }

  /** Where row `i` sits, for a panel to size around or a pointer to aim at. */
  boxOf(i: number): { x: number; y: number; w: number; h: number } {
    return this.box(i)
  }

  /** The y the last button ends at, so a panel can be sized around it. */
  bottom(): number {
    if (this.items.length === 0) return this.top
    const b = this.box(this.items.length - 1)
    return b.y + b.h
  }

  /** Which item the cursor is on. */
  cursor(): number {
    return this.index
  }

  /** The labels as they currently read. For tests and for the overlay. */
  texts(): string[] {
    return this.items.map((i) => i.label())
  }

  moveBy(step: number): void {
    const n = this.items.length
    if (n === 0) return
    // Step over headings. The guard stops a list of nothing but headings
    // from spinning for ever.
    for (let tries = 0; tries < n; tries++) {
      this.index = (this.index + step + n) % n
      if (this.items[this.index].choose) return
    }
  }

  /** Runs the item under the cursor. A heading has nothing to run. */
  choose(): void {
    this.items[this.index]?.choose?.()
  }

  update(): void {
    this.readKeys()
    this.readPointer()
    this.draw()
  }

  destroy(): void {
    this.gfx.destroy()
    for (const label of this.labels) label.destroy()
    this.labels = []
  }

  /**
   * The box of item `i`, which is also what the mouse is tested against.
   * Rows are stacked rather than indexed, because a heading is shorter than
   * a button.
   */
  private box(i: number): { x: number; y: number; w: number; h: number } {
    let y = this.top
    for (let k = 0; k < i; k++) y += this.rowH(k) + this.gap()
    return { x: (GAME_WIDTH - MENU_W) / 2, y, w: MENU_W, h: this.rowH(i) }
  }

  private rowH(i: number): number {
    if (!this.items[i]?.choose) return MENU_HEAD_H
    return this.compact ? MENU_H_SMALL : MENU_H
  }

  private gap(): number {
    return this.compact ? MENU_GAP_SMALL : MENU_GAP
  }

  private readKeys(): void {
    const down = anyDown(this.down)
    if (down && !this.downHeld) this.moveBy(1)
    this.downHeld = down

    const up = anyDown(this.up)
    if (up && !this.upHeld) this.moveBy(-1)
    this.upHeld = up
  }

  private readPointer(): void {
    const p = this.scene.input.activePointer
    const x = p.worldX
    const y = p.worldY
    const moved = x !== this.pointerWas.x || y !== this.pointerWas.y
    this.pointerWas = { x, y }

    const over = this.hit(x, y)
    // Only a real move claims the cursor, so the keyboard is not fighting a
    // stationary pointer that happens to sit over another button.
    if (moved && over >= 0) this.index = over

    const click = p.leftButtonDown()
    // A click in dead space chooses nothing rather than the nearest thing.
    if (click && !this.clickHeld && over >= 0) {
      this.index = over
      this.choose()
    }
    this.clickHeld = click
  }

  private hit(x: number, y: number): number {
    for (let i = 0; i < this.items.length; i++) {
      if (!this.items[i].choose) continue
      const b = this.box(i)
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i
    }
    return -1
  }

  private draw(): void {
    this.gfx.clear()
    for (let i = 0; i < this.items.length; i++) {
      const b = this.box(i)
      const label = this.labels[i]

      // A heading is just words: no paper, no outline, nothing to click.
      if (!this.items[i].choose) {
        if (label) {
          const text = this.items[i].label()
          if (label.text !== text) label.setText(text)
          label.setPosition(b.x + b.w / 2, b.y + b.h / 2).setColor(INK)
        }
        continue
      }

      const on = i === this.index
      const fold = MENU_FOLD_PX
      // A paper quad with the corner turned down, like the prompt tags.
      const points = [
        { x: b.x, y: b.y },
        { x: b.x + b.w - fold, y: b.y },
        { x: b.x + b.w, y: b.y + fold },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x, y: b.y + b.h },
      ]
      this.gfx.fillStyle(on ? COLOR_FOLD : COLOR_PAPER, 1)
      this.gfx.fillPoints(points, true)
      this.gfx.lineStyle(2, COLOR_INK, 1)
      this.gfx.strokePoints(points, true)
      this.gfx.lineBetween(b.x + b.w - fold, b.y, b.x + b.w, b.y + fold)

      if (!label) continue
      const text = this.items[i].label()
      if (label.text !== text) label.setText(text)
      label
        .setPosition(b.x + b.w / 2, b.y + b.h / 2)
        .setColor(on ? PAPER : INK)
    }
  }
}

function anyDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
  for (const key of keys) {
    if (key.isDown) return true
  }
  return false
}
