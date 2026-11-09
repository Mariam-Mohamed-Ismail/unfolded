import * as Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from './constants.ts'

/**
 * Wraps the scene camera. Today the lane is exactly one screen wide, so the
 * bounds leave no room to scroll and follow is inert; only shake is visible.
 * Longer levels will make follow start working with no change here.
 */
export class Camera {
  private cam: Phaser.Cameras.Scene2D.Camera

  constructor(scene: Phaser.Scene, levelWidth: number) {
    this.cam = scene.cameras.main
    this.cam.setBounds(0, 0, Math.max(levelWidth, GAME_WIDTH), GAME_HEIGHT)
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
