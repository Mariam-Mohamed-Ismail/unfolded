// One room, stepped in exactly the order GameScene steps it.
//
// Shared by the recorder (tests/record.mjs) and the checker
// (tests/solutions-check.mjs) on purpose: if the two stepped in different
// orders, a recording made by one would not replay in the other, and the
// check would be testing the harness rather than the game.
import { scene } from './stub-scene.mjs'
import { Level } from '../src/game/Level.ts'
import { Player } from '../src/game/Player.ts'
import { Sword } from '../src/game/Sword.ts'
import { Health } from '../src/game/Health.ts'
import { FIXED_DT } from '../src/game/constants.ts'

export const blankInput = () => ({
  dir: 0,
  jumpPressed: false,
  jumpReleased: false,
  jumpHeld: false,
  dashPressed: false,
  flatHeld: false,
  swordPressed: false,
  slashPressed: false,
  resetPressed: false,
})

/**
 * A room at its checkpoint, with the room reset — which is what F2 and F3
 * both do before they start (GameScene.toRoomStart).
 */
export function openRoom(data, roomId) {
  const level = new Level(data)
  const at = level.startAt(roomId)
  const p = new Player(scene, at.x, at.y, level.solids)
  const sword = new Sword()
  const health = new Health()
  const input = blankInput()
  const log = { sounds: [] }
  const fx = {
    dust: () => {},
    shake: () => {},
    zoom: () => {},
    sound: (n) => log.sounds.push(n),
    label: () => {},
    hum: () => {},
  }
  let hits = 0

  /** One fixed step, in GameScene's order. */
  const step = () => {
    const lift = level.updraftAt(p)
    p.update(FIXED_DT, input, level.solids, lift, sword.speedScale())
    level.pressed({ sword: input.swordPressed, slash: input.slashPressed })
    health.update(FIXED_DT)
    level.update(FIXED_DT, p, fx)
    const from = level.dangerAt(level.boxOf(p))
    if (from !== null && health.take()) {
      hits++
      p.hurt(Math.sign(p.x - from) || 1)
    }
    sword.update(FIXED_DT, p, input.slashPressed, level, fx)
    if (input.resetPressed) {
      level.resetRoom()
      const back = level.respawnPoint()
      p.reset(back.x, back.y, level.solids)
    }
    // One-frame events, cleared the way Input clears them.
    input.jumpPressed = false
    input.jumpReleased = false
    input.dashPressed = false
    input.swordPressed = false
    input.slashPressed = false
    input.resetPressed = false
  }

  step()
  return { level, p, sword, health, input, step, log, hits: () => hits }
}
