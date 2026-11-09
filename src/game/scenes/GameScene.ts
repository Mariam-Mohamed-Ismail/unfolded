import * as Phaser from 'phaser'
import { Input } from '../Input.ts'
import { Player } from '../Player.ts'
import { level1 } from '../levels/level1.ts'
import { COLOR_SOLID, GAME_HEIGHT, MAX_DT_MS, PLAYER_H, TILE } from '../constants.ts'

export class GameScene extends Phaser.Scene {
  // Not `input`: Phaser.Scene already owns that name.
  private controls!: Input
  private player!: Player

  constructor() {
    super('GameScene')
  }

  create(): void {
    for (const s of level1.solids) {
      this.add.rectangle(s.x, s.y, s.w, s.h, COLOR_SOLID).setOrigin(0, 0)
    }

    this.controls = new Input(this)
    this.player = new Player(
      this,
      level1.spawn.x,
      level1.spawn.y - PLAYER_H / 2,
    )
  }

  update(_time: number, delta: number): void {
    // Phaser hands us milliseconds; everything downstream works in seconds.
    // The clamp stops a tab-switch stall from teleporting us through a wall.
    const dt = Math.min(delta, MAX_DT_MS) / 1000

    this.controls.update()
    this.player.update(dt, this.controls, level1.solids)

    // Missing the gap drops you out of the world; put you back at the start.
    if (this.player.y > GAME_HEIGHT + TILE * 2) {
      this.player.reset(level1.spawn.x, level1.spawn.y - PLAYER_H / 2)
    }
  }
}
