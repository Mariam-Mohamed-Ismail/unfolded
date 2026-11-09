import * as Phaser from 'phaser'
import {
  CAM_DEADZONE_X,
  CAM_DEADZONE_Y,
  CAM_LERP,
  CAM_LOOK_AHEAD,
  GAME_HEIGHT,
  GAME_WIDTH,
} from './constants.ts'

/**
 * Wraps the scene camera: smoothed follow, look-ahead in the direction you
 * are facing, a vertical deadzone so small hops do not pump the view, and
 * bounds taken from the level.
 */
export class Camera {
  private cam: Phaser.Cameras.Scene2D.Camera
  private look = 0

  constructor(scene: Phaser.Scene, levelWidth: number, levelHeight: number) {
    this.cam = scene.cameras.main
    // Clamped to the world, so following never shows past the edges.
    this.cam.setBounds(
      0,
      0,
      Math.max(levelWidth, GAME_WIDTH),
      Math.max(levelHeight, GAME_HEIGHT),
    )
    // Vertical slack only: the view should not chase a jump, but it should
    // keep up horizontally.
    this.cam.setDeadzone(CAM_DEADZONE_X, CAM_DEADZONE_Y)
  }

  follow(target: Phaser.GameObjects.Graphics): void {
    this.cam.startFollow(target, false, CAM_LERP, CAM_LERP)
  }

  /**
   * Eases the look-ahead toward whichever way the player faces, so turning
   * around swings the view across rather than snapping it.
   */
  update(facing: number): void {
    const want = CAM_LOOK_AHEAD * facing
    this.look += (want - this.look) * CAM_LERP
    // Phaser targets `follow.x - followOffset.x`, so looking right means a
    // negative offset.
    this.cam.setFollowOffset(-this.look, 0)
  }

  /** How far ahead the view is currently leaning, in pixels. */
  lookAhead(): number {
    return this.look
  }

  /** Shake given in pixels; Phaser wants a fraction of the screen width. */
  shake(pixels: number, ms: number): void {
    if (pixels <= 0) return
    this.cam.shake(ms, pixels / GAME_WIDTH)
  }
}
