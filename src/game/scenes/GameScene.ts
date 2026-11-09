import * as Phaser from 'phaser'
import { Audio } from '../Audio.ts'
import { Camera } from '../Camera.ts'
import { Debug } from '../Debug.ts'
import { Input } from '../Input.ts'
import { Level } from '../Level.ts'
import { Particles } from '../Particles.ts'
import { Player } from '../Player.ts'
import { level1 } from '../levels/level1.ts'
import {
  LAND_HARD_SPEED,
  MAX_DT_MS,
  PARTICLES_DASH,
  PARTICLES_FOLD,
  PARTICLES_FOOTSTEP,
  PARTICLES_LAND,
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
  private level!: Level

  constructor() {
    super('GameScene')
  }

  create(): void {
    this.level = new Level(level1)
    this.level.draw(this)

    this.controls = new Input(this)
    const start = this.level.startPoint()
    this.player = new Player(this, start.x, start.y, this.level.solids)
    // After the player, so paper lands on top of the figure.
    this.particles = new Particles(this)
    this.audio = new Audio()
    // Last, so the overlay draws over everything else.
    this.debug = new Debug(this)

    this.cam = new Camera(this, this.level.widthPx, this.level.heightPx)
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

    this.player.update(dt, this.controls, this.level.solids)
    this.level.claim(this.player.x)
    this.react()
    // The dash hitstop freezes the player; hold the effects too, so the
    // whole picture stops rather than just the figure.
    if (!this.player.frozen()) this.particles.update(dt)

    // The lane's pit is safe, so this only catches running off the end of
    // what has been built.
    if (this.player.y > this.level.heightPx + TILE * 2) this.respawn()

    this.debug.update(
      this.player,
      this.level.solids,
      this.game.loop.actualFps,
      this.audio,
    )
  }

  private respawn(): void {
    const at = this.level.respawnPoint()
    this.player.reset(at.x, at.y, this.level.solids)
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

    // Small shards kicked up as each foot comes down.
    if (p.justFootstep) this.particles.burst(p.x, foot, PARTICLES_FOOTSTEP, -p.facing * 30)
  }
}
