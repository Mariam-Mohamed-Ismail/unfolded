import * as Phaser from 'phaser'
import { COLOR_INK } from './constants.ts'

const INK = '#' + COLOR_INK.toString(16).padStart(6, '0')

/**
 * The only place in the game that puts words in the world.
 *
 * Entities are handed a Graphics and nothing else, so they cannot create a
 * Text object. Instead they call fx.label() with an id, and this keeps one
 * pooled Text per id: reused frame to frame, re-set only when the string
 * actually changes, and hidden the moment nothing asks for it.
 */
export class Labels {
  private scene: Phaser.Scene
  private pool = new Map<string, Phaser.GameObjects.Text>()
  private asked = new Set<string>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Centred on (x, y). Call it every frame the text should be visible. */
  show(
    id: string,
    x: number,
    y: number,
    text: string,
    size: number,
    alpha: number,
  ): void {
    this.asked.add(id)
    let label = this.pool.get(id)
    if (!label) {
      label = this.scene.add.text(0, 0, text, {
        fontFamily: 'monospace',
        fontSize: `${size}px`,
        color: INK,
      })
      label.setOrigin(0.5, 0.5).setDepth(900)
      this.pool.set(id, label)
    }
    // setText re-measures and re-renders the texture, so only on a change.
    if (label.text !== text) label.setText(text)
    label.setPosition(x, y).setAlpha(alpha).setVisible(alpha > 0.01)
  }

  /** Hide every label nothing asked for this frame. Called after update. */
  sweep(): void {
    for (const [id, label] of this.pool) {
      if (!this.asked.has(id)) label.setVisible(false)
    }
    this.asked.clear()
  }

  /** How many Text objects exist. For the overlay and for tests. */
  size(): number {
    return this.pool.size
  }
}
