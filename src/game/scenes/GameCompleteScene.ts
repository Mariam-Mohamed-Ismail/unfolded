import * as Phaser from 'phaser'
import { Menu } from '../ui/Menu.ts'
import { summarise } from './LevelCompleteScene.ts'
import { clearCreases, creaseName, creases, untaken } from '../Upgrades.ts'
import type { Flow, RunTotals } from '../Flow.ts'
import {
  COLOR_INK,
  GAME_WIDTH,
  MENU_TOP,
  SUBTITLE_FONT_PX,
  TITLE_FONT_PX,
  TITLE_Y,
} from '../constants.ts'

const INK = '#' + COLOR_INK.toString(16).padStart(6, '0')
/** The gap between the lines under the title. */
const LINE = 34

/** The run's totals, as the Level complete line reads, hits always shown. */
export function totalsLine(run: RunTotals): string {
  return summarise({ time: run.time, resets: run.resets, hits: run.hits })
}

/** Which creases came with the player, by card name. */
export function creasesLine(): string {
  const held = creases()
  if (held.length === 0) return 'no creases'
  return 'creases: ' + held.map(creaseName).join(' + ')
}

/**
 * The spec's "a line suggesting to replay with the other creases", built
 * from what was actually passed over rather than written once, so it is
 * right for all four pairs.
 */
export function replayLine(): string {
  const other = untaken().map((c) => c.name)
  if (other.length === 0) return 'Next time, try a different pair of creases.'
  return `Next time, try ${other.join(' and ')}.`
}

/**
 * Play again from the top, with the cards on the table again. Creases are
 * kept for the session, so without this the replay line above would be
 * advice nobody could follow: Level 2 would never ask again.
 */
export function playAgain(flow: Flow): void {
  clearCreases()
  flow.startGame({ level: 0 })
}

/**
 * The end of the game: what the run cost, which folds it was played with,
 * and what to try next time.
 */
export class GameCompleteScene extends Phaser.Scene {
  private menu!: Menu
  private run: RunTotals = { time: 0, resets: 0, hits: 0 }

  constructor() {
    super('GameComplete')
  }

  /** The totals come from Flow, which added them up level by level. */
  init(data: Partial<RunTotals>): void {
    this.run = {
      time: data.time ?? 0,
      resets: data.resets ?? 0,
      hits: data.hits ?? 0,
    }
  }

  create(): void {
    const flow = this.registry.get('flow') as Flow
    flow.enter(this)

    this.add
      .text(GAME_WIDTH / 2, TITLE_Y, 'Game complete', {
        fontFamily: 'monospace',
        fontSize: `${TITLE_FONT_PX * 0.62}px`,
        color: INK,
      })
      .setOrigin(0.5, 0.5)

    const lines = [totalsLine(this.run), creasesLine(), replayLine()]
    lines.forEach((text, i) => {
      this.add
        .text(GAME_WIDTH / 2, TITLE_Y + 50 + i * LINE, text, {
          fontFamily: 'monospace',
          fontSize: `${SUBTITLE_FONT_PX}px`,
          color: INK,
        })
        .setOrigin(0.5, 0.5)
    })

    // Three lines under the title rather than one, so the buttons start
    // lower than on Level complete.
    this.menu = new Menu(this, MENU_TOP + LINE * 2)
    this.menu.setItems([
      { label: () => 'Play again', choose: () => playAgain(flow) },
      { label: () => 'Main menu', choose: () => flow.go('MainMenu') },
    ])
  }

  update(): void {
    this.menu.update()
  }
}
