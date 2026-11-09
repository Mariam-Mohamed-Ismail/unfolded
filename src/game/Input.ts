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

  private dashHeld = false

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard
    if (!kb) throw new Error('Input: no keyboard plugin on this scene')

    this.leftKeys = [kb.addKey('LEFT'), kb.addKey('A')]
    this.rightKeys = [kb.addKey('RIGHT'), kb.addKey('D')]
    this.jumpKeys = [kb.addKey('SPACE'), kb.addKey('W'), kb.addKey('UP')]
    this.dashKeys = [kb.addKey('SHIFT'), kb.addKey('X')]
    this.flatKeys = [kb.addKey('DOWN'), kb.addKey('S')]
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
  }
}
