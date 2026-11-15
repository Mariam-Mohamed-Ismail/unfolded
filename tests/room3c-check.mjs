// Step L3-4: room 3C. A shaft, a slit, a seal holding a sheet that caps the
// fan that is the only way onto the exit platform.
import { scene } from './stub-scene.mjs'
import { Level } from '../src/game/Level.ts'
import { Player } from '../src/game/Player.ts'
import { Sword } from '../src/game/Sword.ts'
import { Fan } from '../src/game/entities/Fan.ts'
import { FoldSheet } from '../src/game/entities/FoldSheet.ts'
import { Seal } from '../src/game/entities/Seal.ts'
import { Slit } from '../src/game/entities/Slit.ts'
import { level3 } from '../src/game/levels/level3.ts'
import {
  FIXED_DT,
  PLAYER_H,
  SHEET_PX,
  SNAKE_NEAR_MAX,
  SNAKE_NEAR_MIN,
  TILE,
} from '../src/game/constants.ts'

const M = globalThis.Math
const out = []
const record = (ok, msg) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

function recorder() {
  const log = { sounds: [] }
  return {
    log,
    fx: {
      dust: () => {}, shake: () => {}, zoom: () => {},
      sound: (n) => log.sounds.push(n),
      label: () => {}, hum: () => {},
    },
  }
}

/** Level 3 at (tile, h), with the blade available unless told otherwise. */
function room(tileX, h = 0, armed = true, held = {}) {
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
  // Level 3 carries no sword pickup of its own yet.
  level.swordOut = () => armed
  // Damage wired as GameScene wires it: 3C has two enemies in it now.
  let hurt = 0
  const step = () => {
    p.update(FIXED_DT, input, level.solids, level.updraftAt(p), sword.speedScale())
    level.update(FIXED_DT, p, r.fx)
    sword.update(FIXED_DT, p, slash, level, r.fx)
    const from = level.dangerAt(level.boxOf(p))
    if (from !== null) {
      hurt++
      p.hurt(M.sign(p.x - from) || 1)
    }
    input.jumpPressed = false
    input.jumpReleased = false
    input.dashPressed = false
    slash = false
  }
  step()
  return {
    level, p, input, sword, step, log: r.log,
    hits: () => hurt,
    swing: () => { slash = true },
    seal: level.entities.byId('seal3c'),
    sheet: level.entities.byId('sheet3c'),
    fan: level.entities.byId('fan3c'),
    slit: level.entities.byId('slit3c'),
    door: level.entities.byId('exit3'),
  }
}

const base = new Level(level3)
const SHAFT = base.surfaceY(0)
const LEDGE = base.surfaceY(8)
const HIGH = base.surfaceY(14)
const foot = (p) => p.y + p.halfH()
const up = (p) => SHAFT - foot(p)

