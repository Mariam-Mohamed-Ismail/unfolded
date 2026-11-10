import { Entity } from './Entity.ts'
import { PLAYER_H } from '../constants.ts'

/**
 * Where a room sends the player back to. No state of its own, so it needs
 * neither update() nor reset() — it is the simplest possible component, and
 * the one that shows what the others plug into.
 */
export class Checkpoint extends Entity {
  /** Centre of the player, standing on this checkpoint's surface. */
  respawn(): { x: number; y: number } {
    return { x: this.centerX(), y: this.y - PLAYER_H / 2 }
  }
}
