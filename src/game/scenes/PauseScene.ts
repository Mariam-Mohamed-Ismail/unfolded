import * as Phaser from 'phaser'
import { CONTROLS } from '../ui/controls.ts'
import { Menu } from '../ui/Menu.ts'
import { roomChoices } from '../levels/index.ts'
import type { Audio } from '../Audio.ts'
import type { MenuItem } from '../ui/Menu.ts'
import {
  COLOR_INK,
  COLOR_PAPER,
  GAME_HEIGHT,
  GAME_WIDTH,
  MENU_FOLD_PX,
  PAUSE_DIM,
  PAUSE_PANEL_PAD,
  PAUSE_PANEL_W,
  PAUSE_TITLE_Y,
  PAUSE_TOP,
  PAUSE_TOP_LIST,
  SUBTITLE_FONT_PX,
  TITLE_FONT_PX,
} from '../constants.ts'

const INK = '#' + COLOR_INK.toString(16).padStart(6, '0')

type Page = 'main' | 'rooms' | 'controls'

/**
 * The pause overlay. Runs alongside the Game scene rather than instead of
 * it: Game is paused, which stops every dt-driven clock in the game at
 * once, but a paused scene still renders, so it stays on screen underneath.
 *
 * Like every other scene it only reports what the player chose. Flow is
 * what resumes, restarts or quits.
 */
export class PauseScene extends Phaser.Scene {
  private menu!: Menu
  private panel!: Phaser.GameObjects.Graphics
  private list!: Phaser.GameObjects.Text
  private page: Page = 'main'
  private esc: Phaser.Input.Keyboard.Key[] = []
  private escHeld = true

  constructor() {
    super('Pause')
  }

  create(): void {
    this.panel = this.add.graphics()
    this.panel.setDepth(0)

    this.add
      .text(GAME_WIDTH / 2, PAUSE_TITLE_Y, 'Paused', {
        fontFamily: 'monospace',
        fontSize: `${TITLE_FONT_PX * 0.55}px`,
        color: INK,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(5)

    this.list = this.add
      .text(GAME_WIDTH / 2, PAUSE_TITLE_Y + 36, '', {
        fontFamily: 'monospace',
        fontSize: `${SUBTITLE_FONT_PX}px`,
        color: INK,
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(5)

    const kb = this.input.keyboard
    if (kb) this.esc = [kb.addKey('ESC')]
    // Starts held: the press that opened this overlay is still down on this
    // first frame, and reading it as a new press would close it instantly.
    this.escHeld = true

    this.menu = new Menu(this, PAUSE_TOP)
    this.show('main')
  }

  update(): void {
    const down = this.esc.some((k) => k.isDown)
    if (down && !this.escHeld) this.back()
    this.escHeld = down

    this.menu.update()
    this.drawPanel()
  }

  /** Esc backs out of a page, or resumes from the top one. */
  private back(): void {
    if (this.page === 'main') this.game.events.emit('game:resume')
    else this.show('main')
  }

  private show(page: Page): void {
    this.page = page
    this.list.setText(page === 'controls' ? CONTROLS.join('\n') : '')
    this.list.setVisible(page === 'controls')
    this.menu.setTop(page === 'controls' ? PAUSE_TOP_LIST : PAUSE_TOP)
    this.menu.setItems(this.itemsFor(page))
  }

  private itemsFor(page: Page): MenuItem[] {
    const events = this.game.events
    const audio = this.registry.get('audio') as Audio

    if (page === 'rooms') {
      const items: MenuItem[] = roomChoices().map((choice) => ({
        label: () => choice.name,
        choose: () =>
          events.emit('game:restart', { level: choice.level, roomId: choice.room }),
      }))
      items.push({ label: () => 'Back', choose: () => this.show('main') })
      return items
    }

    if (page === 'controls') {
      return [{ label: () => 'Back', choose: () => this.show('main') }]
    }

    return [
      { label: () => 'Resume', choose: () => events.emit('game:resume') },
      { label: () => 'Restart room', choose: () => events.emit('game:restartRoom') },
      { label: () => 'Room select', choose: () => this.show('rooms') },
      { label: () => 'Controls', choose: () => this.show('controls') },
      {
        label: () => (audio.muted ? 'Sound: off' : 'Sound: on'),
        choose: () => audio.toggleMute(),
      },
      { label: () => 'Quit to main menu', choose: () => events.emit('level:quit') },
    ]
  }

  /**
   * A wash over the whole screen and a sheet of paper to put the buttons
   * on, so the frozen game reads as background rather than as clutter.
   */
  private drawPanel(): void {
    const g = this.panel
    g.clear()
    g.fillStyle(COLOR_INK, PAUSE_DIM)
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    const x = (GAME_WIDTH - PAUSE_PANEL_W) / 2
    const y = PAUSE_TITLE_Y - 40
    const h = this.menu.bottom() + PAUSE_PANEL_PAD - y
    const fold = MENU_FOLD_PX
    const points = [
      { x, y },
      { x: x + PAUSE_PANEL_W - fold, y },
      { x: x + PAUSE_PANEL_W, y: y + fold },
      { x: x + PAUSE_PANEL_W, y: y + h },
      { x, y: y + h },
    ]
    g.fillStyle(COLOR_PAPER, 0.95)
    g.fillPoints(points, true)
    g.lineStyle(2, COLOR_INK, 1)
    g.strokePoints(points, true)
    g.lineBetween(x + PAUSE_PANEL_W - fold, y, x + PAUSE_PANEL_W, y + fold)
  }
}
