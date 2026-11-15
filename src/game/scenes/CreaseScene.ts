import * as Phaser from 'phaser'
import { Menu } from '../ui/Menu.ts'
import { nextRound, rounds, setCrease } from '../Upgrades.ts'
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
 * "Choose a crease": two paper cards, one upgrade each. Shown twice in a run
 * — before Level 2 and before Level 3 — with a different pair each time, and
 * the second choice adds to the first rather than replacing it.
 *
 * Which pair is on the table is not this scene's decision: it asks Upgrades
 * for the round that is outstanding, so the screen is the same screen and
 * only the cards differ.
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

    // Nothing outstanding should never get here, but if it does, hand the
    // player straight on rather than showing an empty table.
    const round = nextRound()
    if (!round) {
      flow.resume()
      return
    }

    this.add
      .text(GAME_WIDTH / 2, TITLE_Y, 'Choose a crease', {
        fontFamily: 'monospace',
        fontSize: `${TITLE_FONT_PX * 0.62}px`,
        color: INK,
      })
      .setOrigin(0.5, 0.5)

    // The second time round the first crease is kept, so the line that says
    // "one fold" would be a lie.
    const blurb =
      rounds() === 0
        ? 'one fold, for the rest of the run'
        : 'another fold - you keep the first'

    this.add
      .text(GAME_WIDTH / 2, TITLE_Y + 50, blurb, {
        fontFamily: 'monospace',
        fontSize: `${SUBTITLE_FONT_PX}px`,
        color: INK,
      })
      .setOrigin(0.5, 0.5)

    // Row before items: the text size is fixed when the labels are made.
    this.menu = new Menu(this, CARD_TOP)
    this.menu.setRow(true)
    this.menu.setItems(
      round.map((c) => ({
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
