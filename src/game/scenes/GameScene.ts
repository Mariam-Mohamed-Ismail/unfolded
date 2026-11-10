import * as Phaser from 'phaser'
import { Camera } from '../Camera.ts'
import { Debug } from '../Debug.ts'
import { Hud } from '../Hud.ts'
import { Input } from '../Input.ts'
import { Labels } from '../Labels.ts'
import { Level } from '../Level.ts'
import { Particles } from '../Particles.ts'
import { Player } from '../Player.ts'
import { LEVELS } from '../levels/index.ts'
import type { Audio } from '../Audio.ts'
import type { Flow } from '../Flow.ts'
import type { GameStart } from '../Flow.ts'
import type { Fx } from '../entities/Entity.ts'
import {
  SHAKE_LAND_TILES,
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
  /** One Graphics every entity draws into, cleared each frame. */
  private entityGfx!: Phaser.GameObjects.Graphics
  private labels!: Labels
  private hud!: Hud
  private fx!: Fx

  /** What the menu started us with. */
  private start: GameStart = {}
  /** Seconds since this run began, and how many resets it took. */
  private elapsed = 0
  private resets = 0
  /** Latched, so finishing is reported once rather than every frame. */
  private reported = false

  constructor() {
    super('Game')
  }

  init(data: GameStart): void {
    this.start = data ?? {}
    this.elapsed = 0
    this.resets = 0
    this.reported = false
  }

  create(): void {
    const flow = this.registry.get('flow') as Flow
    flow.enter(this)
    this.audio = this.registry.get('audio') as Audio

    this.level = new Level(LEVELS[this.start.level ?? 0] ?? LEVELS[0])
    this.level.draw(this)
    // After the static floor and before the player, so a step that unfolds
    // sits on top of the ground and behind the figure.
    this.entityGfx = this.add.graphics()

    this.controls = new Input(this)
    // Room select starts you inside a room rather than at the level spawn.
    const at = this.start.roomId
      ? this.level.startAt(this.start.roomId)
      : this.level.startPoint()
    this.player = new Player(this, at.x, at.y, this.level.solids)
    // After the player, so paper lands on top of the figure.
    this.particles = new Particles(this)
    this.hud = new Hud(this)
    // Last, so the overlay draws over everything else.
    this.debug = new Debug(this)

    this.cam = new Camera(this, this.level.widthPx, this.level.heightPx)
    this.cam.follow(this.player.x, this.player.y)

    // What entities are allowed to make happen. Wired once, here, so no
    // component ever imports Particles, Camera or Audio.
    this.labels = new Labels(this)
    this.fx = {
      dust: (x, y, count, color) => this.particles.burst(x, y, count, 0, color),
      shake: (px, ms) => this.cam.shake(px, ms),
      zoom: () => this.cam.zoomPulse(),
      sound: (name) => {
        if (name === 'fold') this.audio.fold()
        else if (name === 'pickup') this.audio.arpeggio()
        else this.audio.whoosh()
      },
      label: (id, x, y, text, size, alpha) =>
        this.labels.show(id, x, y, text, size, alpha),
      hum: (id, level) => this.audio.hum(id, level),
    }

    // "Restart room" from the pause overlay takes the same path Backspace
    // does. Registered on the game-wide emitter, so it has to come off
    // again: a restarted Game scene would otherwise stack handlers and
    // respawn twice.
    const onRestart = (): void => this.respawn()
    this.game.events.on('game:restartRoomNow', onRestart)
    this.events.once('shutdown', () => {
      this.game.events.off('game:restartRoomNow', onRestart)
    })
  }

  update(_time: number, delta: number): void {
    // Phaser hands us milliseconds; everything downstream works in seconds.
    // The clamp stops a tab-switch stall from teleporting us through a wall.
    const dt = Math.min(delta, MAX_DT_MS) / 1000
    this.elapsed += dt

    this.controls.update()
    if (this.controls.mutePressed) this.audio.toggleMute()
    if (this.controls.debugPressed) this.debug.toggle()
    this.debug.handle(this.controls)
    if (this.controls.resetPressed) this.respawn()
    // Reported, not acted on: this scene does not know what Esc leads to.
    if (this.controls.pausePressed) this.game.events.emit('game:pause')

    // Asked before the player moves, so stepping into a draught lifts you
    // on that frame rather than the next one.
    const lift = this.level.updraftAt(this.player)
    this.player.update(dt, this.controls, this.level.solids, lift)
    this.cam.update(this.player.facing, this.player.x, this.player.y, dt)

    // R and J come from Input, not from the player, so they are handed to
    // the level the same way a failure is.
    this.level.pressed({
      sword: this.controls.swordPressed,
      slash: this.controls.slashPressed,
    })

    // Landing below the main floor means the pit: the one failure in this
    // level that is not a reset, and one the prompts count.
    if (this.player.justLanded && this.player.footY() > this.level.surfaceY(0) + 1) {
      this.level.failedAt(this.player.x)
    }

    // Follows the player between rooms and ticks the one they are in.
    this.level.update(dt, this.player, this.fx)
    // After update, so these only quiet what nothing asked for.
    this.labels.sweep()
    this.audio.humSweep()
    this.entityGfx.clear()
    this.level.render(this.entityGfx)
    this.react()
    // The dash hitstop freezes the player; hold the effects too, so the
    // whole picture stops rather than just the figure.
    if (!this.player.frozen()) this.particles.update(dt)

    // The lane's pit is safe, so this only catches running off the end of
    // what has been built.
    if (this.player.y > this.level.heightPx + TILE * 2) this.respawn()

    this.hud.update(
      this.level.room()?.name ?? '',
      this.elapsed,
      this.resets,
    )

    this.debug.update(
      this.player,
      this.level.solids,
      this.game.loop.actualFps,
      this.audio,
    )

    // The one thing this scene says about the flow: what happened. Which
    // scene comes next is Flow's business, not this one's.
    if (!this.reported && this.level.finished()) {
      this.reported = true
      this.game.events.emit('level:finished', {
        time: this.elapsed,
        resets: this.resets,
      })
    }
  }

  private respawn(): void {
    this.resets++
    // Reported before the player is moved, so a prompt counts the failure
    // where it happened rather than at the checkpoint.
    this.level.failedAt(this.player.x)
    // The room's contents first, then the player, so nothing is left
    // half-solved behind them.
    this.level.resetRoom()
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
      // Only a real drop shakes. Measured in tiles fallen, so a jump that
      // lands back where it started never does.
      if (p.fallDrop > SHAKE_LAND_TILES * TILE) {
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

    // A tick and a few shards as each foot comes down.
    if (p.justFootstep) {
      this.audio.footstep()
      this.particles.burst(p.x, foot, PARTICLES_FOOTSTEP, -p.facing * 30)
    }
  }
}
