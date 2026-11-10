import * as Phaser from 'phaser'
import {
  COLOR_FOLD,
  COLOR_INK,
  COLOR_PAPER,
  GAME_WIDTH,
  MENU_FOLD_PX,
  MENU_FONT_PX,
  MENU_GAP,
  MENU_H,
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
  choose: () => void
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

  private up: Phaser.Input.Keyboard.Key[] = []
  private down: Phaser.Input.Keyboard.Key[] = []
  private enter: Phaser.Input.Keyboard.Key[] = []
  private upHeld = false
  private downHeld = false
  private enterHeld = false
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
      this.enter = [kb.addKey('ENTER')]
    }

    // Seeded from the current state, not from false. A key already down when
    // this is built — Enter as a scene starts, or the Esc that opened the
    // pause overlay — must not read as a fresh press on the first frame.
    this.upHeld = anyDown(this.up)
    this.downHeld = anyDown(this.down)
    this.enterHeld = anyDown(this.enter)
    this.clickHeld = scene.input.activePointer.leftButtonDown()
  }

  /** Replaces the whole list, which is how the menu changes page. */
  setItems(items: MenuItem[]): void {
    this.items = items
    this.index = 0
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
    if (this.items.length === 0) return
    const n = this.items.length
    this.index = (this.index + step + n) % n
  }

  /** Runs the item under the cursor. */
  choose(): void {
    this.items[this.index]?.choose()
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

  /** The box of item `i`, which is also what the mouse is tested against. */
  private box(i: number): { x: number; y: number; w: number; h: number } {
    return {
      x: (GAME_WIDTH - MENU_W) / 2,
      y: this.top + i * (MENU_H + MENU_GAP),
      w: MENU_W,
      h: MENU_H,
    }
  }

  private readKeys(): void {
    const down = anyDown(this.down)
    if (down && !this.downHeld) this.moveBy(1)
    this.downHeld = down

    const up = anyDown(this.up)
    if (up && !this.upHeld) this.moveBy(-1)
    this.upHeld = up

    const enter = anyDown(this.enter)
    if (enter && !this.enterHeld) this.choose()
    this.enterHeld = enter
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
      const b = this.box(i)
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i
    }
    return -1
  }

  private draw(): void {
    this.gfx.clear()
    for (let i = 0; i < this.items.length; i++) {
      const b = this.box(i)
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

      const label = this.labels[i]
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
