import * as Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from './constants.ts'

/**
 * Wraps the scene camera. Bounds come from the level, so follow scrolls
 * once the world is bigger than the screen and stops at its edges.
 */
export class Camera {
  private cam: Phaser.Cameras.Scene2D.Camera

  constructor(scene: Phaser.Scene, levelWidth: number, levelHeight: number) {
    this.cam = scene.cameras.main
    // Clamped to the world, so following never shows past the edges.
    this.cam.setBounds(
      0,
      0,
      Math.max(levelWidth, GAME_WIDTH),
      Math.max(levelHeight, GAME_HEIGHT),
    )
  }

  follow(target: Phaser.GameObjects.Graphics): void {
    this.cam.startFollow(target, false, 0.12, 0.12)
  }

  /** Shake given in pixels; Phaser wants a fraction of the screen width. */
  shake(pixels: number, ms: number): void {
    if (pixels <= 0) return
    this.cam.shake(ms, pixels / GAME_WIDTH)
  }
}