// =====================================================================
//  The room as data.
// =====================================================================
{
  const t = room(88)
  record(t.slit instanceof Slit, 'the slit pillar is in 3C')
  record(t.seal instanceof Seal, 'the seal too')
  record(t.sheet instanceof FoldSheet, 'the sheet')
  record(t.fan instanceof Fan, 'and the fan')
  record(!!t.door, 'with the exit door')

  record(
    t.slit.tx === 90 && t.slit.tw === 3 && t.slit.clearance() === 14,
    `the pillar spans x${t.slit.tx} to x${t.slit.tx + t.slit.tw} with ${t.slit.clearance()}px clearance`,
  )
  // This one stands on the shaft floor, so topH 7 means 7 tiles - unlike
  // 3B's, which needed 15.
  const pillar = base.solids.find((s) => s.x === 90 * TILE)
  record(
    !!pillar && M.abs(pillar.y - base.surfaceY(7)) < 1,
    `topping out at h${pillar ? (SHAFT - pillar.y) / TILE : '?'}, 7 tiles above the shaft floor`,
  )

  const sealBox = t.seal.hurtBox()
  record(
    !!sealBox && M.abs(sealBox.bottom - SHAFT) < 1 && M.abs(sealBox.top - base.surfaceY(6)) < 1,
    `the seal runs h0 to h6, ${sealBox ? ((sealBox.bottom - sealBox.top) / TILE).toFixed(0) : '?'} tiles of tape`,
  )
  record(
    t.sheet.tx === 100 && t.sheet.tw === 6 && t.sheet.th === 9,
    `the sheet spans x${t.sheet.tx} to x${t.sheet.tx + t.sheet.tw} at h${t.sheet.th}`,
  )
  record(
    t.sheet.holder === t.seal,
    'and it is held by the seal, resolved through heldBy',
  )
  record(t.sheet.isHeld(), 'with the thread still whole')

  record(
    t.fan.tx === 102 && t.fan.tw === 2,
    `the fan sits at x${t.fan.tx}-${t.fan.tx + t.fan.tw - 1}`,
  )
  const high = base.solids.find((s) => s.x === 108 * TILE)
  record(
    !!high && high.w === 12 * TILE && M.abs(high.y - HIGH) < 1,
    `the platform runs x108 to x${high ? (high.x + high.w) / TILE : '?'}, ${SHAFT - HIGH}px up`,
  )
  record(t.door.tx === 118, `the door is at x${t.door.tx}`)
  record(
    base.roomAt(t.door.centerX()).id === '3c',
    'and all of it is in room 3C',
  )

  // L3-7 filled both places this used to assert were empty.
  const snake = base.entities.byId('snake3c')
  record(!!snake, "3C's snake is built")
  record(
    M.abs(snake.at()[0] - 96.5 * TILE) < TILE,
    `at its home, x${(snake.at()[0] / TILE).toFixed(1)}`,
  )
  const bat = base.entities.byId('bat3c')
  record(!!bat, "and 3C's bat")
  const bb = bat.hurtBox()
  record(
    !!bb && M.abs((bb.left + bb.right) / 2 - 105.5 * TILE) < TILE,
    `on its anchor, x${((bb.left + bb.right) / 2 / TILE).toFixed(1)}`,
  )
  // The strip is adjacent to the fan's column (x102-104), not over it.
  const strip = base.solids.find((sol) => sol.x === 104 * TILE)
  record(!!strip, 'its ceiling strip runs x104-107')
  record(
    !!strip && strip.h < TILE / 2,
    `a ${strip ? strip.h.toFixed(0) : '?'}px slab`,
  )
}

// =====================================================================
//  The drop in is safe, and one way.
// =====================================================================
{
  const t = room(84, 8)
  t.input.dir = 1
  let landed = false
  for (let f = 0; f < 60 * 8; f++) {
    t.step()
    if (t.p.grounded && M.abs(foot(t.p) - SHAFT) < 2) {
      landed = true
      break
    }
  }
  record(
    landed,
    `walking off the ledge lands in the shaft, ${(SHAFT - LEDGE) / TILE} tiles down`,
  )
  record(t.p.y < t.level.heightPx, 'rather than out of the world')

  // And you cannot get back up: the landing is committed.
  t.input.dir = -1
  let back = false
  for (let f = 0; f < 60 * 8; f++) {
    if (t.p.grounded) {
      t.input.jumpPressed = true
      t.input.jumpHeld = true
    }
    t.step()
    if (t.p.grounded && M.abs(foot(t.p) - LEDGE) < 2) back = true
  }
  record(
    !back,
    `and ${SHAFT - LEDGE}px back up is past an 82.5px jump, so the drop is one way`,
  )
}

// =====================================================================
//  The seal cannot be jumped over.
// =====================================================================
{
  const t = room(97)
  t.input.dir = 1
  let past = false
  for (let f = 0; f < 60 * 10; f++) {
    if (t.p.grounded) {
      t.input.jumpPressed = true
      t.input.jumpHeld = true
    }
    if (f === 20) t.input.dashPressed = true
    t.step()
    if (t.p.x > 100 * TILE) past = true
  }
  record(
    !past,
    `six tiles of tape under a ceiling block stop you at x${(t.p.x / TILE).toFixed(1)}`,
  )
  record(t.seal.hurtBox() !== null, 'and the seal is still there to be cut')
}

