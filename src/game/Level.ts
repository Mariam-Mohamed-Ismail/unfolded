import * as Phaser from 'phaser'
import type { Solid } from './Player.ts'
import type { LevelData } from './levels/level1.ts'
import { COLOR_SOLID, PLAYER_H, TILE } from './constants.ts'

export type Checkpoint = {
  id: string
  /** Centre of the tile, in pixels. */
  x: number
  /** The surface the player stands on, in pixels. */
  y: number
}

/**
 * Turns level data into something the scene can use: pixel rectangles to
 * collide with, somewhere to start, and the checkpoint you go back to.
 *
 * Every solid runs from its top surface down to the bottom of the world, so
 * the ground is solid all the way down and a pit is simply a shorter column.
 */
export class Level {
  readonly solids: Solid[] = []
  readonly checkpoints: Checkpoint[] = []
  readonly widthPx: number
  readonly heightPx: number

  private reached = 0
  // Not a parameter property: erasableSyntaxOnly forbids those.
  private data: LevelData

  constructor(data: LevelData) {
    this.data = data
    this.widthPx = data.width * TILE
    this.heightPx = data.height * TILE

    for (const s of data.solids) {
      const top = this.surfaceY(s.h)
      this.solids.push({
        x: s.x * TILE,
        y: top,
        w: s.w * TILE,
        h: this.heightPx - top,
      })
    }

    for (const e of data.entities) {
      if (e.type !== 'Checkpoint') continue
      this.checkpoints.push({
        id: e.id,
        x: e.x * TILE + TILE / 2,
        y: this.surfaceY(e.h),
      })
    }
  }

  /** Pixel y of a surface `h` tiles above the floor row. */
  surfaceY(h: number): number {
    return (this.data.floorRow - h) * TILE
  }

  draw(scene: Phaser.Scene): void {
    for (const s of this.solids) {
      scene.add.rectangle(s.x, s.y, s.w, s.h, COLOR_SOLID).setOrigin(0, 0)
    }
  }

  /** Centre of the player at the spawn point. */
  startPoint(): { x: number; y: number } {
    const { x, h } = this.data.spawn
    return { x: x * TILE + TILE / 2, y: this.surfaceY(h) - PLAYER_H / 2 }
  }

  /**
   * Walking past a checkpoint claims it. Only forwards: going back does not
   * un-claim one, so a reset never sends you further back than you reached.
   */
  claim(playerX: number): void {
    for (let i = this.checkpoints.length - 1; i > this.reached; i--) {
      if (playerX >= this.checkpoints[i].x) {
        this.reached = i
        return
      }
    }
  }

  /** Centre of the player at the last checkpoint claimed. */
  respawnPoint(): { x: number; y: number } {
    const cp = this.checkpoints[this.reached]
    if (!cp) return this.startPoint()
    return { x: cp.x, y: cp.y - PLAYER_H / 2 }
  }

  reset(): void {
    this.reached = 0
  }
}
