import * as Phaser from 'phaser'
import type { Health } from './Health.ts'
import { crease } from './Upgrades.ts'
import {
  COLOR_FOLD,
  COLOR_HURT,
  COLOR_INK,
  CREASE_ICON_DY,
  CREASE_ICON_PX,
  GAME_WIDTH,
  HEALTH_MAX,
  HEALTH_PIP_DY,
  HEALTH_PIP_FADE_S,
  HEALTH_PIP_GAP,
  HEALTH_PIP_LINE,
  HEALTH_PIP_PX,
  HUD_FONT_PX,
  HUD_PAD,
} from './constants.ts'

const INK = '#' + COLOR_INK.toString(16).padStart(6, '0')

/**
 * The room name one side, the timer and reset count the other. The spec's
 * HUD is those two things and "nothing else", so that is all this is.
 *
 * Pinned to the screen rather than the world, unlike the Labels pool the
 * prompts use.
 */
export class Hud {
  private left: Phaser.GameObjects.Text
  private right: Phaser.GameObjects.Text
  /** The health pips, which are drawn rather than typed. */
  private gfx: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) {
    const style = {
      fontFamily: 'monospace',
      fontSize: `${HUD_FONT_PX}px`,
      color: INK,
    }
    this.left = scene.add.text(HUD_PAD, HUD_PAD, '', style)
    this.right = scene.add.text(GAME_WIDTH - HUD_PAD, HUD_PAD, '', style)
    this.right.setOrigin(1, 0)
    for (const t of [this.left, this.right]) {
      t.setDepth(950).setScrollFactor(0)
    }
    this.gfx = scene.add.graphics()
    this.gfx.setDepth(950).setScrollFactor(0)
  }

  /**
   * The three triangles under the room name. Only drawn for a level that can
   * hurt you: Level 1 has no danger, so its HUD stays the room name and the
   * timer, exactly as it was.
   */
  private drawHealth(health: Health | null): void {
    this.gfx.clear()
    if (!health) return

    const r = HEALTH_PIP_PX
    const y = HUD_PAD + HEALTH_PIP_DY + r
    for (let i = 0; i < HEALTH_MAX; i++) {
      const x = HUD_PAD + r + i * (r * 2 + HEALTH_PIP_GAP)
      const age = health.pipAge(i)

      if (age === null) {
        // Still held.
        this.gfx.fillStyle(COLOR_INK, 0.9)
        pip(this.gfx, x, y, r, true)
        continue
      }

      if (age < HEALTH_PIP_FADE_S) {
        // Just lost: cracks and fades.
        const t = 1 - age / HEALTH_PIP_FADE_S
        this.gfx.fillStyle(COLOR_HURT, t)
        pip(this.gfx, x, y, r, true)
        this.gfx.lineStyle(HEALTH_PIP_LINE, COLOR_INK, t)
        // The crack: a line splitting the triangle from apex to base.
        this.gfx.lineBetween(x, y - r, x + r * 0.35, y + r * 0.7)
        continue
      }

      // Gone, but the slot stays so three is still the number you count to.
      this.gfx.lineStyle(HEALTH_PIP_LINE, COLOR_INK, 0.3)
      pip(this.gfx, x, y, r, false)
    }

    this.drawCrease(y + r + CREASE_ICON_DY)
  }

  /**
   * The crease, under the health: a folded wing for the glider, a blade for
   * the keen edge. Drawn rather than written, like everything else here.
   */
  private drawCrease(y: number): void {
    const which = crease()
    if (which === 'none') return
    const r = CREASE_ICON_PX
    const x = HUD_PAD + r

    this.gfx.fillStyle(COLOR_FOLD, 0.9)
    this.gfx.lineStyle(HEALTH_PIP_LINE, COLOR_INK, 0.8)
    if (which === 'glider') {
      // One sheet creased down the middle.
      this.gfx.fillTriangle(x - r, y + r, x + r, y - r, x + r, y + r)
      this.gfx.strokeTriangle(x - r, y + r, x + r, y - r, x + r, y + r)
      this.gfx.lineBetween(x + r, y - r, x, y + r)
    } else {
      // A long thin blade.
      this.gfx.fillTriangle(x - r, y + r, x + r, y - r, x + r * 0.2, y + r)
      this.gfx.strokeTriangle(x - r, y + r, x + r, y - r, x + r * 0.2, y + r)
    }
  }

  update(
    room: string,
    seconds: number,
    resets: number,
    health: Health | null = null,
  ): void {
    this.drawHealth(health)
    if (this.left.text !== room) this.left.setText(room)
    const whole = Math.floor(seconds)
    const m = Math.floor(whole / 60)
    const s = whole % 60
    const text = `${m}:${s.toString().padStart(2, '0')}  resets ${resets}`
    if (this.right.text !== text) this.right.setText(text)
  }
}

/** One pip: a small upward triangle, filled or outlined. */
function pip(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  filled: boolean,
): void {
  const pts: [number, number, number, number, number, number] = [
    x, y - r,
    x + r, y + r * 0.8,
    x - r, y + r * 0.8,
  ]
  if (filled) g.fillTriangle(...pts)
  else g.strokeTriangle(...pts)
}
