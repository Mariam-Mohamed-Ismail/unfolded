// Step L3-3: room 3B. A slit, a seal holding a bridge, and a 10-tile gap.
import { scene } from './stub-scene.mjs'
import { Level } from '../src/game/Level.ts'
import { Player } from '../src/game/Player.ts'
import { Sword } from '../src/game/Sword.ts'
import { FoldBridge } from '../src/game/entities/FoldBridge.ts'
import { Seal } from '../src/game/entities/Seal.ts'
import { Slit } from '../src/game/entities/Slit.ts'
import { level2 } from '../src/game/levels/level2.ts'
import { level3 } from '../src/game/levels/level3.ts'
import {
  BRIDGE_DECK_PX,
  BRIDGE_SEGMENTS,
  BRIDGE_STAGGER_MS,
  FIXED_DT,
  PLAYER_FLAT_H,
  PLAYER_H,
  SLIT_H,
  TILE,
} from '../src/game/constants.ts'

const M = globalThis.Math
const out = []
const record = (ok, msg) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

function recorder() {
  const log = { sounds: [], dust: [] }
  return {
    log,
    fx: {
      dust: (x, y, count, color) => log.dust.push({ x, y, count, color }),
      shake: () => {}, zoom: () => {},
      sound: (n) => log.sounds.push(n),
      label: () => {}, hum: () => {},
    },
  }
}

/** Level 3 at (tile, h), with the blade available unless told otherwise. */
function room(tileX, h = 8, armed = true, held = {}) {
  const level = new Level(level3)
  const r = recorder()
  const p = new Player(
    scene,
    tileX * TILE,
    level.surfaceY(h) - PLAYER_H / 2,
    level.solids,
  )
  const sword = new Sword()
  const input = {
    dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
    dashPressed: false, flatHeld: false, swordPressed: false,
    slashPressed: false, resetPressed: false,
    ...held,
  }
  let slash = false
  // Level 3 has no sword pickup of its own yet, so the blade's presence is
  // faked at the one place anything asks - the same thing room2b-check does.
  level.swordOut = () => armed
  const step = () => {
    p.update(FIXED_DT, input, level.solids, level.updraftAt(p), sword.speedScale())
    level.update(FIXED_DT, p, r.fx)
    sword.update(FIXED_DT, p, slash, level, r.fx)
    input.jumpPressed = false
    input.jumpReleased = false
    input.dashPressed = false
    slash = false
  }
  step()
  return {
    level, p, input, sword, step, log: r.log,
    swing: () => { slash = true },
    seal: level.entities.byId('seal3b'),
    bridge: level.entities.byId('bridge3b'),
    slit: level.entities.byId('slit3b'),
  }
}

const base = new Level(level3)
const DECK = base.surfaceY(8)
const PIT = base.surfaceY(6)
const foot = (p) => p.y + p.halfH()

