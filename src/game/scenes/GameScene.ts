import * as Phaser from 'phaser'
import {
  COLOR_PLAYER,
  COLOR_SOLID,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_H,
  PLAYER_W,
  TILE,
} from '../constants.ts'

/** An axis-aligned solid, stored by its top-left corner. */
export type Solid = { x: number; y: number; w: number; h: number }

export class GameScene extends Phaser.Scene {
  /** Everything the player can stand on or bump into. */
  solids: Solid[] = []

  constructor() {
    super('GameScene')
  }

  create(): void {
    this.solids = [
      { x: 0, y: GAME_HEIGHT - TILE * 2, w: GAME_WIDTH, h: TILE * 2 },
    ]

    for (const s of this.solids) {
      this.add
        .rectangle(s.x, s.y, s.w, s.h, COLOR_SOLID)
        .setOrigin(0, 0)
    }

    // Rest the player exactly on top of the floor.
    const floorTop = GAME_HEIGHT - TILE * 2
    this.add.rectangle(
      TILE * 5,
      floorTop - PLAYER_H / 2,
      PLAYER_W,
      PLAYER_H,
      COLOR_PLAYER,
    )
  }
}
