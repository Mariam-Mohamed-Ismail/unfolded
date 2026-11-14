import * as Phaser from 'phaser'
import { CONTROLS } from '../ui/controls.ts'
import { Menu } from '../ui/Menu.ts'
import { rotAbout } from '../geom.ts'
import { roomGroups } from '../levels/index.ts'
import { roomLabel } from '../Records.ts'
import type { Audio } from '../Audio.ts'
import type { Records } from '../Records.ts'
import type { Flow } from '../Flow.ts'
import type { MenuItem } from '../ui/Menu.ts'
import type { Point } from '../geom.ts'
import {
  COLOR_FOLD,
  COLOR_INK,
  COLOR_PAPER,
  DRIFT_ALPHA,
  DRIFT_HZ,
  DRIFT_PX,
  DRIFT_R,
  DRIFT_SPIN,
  DRIFT_TRIS,
  GAME_WIDTH,
  MENU_TOP,
  MENU_TOP_LIST,
  MENU_TOP_ROOMS,
  SUBTITLE_FONT_PX,
  TITLE_FONT_PX,
  TITLE_Y,
} from '../constants.ts'

const INK = '#' + COLOR_INK.toString(16).padStart(6, '0')
const TAU = Math.PI * 2

type Page = 'main' | 'rooms' | 'controls'

export class MainMenuScene extends Phaser.Scene {
  private menu!: Menu
  private drift!: Phaser.GameObjects.Graphics
  private subtitle!: Phaser.GameObjects.Text
  private page: Page = 'main'
  private clock = 0

  constructor() {
    super('MainMenu')
  }

  create(): void {
    const flow = this.registry.get('flow') as Flow
    flow.enter(this)

    // Behind everything: the drifting origami shape.
    this.drift = this.add.graphics()
    this.drift.setDepth(0)

    this.add
      .text(GAME_WIDTH / 2, TITLE_Y, 'Unfolded', {
        fontFamily: 'monospace',
        fontSize: `${TITLE_FONT_PX}px`,
        color: INK,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(5)

    this.subtitle = this.add
      .text(GAME_WIDTH / 2, TITLE_Y + 46, '', {
        fontFamily: 'monospace',
        fontSize: `${SUBTITLE_FONT_PX}px`,
        color: INK,
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(5)

    this.menu = new Menu(this, MENU_TOP)
    this.show('main')
  }

  update(_time: number, delta: number): void {
    this.clock += delta / 1000
    this.menu.update()
    this.drawDrift()
  }

  /** Swaps the page without rebuilding the widget. */
  private show(page: Page): void {
    this.page = page
    this.subtitle.setText(page === 'controls' ? CONTROLS.join('\n') : '')
    this.subtitle.setVisible(page === 'controls')
    // The controls page is a list of bindings, so its one button moves down
    // out of the way rather than sitting on top of them.
    // Room select is a long page, so it gets shorter rows and starts high.
    this.menu.setCompact(page === 'rooms')
    this.menu.setTop(
      page === 'rooms'
        ? MENU_TOP_ROOMS
        : page === 'controls'
          ? MENU_TOP_LIST
          : MENU_TOP,
    )
    this.menu.setItems(this.itemsFor(page))
  }

  private itemsFor(page: Page): MenuItem[] {
    const flow = this.registry.get('flow') as Flow
    const audio = this.registry.get('audio') as Audio

    if (page === 'rooms') {
      // Straight from the level data, so a new level's rooms appear here
      // without this file changing.
      const records = this.registry.get('records') as Records
      const items: MenuItem[] = []
      // Grouped straight from the level data: a new level brings its own
      // heading and rooms without this file changing.
      for (const group of roomGroups()) {
        // No choose: a heading, which the cursor and the mouse skip.
        items.push({ label: () => group.name })
        for (const choice of group.choices) {
          items.push({
            // A function, so a record set this session shows up without
            // the page being rebuilt.
            label: () => roomLabel(choice.name, records?.get(choice.room)),
            choose: () =>
              flow.startGame({ level: choice.level, roomId: choice.room }),
          })
        }
      }
      items.push({ label: () => 'Back', choose: () => this.show('main') })
      return items
    }

    if (page === 'controls') {
      return [{ label: () => 'Back', choose: () => this.show('main') }]
    }

    return [
      { label: () => 'Play', choose: () => flow.startGame({}) },
      { label: () => 'Room select', choose: () => this.show('rooms') },
      { label: () => 'Controls', choose: () => this.show('controls') },
      {
        // A function, so it reads the live mute state rather than whatever
        // it was when the page was built.
        label: () => (audio.muted ? 'Sound: off' : 'Sound: on'),
        choose: () => audio.toggleMute(),
      },
    ]
  }

  /**
   * A slow origami shape behind the title: a few big triangles turning
   * about the same point and breathing in and out. Faint enough to read as
   * texture rather than as a picture.
   */
  private drawDrift(): void {
    const g = this.drift
    g.clear()
    const cx = GAME_WIDTH / 2
    const cy = TITLE_Y + 10 + Math.sin(this.clock * DRIFT_HZ * TAU) * DRIFT_PX
    const o: Point = [cx, cy]
    g.lineStyle(2, this.page === 'main' ? COLOR_FOLD : COLOR_INK, DRIFT_ALPHA)
    g.fillStyle(COLOR_PAPER, DRIFT_ALPHA)
    for (let i = 0; i < DRIFT_TRIS; i++) {
      const a = this.clock * DRIFT_SPIN + (i / DRIFT_TRIS) * TAU
      const tri: Point[] = [
        [cx + DRIFT_R, cy],
        [cx - DRIFT_R * 0.5, cy + DRIFT_R * 0.7],
        [cx - DRIFT_R * 0.5, cy - DRIFT_R * 0.7],
      ].map((p) => rotAbout(p as Point, a, o))
      g.fillTriangle(tri[0][0], tri[0][1], tri[1][0], tri[1][1], tri[2][0], tri[2][1])
      g.strokeTriangle(tri[0][0], tri[0][1], tri[1][0], tri[1][1], tri[2][0], tri[2][1])
    }
  }
}