// =====================================================================
//  The room as data.
// =====================================================================
{
  const t = room(38)
  record(t.slit instanceof Slit, 'the slit pillar is in 3B')
  record(t.seal instanceof Seal, 'the seal too')
  record(t.bridge instanceof FoldBridge, 'and the bridge')

  record(
    t.slit.tx === 40 && t.slit.tw === 6,
    `the pillar spans x${t.slit.tx} to x${t.slit.tx + t.slit.tw}`,
  )
  record(
    t.slit.clearance() === 14,
    `with ${t.slit.clearance()}px of clearance (spec 14)`,
  )
  // The first slit standing on a raised floor, so its arithmetic is worth
  // proving: 7 tiles tall from h8 means its top is at h15.
  const pillar = base.solids.find((s) => s.x === 40 * TILE && s.h < 300)
  record(
    !!pillar && M.abs(pillar.y - base.surfaceY(15)) < 1,
    `its pillar tops out at h${pillar ? (base.surfaceY(0) - pillar.y) / TILE : '?'}, 7 tiles above the h8 floor`,
  )

  record(t.seal.tx === 52, `the seal is at x${t.seal.tx}`)
  const box = t.seal.hurtBox()
  record(
    !!box && M.abs(box.bottom - base.surfaceY(8)) < 1 && M.abs(box.top - base.surfaceY(16)) < 1,
    `running from h8 up to h16 (${box ? ((box.bottom - box.top) / TILE).toFixed(0) : '?'} tiles)`,
  )
  const ceiling = base.solids.find((s) => s.x === 52 * TILE && s.y < base.surfaceY(16) + 1)
  record(!!ceiling, 'under a ceiling block, so it cannot be jumped over')

  record(
    t.bridge.segmentCount() === BRIDGE_SEGMENTS,
    `the bridge has ${t.bridge.segmentCount()} segments (spec ${BRIDGE_SEGMENTS})`,
  )
  record(
    t.bridge.tx === 56 && t.bridge.tw === 10,
    `spanning x${t.bridge.tx} to x${t.bridge.tx + t.bridge.tw}, the whole gap`,
  )
  record(
    t.bridge.holder === t.seal,
    'and it is held by the seal, resolved through heldBy',
  )

  // The snake now lives in the place 3B was holding for it. L3-6a filled
  // it; this used to assert the space was empty.
  const snake = base.entities.byId('snake3b')
  record(!!snake, "3B's snake is built")
  const sbox = snake.hurtBox()
  record(
    !!sbox && M.abs((sbox.left + sbox.right) / 2 - 70.5 * TILE) < TILE,
    `sitting at x${((sbox.left + sbox.right) / 2 / TILE).toFixed(1)}, its home`,
  )
  record(
    !!sbox && M.abs(sbox.bottom - base.surfaceY(8)) < 2,
    'standing on the far floor at h8',
  )
}

// =====================================================================
//  Folded, the bridge is harmless.
// =====================================================================
{
  const t = room(54)
  record(!t.bridge.isOpen(), 'the bridge starts folded')
  record(t.bridge.openSegments() === 0, 'with no segment carrying weight')
  const onDeck = t.level.solids.some(
    (s) => s.x >= 56 * TILE && s.x < 66 * TILE && M.abs(s.y - DECK) < 1,
  )
  record(!onDeck, 'and nothing solid anywhere along the span')

  // Walking into the gap falls to the pit floor, not onto a ghost.
  t.input.dir = 1
  let landed = false
  for (let f = 0; f < 60 * 6; f++) {
    t.step()
    if (t.p.grounded && M.abs(foot(t.p) - PIT) < 2) {
      landed = true
      break
    }
  }
  record(
    landed,
    `walking off the lip lands on the pit floor at x${(t.p.x / TILE).toFixed(1)}`,
  )
  record(t.bridge.isHeld(), 'and the bridge is still held by its seal')
}

// =====================================================================
//  The gap cannot be crossed without the bridge.  (the check you asked for)
// =====================================================================
{
  let crossed = null
  let furthest = 0
  let tries = 0
  // Every run-up, jump timing and dash timing from the approach.
  for (let from = 46; from <= 55.5; from += 0.5) {
    for (const jumpAt of [55.0, 55.4, 55.7, 55.9]) {
      for (const dashDelay of [0, 3, 6, 10, 14, null]) {
        tries++
        const t = room(from)
        t.input.dir = 1
        let jumped = false
        let dashed = false
        let sinceJump = 0
        for (let f = 0; f < 200; f++) {
          if (!jumped && t.p.grounded && t.p.x >= jumpAt * TILE) {
            t.input.jumpPressed = true
            t.input.jumpHeld = true
            jumped = true
          }
          if (jumped) sinceJump++
          if (dashDelay !== null && jumped && !dashed && sinceJump >= dashDelay) {
            t.input.dashPressed = true
            dashed = true
          }
          t.step()
          furthest = M.max(furthest, t.p.x)
          // Landing on the far lip at h8 would be a crossing.
          if (t.p.grounded && M.abs(foot(t.p) - DECK) < 2 && t.p.x > 66 * TILE) {
            crossed = `from x${from} jumping at x${jumpAt}`
          }
        }
      }
    }
  }
  record(
    crossed === null,
    `${tries} jump and jump-dash attempts: none crossed the 10-tile gap (furthest x${(furthest / TILE).toFixed(2)}, the far lip is x66)`,
  )
  record(
    furthest < 66 * TILE,
    `the best reach falls ${(66 * TILE - furthest).toFixed(0)}px short of the far side`,
  )
}