// =====================================================================
//  The sheet caps the fan.
// =====================================================================
{
  const t = room(103)
  record(t.sheet.isClosed(), 'the sheet starts closed')
  const shut = t.fan.column()
  record(
    M.abs(SHAFT - shut.top - 9 * TILE) <= SHEET_PX + 1,
    `so the column stops ${(SHAFT - shut.top).toFixed(0)}px up - just under the sheet at h9 (${9 * TILE}px)`,
  )

  let best = 0
  for (let f = 0; f < 60 * 8; f++) {
    t.step()
    best = M.max(best, up(t.p))
  }
  record(
    best < 9 * TILE,
    `riding the capped fan tops out at ${best.toFixed(0)}px, under the sheet`,
  )
  record(
    best < SHAFT - HIGH,
    `and nowhere near the platform at ${SHAFT - HIGH}px`,
  )

  // Fold it aside and the column reaches its full 16 tiles.
  t.sheet.trigger(0, 'unfold')
  for (let f = 0; f < 60; f++) t.step()
  const open = t.fan.column()
  record(
    M.abs(SHAFT - open.top - 16 * TILE) < 1,
    `folded aside, the column reaches ${(SHAFT - open.top).toFixed(0)}px, its full 16 tiles`,
  )
}

// =====================================================================
//  The seal is the only way to open the sheet.  (the check you asked for)
// =====================================================================
{
  // 1. Nothing in the level can trigger it: no switch names it as a target.
  const pointers = base.entities.all.filter((e) =>
    e.targets.some((t) => t === base.entities.byId('sheet3c')),
  )
  record(
    pointers.length === 0,
    `nothing in Level 3 targets the sheet (${pointers.length}), so no switch can open it`,
  )
  record(
    base.entities.byId('sheet3c').heldById === 'seal3c',
    'its only trigger is the seal holding it',
  )

  // 2. It stays shut on its own, with the player moving about underneath.
  const idle = room(103)
  for (let f = 0; f < 60 * 20; f++) {
    idle.input.dir = f % 120 < 60 ? 1 : -1
    if (f % 40 === 0) idle.input.jumpPressed = true
    idle.step()
  }
  record(
    idle.sheet.isClosed(),
    'twenty seconds of running and jumping under it and it is still shut',
  )
  record(idle.sheet.isHeld(), 'and still held')

  // 3. Cutting the seal opens it.
  const t = room(97.6)
  record(t.sheet.isClosed(), 'with the sheet shut')
  t.swing()
  let f = 0
  while (!t.seal.isCut() && f++ < 120) t.step()
  record(t.seal.isCut(), `the sword cuts the seal after ${f} frames`)
  t.step()
  record(!t.sheet.isHeld(), 'the thread snaps')
  record(
    t.log.sounds.includes('twang'),
    `with a twang (${[...new Set(t.log.sounds)].join(', ')})`,
  )
  let g = 0
  while (t.sheet.isClosed() && g++ < 120) t.step()
  record(
    !t.sheet.isClosed(),
    `and the sheet is no longer blocking after ${(g * FIXED_DT).toFixed(2)}s - collision goes the instant it starts folding`,
  )
  while (t.sheet.progress() < 1 && g++ < 200) t.step()
  record(
    M.abs(SHAFT - t.fan.column().top - 16 * TILE) < 1,
    'opening the draught all the way to h16',
  )
}

