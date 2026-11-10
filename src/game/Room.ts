import { Checkpoint } from './entities/Checkpoint.ts'
import { TILE } from './constants.ts'
import type { Entity, EntityWorld } from './entities/Entity.ts'
import type { EntityRegistry } from './entities/EntityRegistry.ts'
import type { RoomSpec } from './levels/types.ts'

/**
 * A stretch of the level that resets as a unit: bounds, a checkpoint, and
 * the entities that live inside it.
 *
 * Membership is geometric — an entity belongs to the room its middle falls
 * in — so moving something in the level data moves it between rooms with no
 * second list to keep in step.
 */
export class Room {
  readonly id: string
  readonly name: string
  /** Pixel bounds. `right` is exclusive, so a boundary belongs to one room. */
  readonly left: number
  readonly right: number
  readonly entities: Entity[] = []
  readonly checkpoint: Checkpoint | null

  constructor(spec: RoomSpec, registry: EntityRegistry) {
    this.id = spec.id
    this.name = spec.name
    this.left = spec.from * TILE
    this.right = spec.to * TILE

    for (const entity of registry.all) {
      if (this.contains(entity.centerX())) this.entities.push(entity)
    }

    const found = registry.byId(spec.checkpoint)
    this.checkpoint = found instanceof Checkpoint ? found : null
    if (!this.checkpoint) {
      console.warn(`Room ${this.id}: no Checkpoint with id "${spec.checkpoint}"`)
    }
  }

  contains(x: number): boolean {
    return x >= this.left && x < this.right
  }

  /** Every entity in this room back to its starting state. */
  reset(): void {
    for (const entity of this.entities) entity.reset()
  }

  update(dt: number, world: EntityWorld): void {
    for (const entity of this.entities) entity.update(dt, world)
  }
}
