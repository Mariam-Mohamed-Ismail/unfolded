import * as Phaser from 'phaser'
import { COLOR_INK, GAME_WIDTH, HUD_FONT_PX, HUD_PAD } from './constants.ts'

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
  }

  update(room: string, seconds: number, resets: number): void {
    if (this.left.text !== room) this.left.setText(room)
    const whole = Math.floor(seconds)
    const m = Math.floor(whole / 60)
    const s = whole % 60
    const text = `${m}:${s.toString().padStart(2, '0')}  resets ${resets}`
    if (this.right.text !== text) this.right.setText(text)
  }
}
