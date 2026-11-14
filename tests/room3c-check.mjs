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

  // Both enemies' places are left empty.
  for (const [what, x, h] of [['snake home', 96, 0], ['bat anchor', 105.5, 18]]) {
    const px = x * TILE
    const py = base.surfaceY(h)
    const busy = base.entities.all.some((e) => {
      const b = e.hurtBox()
      return b && px > b.left - TILE && px < b.right + TILE && py > b.top - TILE && py < b.bottom + TILE
    })
    record(!busy, `nothing hittable at the ${what}, x${x} h${h}`)
  }
  record(
    !base.solids.some(
      (s) => 105.5 * TILE > s.x && 105.5 * TILE < s.x + s.w && base.surfaceY(18) > s.y && base.surfaceY(18) < s.y + s.h,
    ),
    'and nothing solid at the bat anchor either',
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

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