// =====================================================================
//  The platform cannot be reached without the fan.  (the check you asked for)
// =====================================================================
{
  let onTop = null
  let best = 0
  let tries = 0

  // Every half-tile of standing ground in the room, in three states: the
  // sheet shut, the sheet open with the fan dead, and from the entry ledge.
  const spots = []
  for (let x = 87; x <= 107; x += 0.5) spots.push([x, 0])
  for (let x = 77; x <= 85; x += 0.5) spots.push([x, 8])

  for (const [x, h] of spots) {
    for (const mode of ['shut', 'openNoFan']) {
      for (const plan of ['jump', 'jumpDash']) {
        tries++
        const t = room(x, h)
        if (mode === 'openNoFan') {
          t.sheet.trigger(0, 'unfold')
          for (let f = 0; f < 40; f++) t.step()
        }
        // The fan is never the answer in this check.
        t.fan.draughtAt = () => null
        t.input.dir = 1
        let jumped = false
        let dashed = false
        for (let f = 0; f < 150; f++) {
          if (!jumped && t.p.grounded) {
            t.input.jumpPressed = true
            t.input.jumpHeld = true
            jumped = true
          } else if (plan === 'jumpDash' && jumped && !dashed && !t.p.grounded) {
            t.input.dashPressed = true
            dashed = true
          }
          t.step()
          best = M.max(best, up(t.p))
          if (t.p.grounded && foot(t.p) <= HIGH + 1) onTop = `${x} h${h} ${mode} ${plan}`
        }
      }
    }
  }
  record(
    onTop === null,
    `${tries} jump and jump-dash attempts from every foothold: none reached the platform (best ${best.toFixed(0)}px against ${SHAFT - HIGH}px)`,
  )

  // Nor by riding the capped column, which is the way you would try.
  const r = room(103)
  let high = 0
  for (let f = 0; f < 60 * 10; f++) {
    r.step()
    high = M.max(high, up(r.p))
    if (r.p.grounded && foot(r.p) <= HIGH + 1) high = 99999
  }
  record(
    high < SHAFT - HIGH,
    `and riding the capped fan reaches only ${high.toFixed(0)}px, so the seal is the way up`,
  )
}

// =====================================================================
//  Can 3C be finished?
// =====================================================================
{
  function attempt(driftAt, dashAt) {
    const t = room(103)
    // Open the sheet the way the room does, then ride.
    t.sheet.trigger(0, 'unfold')
    for (let f = 0; f < 40; f++) t.step()
    // Settle on the grille: arriving with momentum starts the drift too
    // far left, which is what made 3A's sweep look impossible.
    const col = t.fan.column()
    const mark = col.left + 1.1 * TILE
    let g = 0
    while (g++ < 60 * 6 && t.p.grounded && M.abs(t.p.x - mark) > 5) {
      t.input.dir = M.sign(mark - t.p.x)
      t.step()
    }
    t.input.dir = 0
    for (let k = 0; k < 6 && t.p.grounded; k++) t.step()

    let dashed = false
    let apex = 0
    for (let k = 0; k < 60 * 14; k++) {
      const h = up(t.p)
      apex = M.max(apex, h)
      t.input.dir = h >= driftAt ? 1 : 0
      if (dashAt !== null && !dashed && h >= dashAt && !t.p.grounded) {
        t.input.dashPressed = true
        dashed = true
      }
      t.step()
      if (t.p.grounded && foot(t.p) <= HIGH + 1 && t.p.x > 108 * TILE) {
        return { ok: true, margin: t.p.x - 108 * TILE, apex, dashed }
      }
      if (t.p.grounded && up(t.p) < 4 && k > 120) break
    }
    return { ok: false, margin: t.p.x - 108 * TILE, apex, dashed }
  }

  let wins = 0
  let tries = 0
  let best = null
  let noDash = null
  let nearest = -1e9
  for (const driftAt of [360, 400, 440, 470, 500, 512]) {
    for (const dashAt of [null, 420, 460, 490, 512, 530]) {
      tries++
      const got = attempt(driftAt, dashAt)
      nearest = M.max(nearest, got.margin)
      if (!got.ok) continue
      wins++
      if (!best || got.margin > best.margin) best = got
      if (dashAt === null && (!noDash || got.margin > noDash.margin)) noDash = got
    }
  }

  record(
    wins > 0,
    wins > 0
      ? `${wins} of ${tries} ride-and-drift lines land on the platform`
      : `NONE of ${tries} lines reached it; the closest fell ${(-nearest).toFixed(0)}px short`,
  )
  if (best) {
    record(
      best.margin > 24,
      `the best clears the edge by ${best.margin.toFixed(0)}px`,
    )
    record(
      best.apex > SHAFT - HIGH,
      `topping out ${best.apex.toFixed(0)}px up, ${(best.apex - (SHAFT - HIGH)).toFixed(0)}px over the platform`,
    )
    record(
      true,
      `and it ${best.dashed ? 'spends the air dash' : 'needs no dash'}; without one the best is ${noDash ? noDash.margin.toFixed(0) + 'px' : 'nothing'}`,
    )
  }
}

