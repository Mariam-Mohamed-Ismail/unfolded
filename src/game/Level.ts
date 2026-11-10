import * as Phaser from 'phaser'
import { Checkpoint } from './entities/Checkpoint.ts'
import { Room } from './Room.ts'
import { createRegistry } from './entities/EntityRegistry.ts'
import { COLOR_SOLID, PLAYER_H, TILE } from './constants.ts'
import type { EntityRegistry } from './entities/EntityRegistry.ts'
import type { EntityWorld, Fx } from './entities/Entity.ts'
import type { LevelData } from './levels/types.ts'
import type { Solid } from './Player.ts'

/** Just enough of the player for the level to place and measure them. */
export type PlayerLike = {
  x: number
  y: number
  halfW: () => number
  halfH: () => number
}

/** Used until the scene hands over the real one. */
const NO_FX: Fx = { dust: () => {}, shake: () => {}, fold: () => {} }

/**
 * Turns level data into something the scene can use: pixel rectangles to
 * collide with, the entities the data asks for, and the rooms they sit in.
 *
 * Every solid runs from its top surface down to the bottom of the world, so
 * the ground is solid all the way down and a pit is simply a shorter column.
 */
export class Level {
  readonly solids: Solid[] = []
  readonly entities: EntityRegistry
  readonly rooms: Room[] = []
  readonly checkpoints: Checkpoint[] = []
  readonly widthPx: number
  readonly heightPx: number

  // Not parameter properties: erasableSyntaxOnly forbids those.
  private data: LevelData
  private current: Room | null = null
  private world: EntityWorld = {
    player: { left: 0, right: 0, top: 0, bottom: 0 },
    fx: NO_FX,
  }

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

    // Entities first, then rooms: a room resolves its checkpoint and gathers
    // its contents out of the registry.
    this.entities = createRegistry()
    this.entities.build(data.entities, {
      tileX: (x) => x * TILE,
      surfaceY: (h) => this.surfaceY(h),
      // A platform that unfolds puts itself into the collision list the
      // player is already colliding against, and takes itself back out on a
      // reset. The list stays owned here.
      addSolid: (s) => {
        if (!this.solids.includes(s)) this.solids.push(s)
      },
      removeSolid: (s) => {
        const at = this.solids.indexOf(s)
        if (at >= 0) this.solids.splice(at, 1)
      },
    })
    for (const entity of this.entities.all) {
      if (entity instanceof Checkpoint) this.checkpoints.push(entity)
    }
    for (const spec of data.rooms) this.rooms.push(new Room(spec, this.entities))

    this.enter(this.roomAt(this.startPoint().x) ?? this.rooms[0] ?? null)
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

  /** The room the player is in. */
  room(): Room | null {
    return this.current
  }

  roomAt(x: number): Room | undefined {
    return this.rooms.find((r) => r.contains(x))
  }

  /**
   * Follows the player from room to room and ticks whatever is in the room
   * they are in. Nothing outside it needs a frame: a fan four rooms away has
   * nothing to do.
   */
  update(dt: number, player: PlayerLike, fx: Fx = NO_FX): void {
    const room = this.roomAt(player.x)
    // Past the built part of the world roomAt finds nothing. Stay where we
    // are rather than losing the room the player would reset to.
    if (room && room !== this.current) this.enter(room)

    // One world object, rewritten in place: entities see the player's box
    // this frame and can ask the scene for dust, a shake or a crinkle.
    const hw = player.halfW()
    const hh = player.halfH()
    this.world.player.left = player.x - hw
    this.world.player.right = player.x + hw
    this.world.player.top = player.y - hh
    this.world.player.bottom = player.y + hh
    this.world.fx = fx

    this.current?.update(dt, this.world)
  }

  /**
   * Entities draw into one Graphics the scene clears each frame. All of
   * them, not just the current room's: at the right-hand end of the lane the
   * camera can already see into 1A, and the stairs should be visible before
   * you get there.
   */
  render(g: Phaser.GameObjects.Graphics): void {
    for (const entity of this.entities.all) entity.draw(g)
  }

  /** Centre of the player at the current room's checkpoint. */
  respawnPoint(): { x: number; y: number } {
    const cp = this.current?.checkpoint
    if (!cp) return this.startPoint()
    return cp.respawn()
  }

  /** What Backspace does: the room's contents back to their start. */
  resetRoom(): void {
    this.current?.reset()
  }

  /** The whole level: every entity, and back to the room the player spawns in. */
  reset(): void {
    this.entities.reset()
    this.enter(this.roomAt(this.startPoint().x) ?? this.rooms[0] ?? null)
  }

  /**
   * Entering a room restores it, so walking back into a room you half-solved
   * presents it fresh rather than mid-puzzle.
   */
  private enter(room: Room | null): void {
    this.current = room
    room?.reset()
  }
}