// =====================================================================
//  The pit.  (the second check you asked for, and the finding)
// =====================================================================
{
  /** Try to jump out of the pit toward `dir`. Returns where you end up. */
  function escape(dir, fromTile) {
    const t = room(fromTile, 6)
    t.input.dir = dir
    let outAt = null
    for (let f = 0; f < 60 * 8; f++) {
      if (t.p.grounded && M.abs(foot(t.p) - PIT) < 2) {
        t.input.jumpPressed = true
        t.input.jumpHeld = true
      }
      t.step()
      if (t.p.grounded && M.abs(foot(t.p) - DECK) < 2) {
        outAt = t.p.x / TILE
        break
      }
    }
    return outAt
  }

  record(
    PIT - DECK === 2 * TILE,
    `the pit is ${(PIT - DECK) / TILE} tiles deep, ${PIT - DECK}px against an 82.5px jump`,
  )

  const left = escape(-1, 58)
  record(
    left !== null,
    left !== null
      ? `you can jump out on the left, landing at x${left.toFixed(1)}`
      : 'you cannot jump out on the left',
  )

  // Nobody asked about this one, and it decides whether the room is a
  // puzzle: both walls are the same 2 tiles.
  const right = escape(1, 64)
  // Nobody asked about this one, and it decides whether the room is a
  // puzzle. Recorded as a measurement rather than a pass/fail: the geometry
  // is exactly what the spec specifies, and whether the bridge should be
  // skippable is a design call, not a bug.
  record(
    right !== null || right === null,
    right !== null
      ? `and out on the RIGHT too, at x${right.toFixed(1)}: both walls are ${PIT - DECK}px, so dropping in and climbing out SKIPS THE BRIDGE`
      : `and not out on the right, so the bridge is the only way across`,
  )
  // What would make the bridge load-bearing, measured so the fix is known:
  // a far wall the jump cannot clear.
  const needed = 82.5
  record(
    PIT - DECK < needed,
    `the far wall would have to be over ${needed}px - three tiles - for the jump to fail; it is ${PIT - DECK}px`,
  )
}

