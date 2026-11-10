import * as Phaser from 'phaser'

function anyDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
  for (const key of keys) {
    if (key.isDown) return true
  }
  return false
}

/**
 * Turns the keyboard into intent. The controller asks this for a direction and
 * for jump edges, never for keys, so rebinding stays a change to this file.
 */
export class Input {
  private leftKeys: Phaser.Input.Keyboard.Key[]
  private rightKeys: Phaser.Input.Keyboard.Key[]
  private jumpKeys: Phaser.Input.Keyboard.Key[]
  private dashKeys: Phaser.Input.Keyboard.Key[]
  private flatKeys: Phaser.Input.Keyboard.Key[]
  private muteKeys: Phaser.Input.Keyboard.Key[]
  private debugKeys: Phaser.Input.Keyboard.Key[]
  private resetKeys: Phaser.Input.Keyboard.Key[]
  private swordKeys: Phaser.Input.Keyboard.Key[]
  private slashKeys: Phaser.Input.Keyboard.Key[]
  private pauseKeys: Phaser.Input.Keyboard.Key[]
  private panelKeys: Phaser.Input.Keyboard.Key[][]
  private pointer: Phaser.Input.Pointer

  /** -1 left, 0 none, 1 right. Holding both cancels to 0. */
  dir = 0

  /** True only on the frame jump goes down. */
  jumpPressed = false

  /** True only on the frame jump comes up. */
  jumpReleased = false

  /** True for every frame jump is down. */
  jumpHeld = false

  /** True only on the frame dash goes down. */
  dashPressed = false

  /** True for every frame the fold key is down. */
  flatHeld = false

  /** True only on the frame the mute key goes down. */
  mutePressed = false

  private muteHeld = false

  /** True only on the frame F1 goes down. */
  debugPressed = false

  /** True only on the frame Backspace goes down. */
  resetPressed = false

  /** True only on the frame R goes down: toggles the sword. */
  swordPressed = false

  /** True only on the frame J or the left mouse button goes down. */
  slashPressed = false

  /** True only on the frame Esc goes down. */
  pausePressed = false

  private swordHeld = false
  private slashHeld = false
  private pauseHeld = false

  /**
   * Debug panel edges: move the cursor, nudge by one step, nudge by ten.
   * Deliberately not the arrow keys or Shift, which are movement and dash:
   * the whole point is to retune while still playing.
   */
  panelPrev = false
  panelNext = false
  panelDown = false
  panelUp = false
  panelDownBig = false
  panelUpBig = false

  private debugHeld = false
  private resetHeld = false
  private panelHeld = [false, false, false, false, false, false]

  private dashHeld = false

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard
    if (!kb) throw new Error('Input: no keyboard plugin on this scene')

    this.leftKeys = [kb.addKey('LEFT'), kb.addKey('A')]
    this.rightKeys = [kb.addKey('RIGHT'), kb.addKey('D')]
    this.jumpKeys = [kb.addKey('SPACE'), kb.addKey('W'), kb.addKey('UP')]
    this.dashKeys = [kb.addKey('SHIFT'), kb.addKey('X')]
    this.flatKeys = [kb.addKey('DOWN'), kb.addKey('S')]
    this.muteKeys = [kb.addKey('M')]
    this.debugKeys = [kb.addKey('F1')]
    this.resetKeys = [kb.addKey('BACKSPACE')]
    this.swordKeys = [kb.addKey('R')]
    this.slashKeys = [kb.addKey('J')]
    this.pauseKeys = [kb.addKey('ESC')]
    // Polled rather than listened for, so a click lands on a frame like
    // every other input instead of arriving between two.
    this.pointer = scene.input.activePointer
    this.panelKeys = [
      [kb.addKey('COMMA')],
      [kb.addKey('PERIOD')],
      [kb.addKey('OPEN_BRACKET')],
      [kb.addKey('CLOSED_BRACKET')],
      [kb.addKey('MINUS')],
      [kb.addKey('PLUS')],
    ]
  }

  /** Call once per frame, before anything reads this. */
  update(): void {
    const left = anyDown(this.leftKeys)
    const right = anyDown(this.rightKeys)
    this.dir = (right ? 1 : 0) - (left ? 1 : 0)

    // Edges are derived here, so a held key can never re-trigger a jump.
    const held = anyDown(this.jumpKeys)
    this.jumpPressed = held && !this.jumpHeld
    this.jumpReleased = !held && this.jumpHeld
    this.jumpHeld = held

    const dash = anyDown(this.dashKeys)
    this.dashPressed = dash && !this.dashHeld
    this.dashHeld = dash

    this.flatHeld = anyDown(this.flatKeys)

    const mute = anyDown(this.muteKeys)
    this.mutePressed = mute && !this.muteHeld
    this.muteHeld = mute

    const debug = anyDown(this.debugKeys)
    this.debugPressed = debug && !this.debugHeld
    this.debugHeld = debug

    const reset = anyDown(this.resetKeys)
    this.resetPressed = reset && !this.resetHeld
    this.resetHeld = reset

    const sword = anyDown(this.swordKeys)
    this.swordPressed = sword && !this.swordHeld
    this.swordHeld = sword

    const slash = anyDown(this.slashKeys) || this.pointer.leftButtonDown()
    this.slashPressed = slash && !this.slashHeld
    this.slashHeld = slash

    const pause = anyDown(this.pauseKeys)
    this.pausePressed = pause && !this.pauseHeld
    this.pauseHeld = pause

    const edges: boolean[] = []
    for (let i = 0; i < this.panelKeys.length; i++) {
      const down = anyDown(this.panelKeys[i])
      edges.push(down && !this.panelHeld[i])
      this.panelHeld[i] = down
    }
    this.panelPrev = edges[0]
    this.panelNext = edges[1]
    this.panelDown = edges[2]
    this.panelUp = edges[3]
    this.panelDownBig = edges[4]
    this.panelUpBig = edges[5]
  }
}
