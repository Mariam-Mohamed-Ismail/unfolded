import * as Phaser from 'phaser'
import { Menu } from '../ui/Menu.ts'
import { formatTime } from '../ui/format.ts'
import type { FinishedPayload, Flow } from '../Flow.ts'
import {
  COLOR_INK,
  GAME_WIDTH,
  MENU_TOP,
  SUBTITLE_FONT_PX,
  TITLE_FONT_PX,
  TITLE_Y,
} from '../constants.ts'

const INK = '#' + COLOR_INK.toString(16).padStart(6, '0')

/**
 * What the scene shows under the title, from the payload alone.
 *
 * The hits clause is left out entirely when the payload has none, which is
 * how Level 1 — where nothing can hurt you — keeps the line it always had
 * instead of advertising a flawless run.
 */
export function summarise(stats: FinishedPayload): string {
  const resets = stats.resets === 1 ? '1 reset' : `${stats.resets} resets`
  let line = `time ${formatTime(stats.time)}   ${resets}`
  if (stats.hits !== undefined) {
    line += stats.hits === 1 ? '   1 hit' : `   ${stats.hits} hits`
  }
  return line
}

export class LevelCompleteScene extends Phaser.Scene {
  private menu!: Menu
  private stats: FinishedPayload = { time: 0, resets: 0 }

  constructor() {
    super('LevelComplete')
  }

  /** Everything shown here comes from the event, not from a global. */
  init(data: Partial<FinishedPayload>): void {
    this.stats = {
      time: data.time ?? 0,
      resets: data.resets ?? 0,
      level: data.level ?? 0,
      hits: data.hits,
    }
  }

  create(): void {
    const flow = this.registry.get('flow') as Flow
    flow.enter(this)

    this.add
      .text(GAME_WIDTH / 2, TITLE_Y, 'Level complete', {
        fontFamily: 'monospace',
        fontSize: `${TITLE_FONT_PX * 0.62}px`,
        color: INK,
      })
      .setOrigin(0.5, 0.5)

    this.add
      .text(GAME_WIDTH / 2, TITLE_Y + 50, summarise(this.stats), {
        fontFamily: 'monospace',
        fontSize: `${SUBTITLE_FONT_PX}px`,
        color: INK,
      })
      .setOrigin(0.5, 0.5)

    // Finishing a level that has another after it goes on to it, through
    // the crease cards if they have not been seen yet. Finishing the last
    // one offers it again instead.
    const level = this.stats.level ?? 0
    const next = flow.hasNext(level)

    this.menu = new Menu(this, MENU_TOP)
    this.menu.setItems([
      next
        ? {
            label: () => 'Continue',
            choose: () => flow.startGame({ level: level + 1 }),
          }
        : {
            label: () => 'Play again',
            choose: () => flow.startGame({ level }),
          },
      // Not in the spec's list, but without it the room select is
      // unreachable once you have finished.
      { label: () => 'Main menu', choose: () => flow.go('MainMenu') },
    ])
  }

  update(): void {
    this.menu.update()
  }
}
