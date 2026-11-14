import * as Phaser from 'phaser'
import {
  CAM_DEADZONE_X,
  CAM_DEADZONE_Y,
  CAM_LERP,
  CAM_LOOK_AHEAD,
  COLOR_HURT,
  GAME_HEIGHT,
  GAME_WIDTH,
  HURT_TINT_ALPHA,
  HURT_TINT_BANDS,
  HURT_TINT_MS,
  HURT_TINT_PX,
  PICKUP_ZOOM,
  PICKUP_ZOOM_MS,
} from './constants.ts'

/**
 * Wraps the scene camera: smoothed follow, look-ahead in the direction you
 * are facing, a vertical deadzone so small hops do not pump the view, and
 * bounds taken from the level.
 */
export class Camera {
  private cam: Phaser.Cameras.Scene2D.Camera
  private look = 0
  /**
   * What the camera follows. Phaser's startFollow only reads `.x` and `.y`,
   * so this is a plain point we move to the player each frame rather than a
   * game object.
   *
   * It has to be this rather than the player's Graphics: PlayerView draws
   * the figure in world coordinates, so its Graphics object never leaves
   * (0, 0) and following it followed nothing.
   */
  private anchor = { x: 0, y: 0 }
  /** Seconds left of the zoom pulse. */
  private zoomT = 0
  /** Seconds left of the damage tint, and the Graphics it is drawn into. */
  private tintT = 0
  private tint: Phaser.GameObjects.Graphics

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

    // Over the world and the HUD, pinned to the screen: this is the frame of
    // the view, not something in the level.
    this.tint = scene.add.graphics()
    this.tint.setDepth(960).setScrollFactor(0)
  }

  /** Start on the player, so the view does not ease in from the world corner. */
  follow(x: number, y: number): void {
    this.anchor.x = x
    this.anchor.y = y
    this.cam.startFollow(this.anchor, false, CAM_LERP, CAM_LERP)
    this.cam.centerOn(x, y)
  }

  /**
   * Moves the follow point onto the player, and eases the look-ahead toward
   * whichever way they face, so turning around swings the view across rather
   * than snapping it.
   */
  update(facing: number, x: number, y: number, dt = 1 / 60): void {
    this.anchor.x = x
    this.anchor.y = y

    const want = CAM_LOOK_AHEAD * facing
    this.look += (want - this.look) * CAM_LERP
    // Phaser targets `follow.x - followOffset.x`, so looking right means a
    // negative offset.
    this.cam.setFollowOffset(-this.look, 0)

    // One half-sine out and back, so the pulse needs no second timer.
    if (this.zoomT > 0) {
      const total = PICKUP_ZOOM_MS / 1000
      this.zoomT = Math.max(0, this.zoomT - dt)
      const done = 1 - this.zoomT / total
      this.cam.setZoom(1 + PICKUP_ZOOM * Math.sin(done * Math.PI))
    }

    if (this.tintT > 0) {
      this.tintT = Math.max(0, this.tintT - dt)
      this.drawTint(this.tintT / (HURT_TINT_MS / 1000))
    }
  }

  /** Where the view is currently centred. */
  center(): { x: number; y: number } {
    return { x: this.cam.midPoint.x, y: this.cam.midPoint.y }
  }

  /** How far ahead the view is currently leaning, in pixels. */
  lookAhead(): number {
    return this.look
  }

  /**
   * A short zoom pulse, out and back in one timer. Driven by hand like the
   * look-ahead rather than with a Phaser tween, so the two cannot fight.
   */
  zoomPulse(): void {
    this.zoomT = PICKUP_ZOOM_MS / 1000
  }

  /** Shake given in pixels; Phaser wants a fraction of the screen width. */
  shake(pixels: number, ms: number): void {
    if (pixels <= 0) return
    this.cam.shake(ms, pixels / GAME_WIDTH)
  }

  /**
   * The damage vignette: a red-pink tint that creeps in from the edges and
   * fades. Here rather than in the Hud because it is of the screen, like the
   * shake and the zoom, not of the readout.
   */
  hurtTint(): void {
    this.tintT = HURT_TINT_MS / 1000
  }

  /** `strength` runs 1 to 0 as the tint fades. */
  private drawTint(strength: number): void {
    this.tint.clear()
    if (strength <= 0) return

    // Bands from each edge inward, each fainter than the last, which reads
    // as a gradient without needing one.
    const bands = HURT_TINT_BANDS
    for (let i = 0; i < bands; i++) {
      const t = 1 - i / bands
      const inset = (HURT_TINT_PX * i) / bands
      const step = HURT_TINT_PX / bands
      this.tint.fillStyle(COLOR_HURT, HURT_TINT_ALPHA * strength * t * t)
      // Top, bottom, left, right — overlapping at the corners on purpose, so
      // the corners are the strongest part.
      this.tint.fillRect(inset, inset, GAME_WIDTH - inset * 2, step)
      this.tint.fillRect(inset, GAME_HEIGHT - inset - step, GAME_WIDTH - inset * 2, step)
      this.tint.fillRect(inset, inset, step, GAME_HEIGHT - inset * 2)
      this.tint.fillRect(GAME_WIDTH - inset - step, inset, step, GAME_HEIGHT - inset * 2)
    }
  }
}
