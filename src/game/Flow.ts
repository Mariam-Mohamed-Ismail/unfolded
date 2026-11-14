import * as Phaser from 'phaser'
import { LEVELS } from './levels/index.ts'
import { chosenYet } from './Upgrades.ts'
import { FADE_MS } from './constants.ts'

/**
 * What a finished level reports. `level` says which one ended; `hits` is
 * absent for a level that cannot hurt you.
 */
export type FinishedPayload = {
  time: number
  resets: number
  level?: number
  hits?: number
}

/** What the Game scene is started with. */
export type GameStart = { level?: number; roomId?: string }

/**
 * Who decides which scene runs.
 *
 * The Game scene never names another scene: it reports what happened on the
 * game's event emitter and this routes it. That keeps the direction of
 * knowledge one way — the flow knows about the scenes, the scenes do not
 * know about each other.
 */
export class Flow {
  private game: Phaser.Game
  /** True between a fade starting and the scene swap happening. */
  private pending = false
  /** The game start that is waiting on the crease cards, if any. */
  private held: GameStart | null = null

  constructor(game: Phaser.Game) {
    this.game = game
    const events = this.game.events

    events.on('level:finished', (payload: FinishedPayload) => {
      this.go('LevelComplete', payload)
    })
    events.on('level:quit', () => {
      this.go('MainMenu')
    })

    // The overlay runs alongside Game rather than instead of it: pausing
    // the scene stops its update, which is what stops every dt-driven clock
    // in the game at once. Audio is the one thing living outside the scene,
    // so it is frozen by hand.
    events.on('game:pause', () => {
      if (this.game.scene.isActive('Pause')) return
      const ops = this.ops('Game')
      if (!ops) return
      this.audio()?.setPaused(true)
      ops.pause('Game')
      // A paused scene still renders, which is what makes this an overlay
      // rather than a replacement: the game stays on screen underneath.
      ops.launch('Pause')
    })

    events.on('game:resume', () => {
      const ops = this.ops('Pause')
      if (!ops) return
      ops.stop('Pause')
      ops.resume('Game')
      this.audio()?.setPaused(false)
    })

    // Resumed first, then the running Game scene restarts the room itself:
    // the same path Backspace takes.
    events.on('game:restartRoom', () => {
      const ops = this.ops('Pause')
      if (!ops) return
      ops.stop('Pause')
      ops.resume('Game')
      this.audio()?.setPaused(false)
      events.emit('game:restartRoomNow')
    })

    // A different room means a fresh Game scene. start() stops the calling
    // scene for us, so the overlay goes with it.
    events.on('game:restart', (start: GameStart) => {
      const ops = this.ops('Pause')
      if (!ops) return
      this.audio()?.setPaused(false)
      if (this.needsCrease(start)) {
        this.held = start
        ops.start('Crease')
        return
      }
      ops.start('Game', start)
    })
  }

  /**
   * The one door into the game. Every caller comes through here, so the
   * rule "a level with hazards needs a crease first" lives in one place
   * rather than at each menu that can start a level.
   */
  startGame(start: GameStart = {}): void {
    if (this.needsCrease(start)) {
      this.held = start
      this.go('Crease')
      return
    }
    this.go('Game', start)
  }

  /**
   * Run the start that was waiting on the cards. Called by CreaseScene once
   * a crease has been picked.
   */
  resume(): void {
    const start = this.held ?? {}
    this.held = null
    this.go('Game', start)
  }

  /**
   * A level that can hurt you is a level the creases are for. Keyed off the
   * level's own `hazards` flag rather than its index, the same flag the
   * health pips use, so adding a level needs no change here.
   */
  private needsCrease(start: GameStart): boolean {
    if (chosenYet()) return false
    const data = LEVELS[start.level ?? 0]
    return data?.hazards === true
  }

  /** Is there a level after this one? What "Continue" depends on. */
  hasNext(level: number): boolean {
    return level + 1 < LEVELS.length
  }

  /**
   * Scene operations go through a scene's own ScenePlugin, never through
   * the SceneManager.
   *
   * This is not a style preference. Every ScenePlugin method queues its
   * operation for the top of the next frame, while SceneManager.start and
   * .stop run immediately — and these are all called from inside a scene's
   * update or a camera event, so an immediate shutdown leaves Phaser
   * stepping a dead scene for the rest of the frame. That throws, and a
   * throw inside the requestAnimationFrame callback stops the game loop for
   * good: a blank canvas and nothing you can click.
   */
  private ops(prefer: string): Phaser.Scenes.ScenePlugin | null {
    const wanted = this.game.scene.getScene(prefer)
    if (wanted) return wanted.scene
    const any = this.game.scene.getScenes(false)
    return any.length > 0 ? any[0].scene : null
  }

  private audio(): { setPaused: (p: boolean) => void } | undefined {
    return this.game.registry.get('audio')
  }

  /** Fade whatever is on top out, start the next scene, fade it in. */
  go(key: string, data?: object): void {
    // A second click during the fade would queue a second swap.
    if (this.pending) return

    const from = this.top()
    const ops = from ? from.scene : this.ops(key)
    if (!ops) return

    const swap = (): void => {
      this.pending = false
      // Everything else stops, including a Game scene left paused under an
      // overlay: a paused scene still renders, so leaving it would draw a
      // frozen game behind the menu. start() stops the calling scene, so
      // that one is already handled.
      for (const scene of this.game.scene.getScenes(false)) {
        const sys = scene.sys
        const other = sys.settings.key
        if (other === key || other === ops.key) continue
        if (sys.isActive() || sys.isPaused()) ops.stop(other)
      }
      ops.start(key, data)
    }

    if (!from) {
      swap()
      return
    }

    this.pending = true
    const cam = from.cameras.main
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, swap)
    cam.fadeOut(FADE_MS)
  }

  /** Called by a scene as it starts, so the fade has two halves. */
  enter(scene: Phaser.Scene): void {
    scene.cameras.main.fadeIn(FADE_MS)
  }

  /** The scene a fade should run on: the overlay if there is one. */
  private top(): Phaser.Scene | null {
    const pause = this.game.scene.getScene('Pause')
    if (pause && this.game.scene.isActive('Pause')) return pause
    const scenes = this.game.scene.getScenes(true)
    return scenes.length > 0 ? scenes[0] : null
  }
}
