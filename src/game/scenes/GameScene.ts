import * as Phaser from 'phaser'
import { Audio } from '../Audio.ts'
import { Camera } from '../Camera.ts'
import { Debug } from '../Debug.ts'
import { Input } from '../Input.ts'
import { Particles } from '../Particles.ts'
import { Player } from '../Player.ts'
import { level1 } from '../levels/level1.ts'
import {
  COLOR_SOLID,
  GAME_HEIGHT,
  LAND_HARD_SPEED,
  MAX_DT_MS,
  PARTICLES_DASH,
  PARTICLES_FOLD,
  PARTICLES_LAND,
  PLAYER_H,
  SHAKE_DASH,
  SHAKE_DASH_MS,
  SHAKE_LAND,
  SHAKE_LAND_MS,
  TILE,
} from '../constants.ts'

export class GameScene extends Phaser.Scene {
  // Not `input`: Phaser.Scene already owns that name.
  private controls!: Input
  private player!: Player
  private particles!: Particles
  private cam!: Camera
  private audio!: Audio
  private debug!: Debug

  constructor() {
    super('GameScene')
  }

  create(): void {
    for (const s of level1.solids) {
      this.add.rectangle(s.x, s.y, s.w, s.h, COLOR_SOLID).setOrigin(0, 0)
    }

    this.controls = new Input(this)
    this.player = new Player(
      this,
      level1.spawn.x,
      level1.spawn.y - PLAYER_H / 2,
    )
    // After the player, so paper lands on top of the figure.
    this.particles = new Particles(this)

    this.audio = new Audio()
    // Last, so the overlay draws over everything else.
    this.debug = new Debug(this)

    const width = Math.max(...level1.solids.map((s) => s.x + s.w))
    this.cam = new Camera(this, width)
    this.cam.follow(this.player.view.gfx)
  }

  update(_time: number, delta: number): void {
    // Phaser hands us milliseconds; everything downstream works in seconds.
    // The clamp stops a tab-switch stall from teleporting us through a wall.
    const dt = Math.min(delta, MAX_DT_MS) / 1000

    this.controls.update()
    if (this.controls.mutePressed) this.audio.toggleMute()
    if (this.controls.debugPressed) this.debug.toggle()
    this.debug.handle(this.controls)
    if (this.controls.resetPressed) this.respawn()

    this.player.update(dt, this.controls, level1.solids)
    this.react()
    this.particles.update(dt)

    // Missing the gap drops you out of the world; put you back at the start.
    if (this.player.y > GAME_HEIGHT + TILE * 2) this.respawn()

    this.debug.update(this.player, level1.solids, this.game.loop.actualFps)
  }

  private respawn(): void {
    this.player.reset(level1.spawn.x, level1.spawn.y - PLAYER_H / 2)
    this.audio.respawn()
  }

  /** Turns what the controller did this frame into things you can see. */
  private react(): void {
    const p = this.player
    const foot = p.footY()

    if (p.justJumped) this.audio.jump()

    if (p.justLanded) {
      this.audio.land()
      this.particles.burst(p.x, foot, PARTICLES_LAND)
      // Only a real drop shakes; stepping off a kerb should not.
      if (p.landSpeed >= LAND_HARD_SPEED) {
        this.cam.shake(SHAKE_LAND, SHAKE_LAND_MS)
      }
    }

    if (p.justDashed) {
      this.audio.dash()
      // Thrown backwards, away from the direction of travel.
      this.particles.burst(p.x, foot - 8, PARTICLES_DASH, -p.facing * 90)
      this.cam.shake(SHAKE_DASH, SHAKE_DASH_MS)
    }

    if (p.justFolded) {
      this.audio.fold()
      this.particles.burst(p.x, foot, PARTICLES_FOLD)
    }

    if (p.justStood) this.audio.unfold()
  }
}