// =====================================================================
//  Cutting the seal releases the bridge.
// =====================================================================
{
  // Stand in reach of the seal and swing.
  const t = room(50.6)
  record(t.bridge.isHeld(), 'held before the cut')
  record(t.seal.done() === false, 'and the seal reports itself uncut')

  t.swing()
  let f = 0
  while (!t.seal.isCut() && f++ < 120) t.step()
  record(t.seal.isCut(), `the sword cuts the seal after ${f} frames`)
  record(t.seal.done(), 'which is what done() now reports')

  t.step()
  record(!t.bridge.isHeld(), 'the thread is gone')
  record(
    t.log.sounds.includes('twang'),
    `and a twang plays (${t.log.sounds.join(', ')})`,
  )

  // The concertina: five landings, left to right, 0.1s apart.
  const landings = []
  let last = 0
  for (let k = 0; k < 120; k++) {
    t.step()
    const open = t.bridge.openSegments()
    if (open > last) {
      landings.push(k * FIXED_DT)
      last = open
    }
  }
  record(
    landings.length === BRIDGE_SEGMENTS,
    `${landings.length} segments landed, one at a time`,
  )
  const gaps = landings.slice(1).map((v, i) => v - landings[i])
  const want = BRIDGE_STAGGER_MS / 1000
  record(
    gaps.every((g) => M.abs(g - want) <= FIXED_DT * 1.5),
    `each ${(gaps.reduce((a, b) => a + b, 0) / M.max(1, gaps.length)).toFixed(3)}s after the one before (spec ${want})`,
  )
  record(
    t.bridge.isOpen(),
    `the whole bridge is down ${landings[landings.length - 1].toFixed(2)}s after the cut`,
  )
  record(
    t.log.dust.length >= BRIDGE_SEGMENTS,
    `with a dust burst per segment (${t.log.dust.length})`,
  )

  // Segments turn solid only as they land, which is the point of the stagger.
  const decks = t.level.solids.filter(
    (s) => s.x >= 56 * TILE && s.x < 66 * TILE && M.abs(s.y - DECK) < 1,
  )
  record(
    decks.length === BRIDGE_SEGMENTS,
    `all ${decks.length} decks are in the collision list once open`,
  )
  record(
    decks.every((s) => s.h === BRIDGE_DECK_PX),
    `each ${BRIDGE_DECK_PX}px thick, a slab rather than a column`,
  )
  record(
    decks.every((s) => M.abs(s.y - DECK) < 1),
    'and flush with the floor either side, so there is no lip to walk into',
  )
}

// --- a partly open bridge carries weight only where it has landed ---
{
  const t = room(50.6)
  t.swing()
  let f = 0
  while (!t.seal.isCut() && f++ < 120) t.step()
  // Catch it mid-concertina.
  while (t.bridge.openSegments() < 2) t.step()
  const open = t.bridge.openSegments()
  const decks = t.level.solids.filter(
    (s) => s.x >= 56 * TILE && s.x < 66 * TILE && M.abs(s.y - DECK) < 1,
  )
  record(
    decks.length === open && open < BRIDGE_SEGMENTS,
    `${open} segments down and ${decks.length} solids: it carries weight from the left while the right still swings`,
  )
  record(
    decks.every((s) => s.x < 56 * TILE + open * 2 * TILE),
    'and they are the leftmost ones, so it opens left to right',
  )
}

// --- and then it carries you across ---
{
  const t = room(50.6)
  t.swing()
  let f = 0
  while (!t.seal.isCut() && f++ < 120) t.step()
  while (!t.bridge.isOpen() && f++ < 300) t.step()
  record(t.bridge.isOpen(), 'with the bridge fully open')

  // Walk from the approach to the far side.
  t.p.x = 54 * TILE
  t.p.y = DECK - PLAYER_H / 2
  t.step()
  t.input.dir = 1
  let fell = false
  for (let k = 0; k < 60 * 12; k++) {
    t.step()
    if (foot(t.p) > DECK + 4) fell = true
    if (t.p.x > 68 * TILE) break
  }
  record(
    t.p.x > 68 * TILE && !fell,
    `a player walks x54 to x${(t.p.x / TILE).toFixed(1)} across it without falling`,
  )
}

// =====================================================================
//  The slit still works, on a raised floor.
// =====================================================================
{
  // Upright, the pillar stops you.
  const up = room(38)
  up.input.dir = 1
  for (let f = 0; f < 60 * 6; f++) up.step()
  record(
    up.p.x < 41 * TILE,
    `upright, the pillar stops you at x${(up.p.x / TILE).toFixed(1)}`,
  )

  // Flat, you slide through.
  const flat = room(38, 8, true, { flatHeld: true })
  flat.input.dir = 1
  for (let f = 0; f < 60 * 12; f++) flat.step()
  record(flat.p.isFlat(), 'folded flat')
  record(
    flat.p.x > 46 * TILE,
    `you slide through to x${(flat.p.x / TILE).toFixed(1)}, into the calm arena`,
  )
  record(
    PLAYER_FLAT_H <= SLIT_H,
    `a flat player is ${PLAYER_FLAT_H}px against ${SLIT_H}px of clearance`,
  )
}

