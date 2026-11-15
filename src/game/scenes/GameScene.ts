import * as Phaser from 'phaser'
import { Camera } from '../Camera.ts'
import { Debug } from '../Debug.ts'
import { Health } from '../Health.ts'
import { Hud } from '../Hud.ts'
import { Input } from '../Input.ts'
import { Labels } from '../Labels.ts'
import { Level } from '../Level.ts'
import { Particles } from '../Particles.ts'
import { Player } from '../Player.ts'
import { Sword } from '../Sword.ts'
import { Ending } from '../Ending.ts'
import { LEVELS } from '../levels/index.ts'
import type { Records } from '../Records.ts'
import type { Room } from '../Room.ts'
import type { Audio } from '../Audio.ts'
import type { Flow } from '../Flow.ts'
import type { FinishedPayload, GameStart } from '../Flow.ts'
import type { Fx } from '../entities/Entity.ts'
import {
  FixedClock,
  Playback,
  Recorder,
  ToolBadge,
  downloadSolution,
  heldOf,
  loadSolution,
  saveSolution,
  tuningDrift,
} from '../Solutions.ts'
import {
  SHAKE_LAND_TILES,
  COLOR_INK,
  END_DEPTH,
  END_TITLE_FONT_PX,
  GAME_HEIGHT,
  GAME_WIDTH,
  COLOR_HURT,
  DEATH_PARTICLES,
  FIXED_DT,
  HURT_BLINK_ALPHA,
  HURT_SHAKE,
  HURT_SHAKE_MS,
  TOOL_NOTE_S,
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
  /**
   * The ending, once the last level's door has been touched. While it runs
   * it owns the frame: no play, no clocks, just the sequence.
   */
  private ending: Ending | null = null
  /** What the level reports, captured at the door so the credits are not timed. */
  private endStats: FinishedPayload | null = null
  private endGfx!: Phaser.GameObjects.Graphics
  private endTitle!: Phaser.GameObjects.Text
  private sword!: Sword
  private fx!: Fx

  /** What the menu started us with. */
  private start: GameStart = {}
  /** Seconds since this run began, how many resets, and how many hits. */
  private elapsed = 0
  private resets = 0
  private hitsTaken = 0
  /** The same two numbers for the room the player is in right now. */
  private roomId: string | null = null
  private roomTime = 0
  private roomResets = 0
  private roomHits = 0
  /**
   * The room itself, not just its id, because banking needs its bounds:
   * a visit counts as finished when the next room begins at or past this
   * room's right edge, which is the level's own rule for having passed an
   * exit. Read per transition rather than off Room.cleared, which is
   * sticky - walking back out of a room cleared earlier would otherwise
   * bank a second, much shorter visit.
   */
  private roomRef: Room | null = null
  private records!: Records
  /** Latched, so finishing is reported once rather than every frame. */
  private reported = false

  /** Turns the display's frame delta into whole 60Hz simulation steps. */
  private clock = new FixedClock()
  /** The player's three hits. Only a level with hazards can spend them. */
  private health = new Health()
  private hazards = false
  /** The dev tools: one or neither is ever active, never both. */
  private recorder: Recorder | null = null
  private playback: Playback | null = null
  private badge!: ToolBadge
  /** The tool's one-line message, and how long it has left. */
  private note = ''
  private noteT = 0

  constructor() {
    super('Game')
  }

  init(data: GameStart): void {
    this.start = data ?? {}
    this.elapsed = 0
    this.resets = 0
    this.hitsTaken = 0
    this.roomId = null
    this.roomTime = 0
    this.roomResets = 0
    this.roomHits = 0
    this.roomRef = null
    this.reported = false
    this.ending = null
    this.endStats = null
  }

  create(): void {
    const flow = this.registry.get('flow') as Flow
    flow.enter(this)
    this.audio = this.registry.get('audio') as Audio
    this.records = this.registry.get('records') as Records

    const data = LEVELS[this.start.level ?? 0] ?? LEVELS[0]
    this.level = new Level(data)
    // Level 1 has nothing that can hurt you, so it shows no health and
    // cannot lose any: the flag gates both the pips and the damage.
    this.hazards = data.hazards === true
    this.health.refill()
    // Per level rather than on the game config, which is what lets Level 2
    // sit on a cooler background while Level 1 keeps its mint.
    this.cameras.main.setBackgroundColor(data.palette.bg)
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
    // The ending draws in screen space, above the world and the HUD.
    this.endGfx = this.add.graphics().setScrollFactor(0).setDepth(END_DEPTH)
    this.endTitle = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Unfolded', {
        fontFamily: 'monospace',
        fontSize: `${END_TITLE_FONT_PX}px`,
        color: '#' + COLOR_INK.toString(16).padStart(6, '0'),
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(END_DEPTH + 1)
      .setAlpha(0)
    // Last, so the overlay draws over everything else.
    this.debug = new Debug(this)
    this.badge = new ToolBadge(this)
    this.clock.reset()

    this.cam = new Camera(
      this,
      this.level.widthPx,
      this.level.heightPx,
      data.camLerpY,
    )
    this.cam.follow(this.player.x, this.player.y)

    // What entities are allowed to make happen. Wired once, here, so no
    // component ever imports Particles, Camera or Audio.
    this.labels = new Labels(this)
    this.sword = new Sword()
    this.fx = {
      dust: (x, y, count, color) => this.particles.burst(x, y, count, 0, color),
      shake: (px, ms) => this.cam.shake(px, ms),
      zoom: () => this.cam.zoomPulse(),
      sound: (name) => {
        if (name === 'fold') this.audio.fold()
        else if (name === 'pickup') this.audio.arpeggio()
        else if (name === 'swoosh') this.audio.swoosh()
        else if (name === 'hit') this.audio.hit()
        else if (name === 'tear') this.audio.tear()
        else if (name === 'sting') this.audio.sting()
        else if (name === 'twang') this.audio.twang()
        else if (name === 'hiss') this.audio.hiss()
        else if (name === 'pop') this.audio.pop()
        else if (name === 'crumple') this.audio.crumple()
        else if (name === 'spit') this.audio.spit()
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

    // Phaser clears this scene's keys when it pauses, so on the way back the
    // held flags have to be re-seeded or Input reports releases that never
    // happened — which would cut a jump held across a pause.
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.controls.resync())
  }

  /**
   * One frame: spend whatever time the display gave us in fixed steps, then
   * draw once. The simulation never sees a variable delta, which is what
   * makes a recorded solution reproducible.
   */
  update(_time: number, delta: number): void {
    const steps = this.clock.advance(delta)
    for (let i = 0; i < steps; i++) this.step()
    this.drawFrame()
  }

  /** One fixed simulation step. `dt` is always the same number. */
  private step(): void {
    const dt = FIXED_DT
    // The ending owns the frame once it has begun: nothing else steps, and
    // the run's clock stays where it was at the door.
    if (this.ending) {
      this.stepEnding(dt)
      return
    }
    this.elapsed += dt

    this.controls.update()
    if (this.controls.mutePressed) this.audio.toggleMute()
    if (this.controls.debugPressed) this.debug.toggle()
    this.debug.handle(this.controls)
    // The dev tools read the real keyboard before playback writes over it, so
    // F3 can always stop a replay that is running.
    if (this.controls.recordPressed) this.toggleRecording()
    if (this.controls.replayPressed) this.toggleReplay()
    // F4: the temporary way to take a hit, until the bat exists. Remove this
    // one line and F4's entry in Input to take it out.
    if (this.controls.hurtPressed) this.hurtPlayer(this.player.x - this.player.facing * TILE)
    this.driveInput()
    if (this.controls.resetPressed) this.respawn()
    // Reported, not acted on: this scene does not know what Esc leads to.
    if (this.controls.pausePressed) this.game.events.emit('game:pause')

    // Asked before the player moves, so stepping into a draught lifts you
    // on that frame rather than the next one.
    const lift = this.level.updraftAt(this.player)
    // The swing holds the player to 60% while the blade is live.
    this.player.update(
      dt,
      this.controls,
      this.level.solids,
      lift,
      this.sword.speedScale(),
    )
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

    this.health.update(dt)
    // Follows the player between rooms and ticks the one they are in.
    this.level.update(dt, this.player, this.fx)

    // Did anything in the room just hit us? Asked, not told: the same shape
    // as the draught question, so no enemy ever reaches into the player.
    const attacker = this.level.dangerAt(this.level.boxOf(this.player))
    if (attacker !== null) this.hurtPlayer(attacker)

    this.sword.update(
      dt,
      this.player,
      this.controls.slashPressed,
      this.level,
      this.fx,
    )
    // After update, so these only quiet what nothing asked for.
    this.labels.sweep()
    this.audio.humSweep()
    // In the step, not the draw: it reads the one-frame events the controller
    // raised, which a frame that ran two steps would otherwise lose.
    this.react()
    // The dash hitstop freezes the player; hold the effects too, so the
    // whole picture stops rather than just the figure.
    if (!this.player.frozen()) this.particles.update(dt)

    // The lane's pit is safe, so this only catches running off the end of
    // what has been built.
    if (this.player.y > this.level.heightPx + TILE * 2) this.respawn()

    // Per-room timing. The room the player is in owns the seconds, and a
    // change of room ends the visit that just ended. Only a visit that
    // left by the exit is banked: walking into 2C and straight back out
    // again is not a run through 2C, and before L3-9 it both took that
    // room's best time and would now have earned it its first star.
    const room = this.level.room()
    if (room && room.id !== this.roomId) {
      // The level's own rule for having passed an exit: the room ahead
      // begins at or past the edge of the one behind.
      const out = this.roomRef !== null && room.left >= this.roomRef.right
      this.bankRoom(out)
      this.roomId = room.id
      this.roomRef = room
      this.roomTime = 0
      this.roomResets = 0
      this.roomHits = 0
      // Health fills at every checkpoint, and every room starts at one.
      this.health.refill()
      // Leaving the room is the natural end of a solution for it.
      if (this.recorder && this.recorder.room !== room.id) this.stopRecording()
    }
    this.roomTime += dt

    // The one thing this scene says about the flow: what happened. Which
    // scene comes next is Flow's business, not this one's.
    if (!this.reported && this.level.finished()) {
      this.reported = true
      // The room you finished in counts as finished however it ends: the
      // last room of a level has nothing to its right to walk into.
      this.bankRoom(true)
      const stats: FinishedPayload = {
        time: this.elapsed,
        resets: this.resets,
        // Which level ended, so the flow knows whether there is another.
        level: this.start.level ?? 0,
        // Only where damage is possible. Left off for Level 1 so its screen
        // reads exactly as it always has rather than claiming a perfect run
        // nothing could have spoiled.
        hits: this.hazards ? this.hitsTaken : undefined,
      }
      // The last level's door plays the ending first; the report waits for
      // it, taken now so twelve seconds of credits are not on the clock.
      if (LEVELS[this.start.level ?? 0]?.ending) this.startEnding(stats)
      else this.game.events.emit('level:finished', stats)
    }
  }

  /**
   * Take the figure apart where it stands. Its nine triangles are handed
   * over in screen space, the figure itself is hidden, and from here the
   * ending owns the frame until it says it is done.
   */
  private startEnding(stats: FinishedPayload): void {
    const cam = this.cameras.main
    const view = cam.worldView
    const tris = this.player.view.pieces().map(
      (t) =>
        t.map(([x, y]): [number, number] => [
          (x - view.x) * cam.zoom,
          (y - view.y) * cam.zoom,
        ]) as [[number, number], [number, number], [number, number]],
    )
    this.player.view.gfx.setVisible(false)
    this.endStats = stats
    this.ending = new Ending(
      tris,
      LEVELS,
      { w: GAME_WIDTH, h: GAME_HEIGHT },
      (step) => this.audio.chime(step),
    )
  }

  /**
   * One step of the ending. Only mute and Enter are read: Esc is not, since
   * a pause menu offering "restart room" in the middle of the credits is a
   * way to break them. When it is over - or skipped - the level reports
   * exactly as any other does, and Flow decides what follows.
   */
  private stepEnding(dt: number): void {
    const ending = this.ending
    if (!ending) return
    this.controls.update()
    if (this.controls.mutePressed) this.audio.toggleMute()
    ending.update(dt, this.controls.skipPressed)
    // Nothing is asking for a fan's hum any more, so let any fade out.
    this.audio.humSweep()
    if (ending.done() && this.endStats) {
      const stats = this.endStats
      this.endStats = null
      this.game.events.emit('level:finished', stats)
    }
  }

  /**
   * Everything that only puts pixels on the screen, once a frame however
   * many steps ran. Nothing here may change game state.
   */
  private drawFrame(): void {
    this.entityGfx.clear()
    this.level.render(this.entityGfx)
    // The blade goes with the figure once the ending has taken it apart.
    if (!this.ending) {
      this.sword.draw(this.entityGfx, this.player, this.level.swordOut())
    }

    // The ending, over everything. Cleared every frame like the rest.
    this.endGfx.clear()
    if (this.ending) {
      this.ending.draw(this.endGfx)
      this.endTitle.setAlpha(this.ending.titleAlpha())
    }

    // The blink through the invulnerable second. The figure is redrawn every
    // frame but alpha lives on the Graphics, so it survives the clear.
    this.player.view.gfx.setAlpha(this.health.blinkOn() ? HURT_BLINK_ALPHA : 1)

    this.hud.update(
      this.level.room()?.name ?? '',
      this.elapsed,
      this.resets,
      this.hazards ? this.health : null,
    )
    this.debug.update(
      this.player,
      this.level.solids,
      this.game.loop.actualFps,
      this.audio,
    )

    if (this.recorder) {
      this.badge.show(`REC ${this.recorder.room}  ${this.recorder.seconds.toFixed(1)}s`)
    } else if (this.playback) {
      this.badge.show(
        `REPLAY ${this.playback.sol.room}  ${this.playback.at}/${this.playback.sol.steps}`,
      )
    } else if (this.note) {
      this.badge.show(this.note)
    } else {
      this.badge.clear()
    }
  }

  // --- health ---

  /**
   * Something hit the player, from `fromX`. The one entry point: the bat
   * will call exactly this, and F4 calls it with a point just behind the
   * player so the throw reads.
   *
   * Nothing happens in a level without hazards, so Level 1 cannot be hurt
   * even with F4 held down.
   */
  private hurtPlayer(fromX: number): void {
    if (!this.hazards) return
    // Health owns the rule: already dead, or still inside the second of
    // invulnerability, and this is not a hit at all.
    if (!this.health.take()) return
    // Counted here, on the one branch that decides a hit landed, so the
    // number on the complete screen cannot drift from the health bar.
    this.hitsTaken++
    // And against the room it happened in, which is what the clean-run
    // star is measured on.
    this.roomHits++

    if (this.health.dead()) {
      this.hurtFeedback()
      this.die()
      return
    }
    // The throw, the hitstop and the hold. react() picks up justHurt and
    // plays the rest.
    this.player.hurt(Math.sign(this.player.x - fromX) || 1)
  }

  /** The thud, the shake and the edge tint: every hit, fatal or not. */
  private hurtFeedback(): void {
    this.audio.thud()
    this.cam.shake(HURT_SHAKE, HURT_SHAKE_MS)
    this.cam.hurtTint()
  }

  /**
   * Out of health: burst into triangles, then exactly what Backspace does —
   * which already resets the room, moves the player to the checkpoint and
   * counts the reset.
   */
  private die(): void {
    this.particles.burst(
      this.player.x,
      this.player.y,
      DEATH_PARTICLES,
      0,
      COLOR_HURT,
    )
    this.respawn()
    this.health.refill()
  }

  // --- the solution recorder (F2) and player (F3) ---

  /** Where a recording or a replay begins: the room's checkpoint, no reset. */
  private toRoomStart(): void {
    this.level.resetRoom()
    const at = this.level.respawnPoint()
    this.player.reset(at.x, at.y, this.level.solids)
    // Health too, by the rule already in place a few lines up: it fills at
    // every checkpoint, and this is a checkpoint. Without it a replay is not
    // reproducible - F3 twice in a room that costs a hit runs the second
    // one on fewer pips, so a hit that knocked the player back the first
    // time is simply ignored the second, and the route comes apart. Found by
    // the state-leak check in tests/solutions-check.mjs on 3C.
    this.health.refill()
  }

  private say(message: string): void {
    this.note = message
    this.noteT = TOOL_NOTE_S
  }

  private toggleRecording(): void {
    if (this.recorder) {
      this.stopRecording()
      return
    }
    if (this.playback) {
      this.playback = null
      this.say('replay stopped')
      return
    }
    const room = this.level.room()
    if (!room) {
      this.say('no room to record')
      return
    }
    this.toRoomStart()
    this.recorder = new Recorder(this.start.level ?? 0, room.id)
    this.note = ''
  }

  private stopRecording(): void {
    const rec = this.recorder
    this.recorder = null
    if (!rec || rec.steps === 0) return
    const sol = rec.toSolution()
    sol.swordOut = this.level.swordOut()
    this.say(`saving ${rec.room}...`)
    saveSolution(sol).then(
      (path) => this.say(`saved ${path}`),
      () => {
        // No dev server, as in a built copy: hand it to the browser instead.
        downloadSolution(sol)
        this.say(`downloaded ${rec.room}.json`)
      },
    )
  }

  private toggleReplay(): void {
    if (this.playback) {
      this.playback = null
      this.say('replay stopped')
      return
    }
    if (this.recorder) this.stopRecording()
    const room = this.level.room()
    if (!room) {
      this.say('no room to replay')
      return
    }
    this.say(`loading ${room.id}...`)
    loadSolution(this.start.level ?? 0, room.id).then(
      (sol) => {
        const drift = tuningDrift(sol)
        if (drift.length > 0) {
          this.say(`retuned since: ${drift.join(' ')}`)
          return
        }
        this.toRoomStart()
        // The blade's drawn state is part of what the recording started
        // from, and a room reset does not touch it - you keep your sword.
        // So set it rather than refuse: the recording's R presses are edges
        // and would otherwise toggle the wrong way.
        if (sol.swordOut !== undefined) {
          this.level.setSwordOut(sol.swordOut)
          if (sol.swordOut !== this.level.swordOut()) {
            this.say(sol.swordOut ? 'needs the sword drawn (R)' : 'needs it sheathed (R)')
            return
          }
        }
        this.playback = new Playback(sol)
        this.note = ''
      },
      (err: Error) => this.say(`${room.id}: ${err.message}`),
    )
  }

  /**
   * Replace the keyboard with the recording, or record what it said. Between
   * the real reads above and anything that consumes input below, so a replay
   * is indistinguishable from playing.
   */
  private driveInput(): void {
    if (this.noteT > 0) {
      this.noteT -= FIXED_DT
      if (this.noteT <= 0) this.note = ''
    }

    const play = this.playback
    if (play) {
      play.apply(this.controls)
      if (play.done) {
        this.playback = null
        this.say('replay finished')
      }
      return
    }

    const rec = this.recorder
    if (rec) {
      rec.sample(heldOf(this.controls))
      if (rec.full) this.stopRecording()
    }
  }

  /**
   * Bank the visit that just ended, if it was finished. Quitting mid-room
   * never reaches this and neither does backing out of a room the way you
   * came: an unfinished visit is not a record, which is what `finished`
   * decides.
   */
  private bankRoom(finished: boolean): void {
    if (this.roomId === null || !finished) return
    this.records.submit(
      this.roomId,
      this.roomTime,
      this.roomResets,
      this.roomHits,
    )
  }

  private respawn(): void {
    this.resets++
    // Against the room it happened in, not the room you respawn into.
    this.roomResets++
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

    if (p.justHurt) this.hurtFeedback()

    if (p.justStood) this.audio.unfold()

    // A tick and a few shards as each foot comes down.
    if (p.justFootstep) {
      this.audio.footstep()
      this.particles.burst(p.x, foot, PARTICLES_FOOTSTEP, -p.facing * 30)
    }
  }
}
