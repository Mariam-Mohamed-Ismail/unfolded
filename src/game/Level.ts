import * as Phaser from 'phaser'
import { Checkpoint } from './entities/Checkpoint.ts'
import { Room } from './Room.ts'
import { createRegistry } from './entities/EntityRegistry.ts'
import { COLOR_SOLID, PLAYER_H, TILE } from './constants.ts'
import type { EntityRegistry } from './entities/EntityRegistry.ts'
import type { Buttons, EntityWorld, Fx } from './entities/Entity.ts'
import type { LevelData } from './levels/types.ts'
import type { Solid, Updraft } from './Player.ts'

/**
 * Just enough of the player for the level to place them, measure them and
 * tell its entities what they just did. Player satisfies this as it is.
 */
export type PlayerLike = {
  x: number
  y: number
  vx: number
  grounded: boolean
  justJumped: boolean
  justDashed: boolean
  justFolded: boolean
  halfW: () => number
  halfH: () => number
}

/** Used until the scene hands over the real one. */
const NO_FX: Fx = {
  dust: () => {},
  shake: () => {},
  zoom: () => {},
  sound: () => {},
  label: () => {},
  hum: () => {},
}

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
    player: {
      box: { left: 0, right: 0, top: 0, bottom: 0 },
      grounded: false,
      speed: 0,
      jumped: false,
      dashed: false,
      folded: false,
      sword: false,
      slash: false,
      failedAt: null,
    },
    fx: NO_FX,
  }
  /** Set by failedAt(), consumed by the next update. */
  private failed: number | null = null
  /** Set by pressed(), consumed by the next update. */
  private buttons: Buttons = { sword: false, slash: false }

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

  /**
   * Start inside a particular room, which is what the menu's room select
   * does. Returns where to put the player; an unknown id falls back to the
   * level's own spawn rather than failing.
   */
  startAt(roomId: string): { x: number; y: number } {
    const room = this.rooms.find((r) => r.id === roomId)
    if (!room) {
      console.warn(`Level: no room with id "${roomId}", starting at the spawn`)
      return this.startPoint()
    }
    this.enter(room)
    return this.respawnPoint()
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

    // One world object, rewritten in place: entities see where the player
    // is, what they just did, and how to ask the scene for an effect.
    const hw = player.halfW()
    const hh = player.halfH()
    const sense = this.world.player
    sense.box.left = player.x - hw
    sense.box.right = player.x + hw
    sense.box.top = player.y - hh
    sense.box.bottom = player.y + hh
    sense.grounded = player.grounded
    sense.speed = Math.abs(player.vx)
    sense.jumped = player.justJumped
    sense.dashed = player.justDashed
    sense.folded = player.justFolded
    sense.sword = this.buttons.sword
    sense.slash = this.buttons.slash
    // One frame only, like the player's own event flags.
    sense.failedAt = this.failed
    this.failed = null
    this.buttons = { sword: false, slash: false }
    this.world.fx = fx

    this.current?.update(dt, this.world)
  }

  /**
   * Is anything moving the air where the player is? Asked before the player
   * moves, so a draught takes effect on the same frame you step into it.
   */
  updraftAt(player: PlayerLike): Updraft | null {
    const room = this.current
    if (!room) return null
    const hw = player.halfW()
    const hh = player.halfH()
    const box = {
      left: player.x - hw,
      right: player.x + hw,
      top: player.y - hh,
      bottom: player.y + hh,
    }
    for (const entity of room.entities) {
      const lift = entity.draughtAt(box)
      if (lift) return lift
    }
    return null
  }

  /**
   * The player muffed it here: a reset, or a fall into a pit. Consumed by
   * the next update, which is what lets a prompt count failures at its own
   * spot without knowing what counts as one.
   */
  failedAt(x: number): void {
    this.failed = x
  }

  /**
   * Button edges for the entities that answer to them. They come from Input
   * rather than from the player, so they are handed in the same way a
   * failure is: set now, consumed by the next update.
   */
  pressed(buttons: Buttons): void {
    this.buttons = buttons
  }

  /** Has the player reached the way out? */
  finished(): boolean {
    return this.entities.byType('ExitDoor').some((e) => e.done())
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
