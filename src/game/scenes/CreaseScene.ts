import * as Phaser from 'phaser'
import { Menu } from '../ui/Menu.ts'
import { CREASES, setCrease } from '../Upgrades.ts'
import type { Flow } from '../Flow.ts'
import {
  CARD_TOP,
  COLOR_INK,
  GAME_WIDTH,
  SUBTITLE_FONT_PX,
  TITLE_FONT_PX,
  TITLE_Y,
} from '../constants.ts'

const INK = '#' + COLOR_INK.toString(16).padStart(6, '0')

/**
 * "Choose a crease": two paper cards, one upgrade each, between Level 1 and
 * Level 2.
 *
 * The cards are the shared Menu in its row mode rather than a second
 * keyboard handler. That is deliberate: Menu's Enter arming is subtle —
 * Enter is armed on key*up* because a key object created mid-hold reads up
 * and the browser's repeat then looks like a fresh press — and writing it
 * again here is how that bug comes back.
 */
export class CreaseScene extends Phaser.Scene {
  private menu!: Menu

  constructor() {
    super('Crease')
  }

  create(): void {
    const flow = this.registry.get('flow') as Flow
    flow.enter(this)

    this.add
      .text(GAME_WIDTH / 2, TITLE_Y, 'Choose a crease', {
        fontFamily: 'monospace',
        fontSize: `${TITLE_FONT_PX * 0.62}px`,
        color: INK,
      })
      .setOrigin(0.5, 0.5)

    this.add
      .text(GAME_WIDTH / 2, TITLE_Y + 50, 'one fold, for the rest of the run', {
        fontFamily: 'monospace',
        fontSize: `${SUBTITLE_FONT_PX}px`,
        color: INK,
      })
      .setOrigin(0.5, 0.5)

    // Row before items: the text size is fixed when the labels are made.
    this.menu = new Menu(this, CARD_TOP)
    this.menu.setRow(true)
    this.menu.setItems(
      CREASES.map((c) => ({
        label: () => `${c.name}\n\n${c.effect}`,
        choose: () => {
          setCrease(c.id)
          // Whatever asked for the game gets it now that the choice exists.
          flow.resume()
        },
      })),
    )
  }

  update(): void {
    this.menu.update()
  }
}