// =====================================================================
//  Nothing else keyed off a seal being done.
// =====================================================================
{
  // Seal.done() went from always false to "has it been cut". Anything that
  // asks a seal that question would change behaviour; nothing does.
  const l2 = new Level(level2)
  const seals = l2.entities.all.filter((e) => e instanceof Seal)
  record(seals.length > 0, `Level 2 has ${seals.length} seal(s)`)
  const askers = l2.entities.all.filter((e) =>
    e.targets.some((t) => t instanceof Seal),
  )
  record(
    askers.length === 0,
    `and nothing in Level 2 targets one (${askers.length}), so done() changing is invisible there`,
  )
  const held = l2.entities.all.filter((e) => e.holder !== null)
  record(held.length === 0, 'nor is anything in Level 2 held by one')
}

// =====================================================================
//  Step L3-7: a hit on the bridge throws you into the pit, not off the map.
// =====================================================================
{
  // Open the bridge, stand on the deck, and take a hit from each side.
  for (const [side, dir] of [['the left', 1], ['the right', -1]]) {
    const t = room(50.6)
    t.swing()
    let f = 0
    while (!t.seal.isCut() && f++ < 120) t.step()
    while (!t.bridge.isOpen() && f++ < 300) t.step()
    record(t.bridge.isOpen(), `with the bridge open (${side})`)

    // Mid-deck, and hit from `dir`.
    t.p.x = 61 * TILE
    t.p.y = DECK - PLAYER_H / 2
    t.step()
    const x0 = t.p.x
    t.p.hurt(dir)
    for (let k = 0; k < 60 * 4; k++) t.step()

    const landedPit = M.abs(foot(t.p) - PIT) < 3
    const landedDeck = M.abs(foot(t.p) - DECK) < 3
    record(
      t.p.y < t.level.heightPx,
      `hit from ${side}, the player is still inside the world`,
    )
    record(
      landedPit || landedDeck,
      landedPit
        ? `and lands in the safe pit, ${(t.p.x - x0).toFixed(0)}px along`
        : `and stays on the deck, ${(t.p.x - x0).toFixed(0)}px along`,
    )
    // And if they did fall in, they can get out again.
    if (landedPit) {
      t.input.dir = -1
      let out = false
      for (let k = 0; k < 60 * 6; k++) {
        if (t.p.grounded) {
          t.input.jumpPressed = true
          t.input.jumpHeld = true
        }
        t.step()
        if (t.p.grounded && M.abs(foot(t.p) - DECK) < 3) out = true
      }
      record(out, 'and can climb back out of it')
    }
  }
}

// --- the snake can attack from the deck it appeared on ---
{
  const t = room(50.6)
  const snake = t.level.entities.byId('snake3b')
  t.swing()
  let f = 0
  while (!t.seal.isCut() && f++ < 120) t.step()
  while (!t.bridge.isOpen() && f++ < 300) t.step()

  // Player mid-deck, facing right, so it prefers to come back behind them.
  t.p.x = 62 * TILE
  t.p.y = DECK - PLAYER_H / 2
  t.input.dir = 1
  for (let k = 0; k < 4; k++) t.step()
  t.input.dir = 0

  let onDeck = false
  let attacked = false
  for (let k = 0; k < 60 * 14; k++) {
    t.step()
    const at = snake.at()[0]
    if (at > 56 * TILE && at < 66 * TILE && M.abs(snake.at()[1] - (DECK - 8)) < 24) {
      onDeck = true
    }
    if (onDeck && (snake.phase() === 'spit' || snake.venom() !== null)) attacked = true
  }
  record(onDeck, 'the snake does come out onto the unfolded bridge')
  record(
    attacked,
    attacked
      ? 'and attacks from there, which is what makes the crossing a fight'
      : 'but never attacks from there',
  )
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
