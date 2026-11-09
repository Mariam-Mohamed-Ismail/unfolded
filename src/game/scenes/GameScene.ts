import * as Phaser from 'phaser'
import { Input } from '../Input.ts'
import { Player } from '../Player.ts'
import type { Solid } from '../Player.ts'
import {
  COLOR_SOLID,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_DT_MS,
  PLAYER_H,
  TILE,
} from '../constants.ts'

export class GameScene extends Phaser.Scene {
  /** Everything the player can stand on or bump into. */
  solids: Solid[] = []

  // Not `input`: Phaser.Scene already owns that name.
  private controls!: Input
  private player!: Player

  constructor() {
    super('GameScene')
  }

  create(): void {
    this.solids = [
      { x: 0, y: GAME_HEIGHT - TILE * 2, w: GAME_WIDTH, h: TILE * 2 },
    ]

    for (const s of this.solids) {
      this.add.rectangle(s.x, s.y, s.w, s.h, COLOR_SOLID).setOrigin(0, 0)
    }

    const floorTop = GAME_HEIGHT - TILE * 2
    this.controls = new Input(this)
    this.player = new Player(this, TILE * 5, floorTop - PLAYER_H / 2)
  }

  update(_time: number, delta: number): void {
    // Phaser hands us milliseconds; everything downstream works in seconds.
    // The clamp stops a tab-switch stall from teleporting us through a wall.
    const dt = Math.min(delta, MAX_DT_MS) / 1000

    this.controls.update()
    this.player.update(dt, this.controls, this.solids)
  }
}