// --- the exit door finishes Level 3, which it has never been able to do ---
{
  const t = room(116, 14)
  record(!t.level.finished(), 'not finished yet')
  t.input.dir = 1
  let f = 0
  while (!t.level.finished() && f++ < 400) t.step()
  record(
    t.level.finished(),
    `walking into the door at x${(t.p.x / TILE).toFixed(1)} finishes Level 3`,
  )
}

// =====================================================================
//  The slit works on the shaft floor.
// =====================================================================
{
  const upright = room(88)
  upright.input.dir = 1
  for (let f = 0; f < 60 * 6; f++) upright.step()
  record(
    upright.p.x < 91 * TILE,
    `upright, the pillar stops you at x${(upright.p.x / TILE).toFixed(1)}`,
  )

  const flat = room(88, 0, true, { flatHeld: true })
  flat.input.dir = 1
  for (let f = 0; f < 60 * 12; f++) flat.step()
  record(flat.p.isFlat(), 'folded flat')
  record(
    flat.p.x > 93 * TILE,
    `you slide through to x${(flat.p.x / TILE).toFixed(1)}, into the snake arena`,
  )
}

// =====================================================================
//  Step L3-7: the enemies, and whether 3C is still fair.
// =====================================================================

// --- neither strip caps the fan it hangs beside ---
{
  const t = room(103)
  t.sheet.trigger(0, 'unfold')
  for (let f = 0; f < 60; f++) t.step()
  const col = t.fan.column()
  record(
    M.abs(SHAFT - col.top - 16 * TILE) < 1,
    `with the bat's strip at x104-107 in place, the column still reaches ${(SHAFT - col.top).toFixed(0)}px`,
  )
  // The margin: the strip starts exactly where the column ends.
  const strip = t.level.solids.find((s) => s.x === 104 * TILE)
  record(
    !!strip && strip.x >= t.fan.column().right,
    `the strip begins at x${strip ? strip.x / TILE : '?'} and the column ends at x${col.right / TILE} - adjacent, with nothing to spare`,
  )
}

// --- the snake ignores a player flat in the slit, and rears as they emerge ---
{
  // Slide in from outside: spawning upright at x91 does not fit under a
  // pillar with 14px of clearance, and the player gets pushed on top of it.
  const t = room(88, 0, true, { flatHeld: true })
  const snake = t.level.entities.byId('snake3c')
  t.input.dir = 1
  let walk = 0
  while (t.p.x < 92 * TILE && walk++ < 60 * 10) t.step()
  t.input.dir = 0
  // Let it finish whatever the approach started - the player is only
  // protected once they are actually hidden, not on the way in - and then
  // measure from a settled snake.
  let settle = 0
  while ((snake.phase() !== 'patrol' || !t.snake0) && settle++ < 60 * 20) {
    t.step()
    if (snake.phase() === 'patrol' && settle > 60 * 6) t.snake0 = true
  }
  const hitsBefore = t.hits()
  record(
    t.p.isFlat() && t.p.x > 90 * TILE && t.p.x < 93.5 * TILE,
    `folded flat inside 3C's slit, at x${(t.p.x / TILE).toFixed(1)}`,
  )

  let woken = false
  for (let f = 0; f < 60 * 10; f++) {
    t.step()
    if (snake.phase() !== 'patrol') woken = true
  }
  record(
    !woken,
    `the snake never looks up for ten seconds while they stay hidden (${snake.phase()})`,
  )
  record(
    t.hits() === hitsBefore,
    `and never touches them (${t.hits() - hitsBefore} hits in that time)`,
  )

  // Come out: it starts to rear.
  t.input.flatHeld = false
  t.input.dir = 1
  let woke = -1
  for (let f = 0; f < 60 * 4; f++) {
    t.step()
    if (snake.phase() !== 'patrol' && woke < 0) woke = f
  }
  record(
    woke >= 0,
    woke >= 0
      ? `coming out, it starts to rear ${(woke * FIXED_DT).toFixed(2)}s later`
      : 'coming out, it never notices',
  )
}

