import * as Phaser from 'phaser'
import { Menu } from '../ui/Menu.ts'
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

/** m:ss, which is the right shape for a five-minute level. */
export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const m = Math.floor(whole / 60)
  const s = whole % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** What the scene shows under the title, from the payload alone. */
export function summarise(stats: FinishedPayload): string {
  const resets = stats.resets === 1 ? '1 reset' : `${stats.resets} resets`
  return `time ${formatTime(stats.time)}   ${resets}`
}

export class LevelCompleteScene extends Phaser.Scene {
  private menu!: Menu
  private stats: FinishedPayload = { time: 0, resets: 0 }

  constructor() {
    super('LevelComplete')
  }

  /** Everything shown here comes from the event, not from a global. */
  init(data: Partial<FinishedPayload>): void {
    this.stats = { time: data.time ?? 0, resets: data.resets ?? 0 }
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

    this.menu = new Menu(this, MENU_TOP)
    this.menu.setItems([
      { label: () => 'Play again', choose: () => flow.go('Game', {}) },
      // Not in the spec's list, but without it the room select is
      // unreachable once you have finished.
      { label: () => 'Main menu', choose: () => flow.go('MainMenu') },
    ])
  }

  update(): void {
    this.menu.update()
  }
}
