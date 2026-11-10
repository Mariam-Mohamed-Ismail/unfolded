import { Checkpoint } from './Checkpoint.ts'
import { Entity } from './Entity.ts'
import { ExitDoor } from './ExitDoor.ts'
import { Fan } from './Fan.ts'
import { FoldPlatform } from './FoldPlatform.ts'
import { Pickup } from './Pickup.ts'
import { PromptTag } from './PromptTag.ts'
import { Slit } from './Slit.ts'
import { Switch } from './Switch.ts'
import type { EntityContext } from './Entity.ts'
import type { EntitySpec } from '../levels/types.ts'

export type EntityFactory = (spec: EntitySpec, ctx: EntityContext) => Entity

/**
 * Turns `type` strings in the level data into entity objects, and holds the
 * ones it built so they can be looked up by id.
 *
 * The table is the whole point: a new component registers itself here and
 * nothing else in the game changes. The level loader never names a type.
 */
export class EntityRegistry {
  readonly all: Entity[] = []

  private factories = new Map<string, EntityFactory>()
  private ids = new Map<string, Entity>()

  register(type: string, make: EntityFactory): this {
    this.factories.set(type, make)
    return this
  }

  /** Builds every spec it recognises, then resolves the links between them. */
  build(specs: readonly EntitySpec[], ctx: EntityContext): void {
    for (const spec of specs) {
      const make = this.factories.get(spec.type)
      if (!make) {
        // A warning, not a throw: the level data can name components that do
        // not exist yet and the rest of the level still loads and plays.
        console.warn(`Level data: no entity type "${spec.type}" (id ${spec.id})`)
        continue
      }
      if (this.ids.has(spec.id)) {
        // Ids are how targets resolve, so a duplicate would silently point
        // the wrong way. Keep the first one.
        console.warn(`Level data: duplicate entity id "${spec.id}", ignoring the second`)
        continue
      }
      const entity = make(spec, ctx)
      this.all.push(entity)
      this.ids.set(entity.id, entity)
    }

    // Linking is a second pass so the data can reference an id further down.
    for (const entity of this.all) entity.link(this.ids)
  }

  byId(id: string): Entity | undefined {
    return this.ids.get(id)
  }

  byType(type: string): Entity[] {
    return this.all.filter((e) => e.type === type)
  }

  /** Every entity back to its starting state. */
  reset(): void {
    for (const entity of this.all) entity.reset()
  }
}

/**
 * The registry the game runs on. One line per component, in one place.
 * Every type the spec's level data names is here.
 */
export function createRegistry(): EntityRegistry {
  return new EntityRegistry()
    .register('Checkpoint', (spec, ctx) => new Checkpoint(spec, ctx))
    .register('Switch', (spec, ctx) => new Switch(spec, ctx))
    .register('FoldPlatform', (spec, ctx) => new FoldPlatform(spec, ctx))
    .register('PromptTag', (spec, ctx) => new PromptTag(spec, ctx))
    .register('Slit', (spec, ctx) => new Slit(spec, ctx))
    .register('Fan', (spec, ctx) => new Fan(spec, ctx))
    .register('Pickup', (spec, ctx) => new Pickup(spec, ctx))
    .register('ExitDoor', (spec, ctx) => new ExitDoor(spec, ctx))
}