// --- the snake can end up inside 3C's column, which is why wind matters ---
{
  // It reappears 3 to 4 tiles from the player, and the player stands on the
  // grille to ride - so the column is squarely inside its reach. The lift
  // itself is measured in snake-check, on a floor built for it.
  const t = room(103)
  const snake = t.level.entities.byId('snake3c')
  t.sheet.trigger(0, 'unfold')
  for (let f = 0; f < 60; f++) t.step()
  const col = t.fan.column()
  const reach = [
    t.p.x - SNAKE_NEAR_MAX * TILE,
    t.p.x + SNAKE_NEAR_MAX * TILE,
  ]
  record(
    reach[0] < col.right && reach[1] > col.left,
    `standing on the grille, the snake's ${SNAKE_NEAR_MIN}-${SNAKE_NEAR_MAX} tile reappear range overlaps the column`,
  )
  void snake
}

// --- the bat alerts as the player rises, and its dive bends in the column ---
{
  const t = room(103)
  const bat = t.level.entities.byId('bat3c')
  t.sheet.trigger(0, 'unfold')
  for (let f = 0; f < 60; f++) t.step()
  record(bat.phase() === 'hang', 'the bat hangs while the player is on the floor')
  let woke = -1
  for (let f = 0; f < 60 * 8; f++) {
    t.step()
    if (bat.phase() !== 'hang' && woke < 0) {
      woke = SHAFT - (t.p.y + t.p.halfH())
      break
    }
  }
  record(
    woke > 0,
    woke > 0
      ? `and alerts as the player rises, at ${woke.toFixed(0)}px up`
      : 'and never alerts',
  )
}

// --- 3C is still beatable, and what it costs ---
{
  const t = room(77, 8)
  const seal = t.level.entities.byId('seal3c')
  const sheet = t.level.entities.byId('sheet3c')
  const bat = t.level.entities.byId('bat3c')
  const col = t.level.entities.byId('fan3c').column()
  const mark = col.left + 1.1 * TILE
  let dashed = false
  let landed = false
  let held = 0
  let frames = 0
  for (; frames < 60 * 60 && !t.level.finished(); frames++) {
    const foot = t.p.y + t.p.halfH()
    const up = SHAFT - foot
    const x = t.p.x / TILE
    t.input.dir = 0
    t.input.flatHeld = false
    if (frames === 2) t.input.swordPressed = true
    if (t.p.grounded && foot <= HIGH + 1 && x > 108) landed = true

    const bb = bat.hurtBox()
    const close =
      bb &&
      M.hypot((bb.left + bb.right) / 2 - t.p.x, (bb.top + bb.bottom) / 2 - t.p.y) < 70
    if (landed) {
      t.input.dir = 1
    } else if (bat.phase() === 'dive' && close && !t.p.isFlat()) {
      t.swing()
      t.input.dir = up > 400 ? 1 : 0
    } else if (!seal.isCut()) {
      const inSlit = x > 90.2 && x < 93.3
      if (inSlit && held < 60) {
        held++
        t.input.flatHeld = true
      } else {
        t.input.flatHeld = x > 88.5 && x < 92.8
        if (x > 97.4 && !t.p.isFlat()) t.swing()
        else t.input.dir = 1
      }
    } else if (!sheet.isWaiting() && sheet.progress() < 1) {
      t.input.dir = 0
    } else if (t.p.grounded && up < 4) {
      const d = mark - t.p.x
      t.input.dir = M.abs(d) < 5 ? 0 : M.sign(d)
    } else {
      t.input.dir = up >= 440 ? 1 : 0
      if (!dashed && up >= 512 && !t.p.grounded) {
        t.input.dashPressed = true
        dashed = true
      }
    }
    t.step()
  }
  record(
    t.level.finished(),
    `3C is still beatable with both enemies live, in ${(frames / 60).toFixed(1)}s`,
  )
  record(
    t.hits() < 3,
    `costing ${t.hits()} of the player's 3 hits`,
  )
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
