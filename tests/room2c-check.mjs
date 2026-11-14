// Step L2-5: room 2C. The fans take turns, the platform cannot be jumped
// to, the pit always lets you out on the left — and the open question is
// whether the room can be finished at all.
import { scene } from './stub-scene.mjs'
import { Player } from '../src/game/Player.ts'
import { Level } from '../src/game/Level.ts'
import { Fan } from '../src/game/entities/Fan.ts'
import { level1 } from '../src/game/levels/level1.ts'
import { level2 } from '../src/game/levels/level2.ts'
import {
  DRAUGHT_ACCEL,
  DRAUGHT_VY,
  FAN_HUM_WARN,
  FAN_WARN_MS,
  PLAYER_H,
  TILE,
} from '../src/game/constants.ts'

const M = globalThis.Math
const DT = 1 / 60
const out = []
const record = (ok, msg) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

function recorder() {
  const log = { hums: [], dust: [] }
  return {
    log,
    fx: {
      dust: (x, y, count, color) => log.dust.push({ x, y, count, color }),
      shake: () => {},
      zoom: () => {},
      sound: () => {},
      label: () => {},
      hum: (id, level) => log.hums.push({ id, level }),
    },
  }
}

/** Level 2 with the player at (tile, surface h). */
function room(tileX, h = 0) {
  const level = new Level(level2)
  const r = recorder()
  const p = new Player(
    scene,
    tileX * TILE,
    level.surfaceY(h) - PLAYER_H / 2,
    level.solids,
  )
  const input = {
    dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
    dashPressed: false, flatHeld: false,
  }
  const step = () => {
    p.update(DT, input, level.solids, level.updraftAt(p))
    level.update(DT, p, r.fx)
    input.jumpPressed = false
    input.jumpReleased = false
    input.dashPressed = false
  }
  step()
  return { level, p, input, step, log: r.log }
}

const base = new Level(level2)
const FLOOR = base.surfaceY(0)
const PIT = base.surfaceY(-2)
const TOP = base.surfaceY(4)
const foot = (p) => p.y + p.halfH()

// =====================================================================
//  The room as data.
// =====================================================================
{
  const approach = base.solids.find((s) => s.x === 62 * TILE)
  const pit = base.solids.find((s) => s.x === 66 * TILE)
  const high = base.solids.find((s) => s.x === 84 * TILE)
  record(!!approach && approach.w === 4 * TILE, 'the approach floor runs x 62 to 66')
  record(
    !!pit && pit.y === PIT && pit.w === 18 * TILE,
    `the pit runs x 66 to 84, ${(PIT - FLOOR) / TILE} tiles down`,
  )
  record(
    !!high && high.y === TOP && high.w === 12 * TILE,
    `the platform runs x 84 to 96 with its top ${FLOOR - TOP}px up`,
  )

  const a = base.entities.byId('fanA')
  const b = base.entities.byId('fanB')
  record(a instanceof Fan && b instanceof Fan, 'two fans built')
  const ca = a.column()
  const cb = b.column()
  record(
    ca.left === 71 * TILE && ca.right === 73 * TILE,
    `Fan A's column is x 71 to 73`,
  )
  record(
    cb.left === 78 * TILE && cb.right === 80 * TILE,
    `Fan B's column is x 78 to 80`,
  )
  record(
    ca.bottom === PIT && ca.bottom - ca.top === 8 * TILE,
    `8 tiles tall from the pit floor, topping out at h=${(FLOOR - ca.top) / TILE}`,
  )
  record(
    ca.top < TOP,
    `the column tops are ${TOP - ca.top}px above the platform`,
  )

  const door = base.entities.byId('exit2')
  record(!!door && door.tx === 94, 'the exit door is at x 94')
  record(base.roomAt(door.centerX()).id === '2c', 'and all of it is in room 2C')
}

// =====================================================================
//  The fans take turns.
// =====================================================================
{
  const t = room(63)
  const a = t.level.entities.byId('fanA')
  const b = t.level.entities.byId('fanB')

  // Sample a whole period at 1/60s and record the on-windows.
  const samples = []
  for (let f = 0; f < 60 * 6; f++) {
    samples.push({ t: f / 60, a: a.isOn(), b: b.isOn(), wa: a.isWarning(), wb: b.isWarning() })
    t.step()
  }
  const span = (pick) => {
    const on = samples.filter(pick)
    return on.length === 0
      ? null
      : { from: on[0].t, to: on[on.length - 1].t, n: on.length }
  }
  const aOn = span((s) => s.a)
  record(
    aOn && aOn.from === 0 && M.abs(aOn.to - 3.383) < 0.05,
    `A is on from ${aOn.from.toFixed(2)}s to ${aOn.to.toFixed(2)}s (spec 0 for 3.4)`,
  )

  const bruns = []
  let run = null
  for (const s of samples) {
    if (s.b && !run) run = { from: s.t, to: s.t }
    else if (s.b) run.to = s.t
    else if (run) { bruns.push(run); run = null }
  }
  if (run) bruns.push(run)
  record(
    bruns.length === 2,
    `B's on-time wraps the period, so it shows as ${bruns.length} runs: ${bruns.map((r) => `${r.from.toFixed(2)}-${r.to.toFixed(2)}`).join(', ')}`,
  )
  const bTotal = samples.filter((s) => s.b).length / 60
  record(
    M.abs(bTotal - 3.4) < 0.05,
    `and adds up to ${bTotal.toFixed(2)}s on (spec 3.4)`,
  )

  const both = samples.filter((s) => s.a && s.b)
  const overlaps = []
  let o = null
  for (const s of samples) {
    if (s.a && s.b && !o) o = { from: s.t, to: s.t }
    else if (s.a && s.b) o.to = s.t
    else if (o) { overlaps.push(o); o = null }
  }
  if (o) overlaps.push(o)
  record(
    overlaps.length === 2,
    `they overlap ${overlaps.length} times a period: ${overlaps.map((v) => `${v.from.toFixed(2)}-${v.to.toFixed(2)}`).join(', ')}`,
  )
  record(
    M.abs(both.length / 60 - 0.8) < 0.08,
    `for ${(both.length / 60 / 2).toFixed(2)}s each (spec 0.4), which is the crossing window`,
  )

  // The warning is the last 0.4s of each on-window, and nowhere else.
  const warned = samples.filter((s) => s.wa)
  record(
    M.abs(warned.length / 60 - FAN_WARN_MS / 1000) < 0.05,
    `A warns for ${(warned.length / 60).toFixed(2)}s (spec ${FAN_WARN_MS / 1000})`,
  )
  record(
    warned.every((s) => s.a),
    'and only while it is still on',
  )
  record(
    warned.every((s) => s.t > 2.9),
    `at the end of its window, from ${warned[0].t.toFixed(2)}s`,
  )
}

// --- a fan that is off makes no draught ---
{
  const t = room(72, -2)
  const a = t.level.entities.byId('fanA')
  record(a.isOn(), 'standing on Fan A while it is on')
  const lift = t.level.updraftAt(t.p)
  record(
    lift !== null && lift.vy === DRAUGHT_VY && lift.accel === DRAUGHT_ACCEL,
    `the air reads vy ${lift?.vy} at ${lift?.accel}`,
  )

  // Wait for it to go off.
  let frames = 0
  while (a.isOn() && frames++ < 60 * 8) t.step()
  record(!a.isOn(), `it turns off after ${(frames / 60).toFixed(2)}s`)
  record(
    t.level.updraftAt(t.p) === null,
    'and then there is no draught at all',
  )
  record(a.draughtAt(a.column()) === null, 'even asked about its own column')
}

// --- the hum follows the timer ---
{
  const t = room(72, -2)
  const a = t.level.entities.byId('fanA')
  t.log.hums.length = 0
  t.step()
  const loud = t.log.hums.filter((h) => h.id === 'fanA').at(-1)
  record(loud.level > 0.8, `on the fan and running, the hum is ${loud.level.toFixed(2)}`)

  while (!a.isWarning()) t.step()
  t.log.hums.length = 0
  t.step()
  const warn = t.log.hums.filter((h) => h.id === 'fanA').at(-1)
  record(
    warn.level < loud.level * (FAN_HUM_WARN + 0.05),
    `through the warning it drops to ${warn.level.toFixed(2)}`,
  )

  while (a.isOn()) t.step()
  t.log.hums.length = 0
  t.step()
  const off = t.log.hums.filter((h) => h.id === 'fanA').at(-1)
  record(off.level === 0, 'and off it is silent')
}

// --- turning on bursts motes; off stops them ---
{
  const t = room(63)
  const a = t.level.entities.byId('fanA')
  while (a.isOn()) t.step()
  // Off: let the ones in flight clear out.
  for (let f = 0; f < 60 * 2; f++) t.step()
  const whileOff = a.moteCount()
  for (let f = 0; f < 30; f++) t.step()
  record(
    a.moteCount() <= whileOff,
    `while off, no new motes are made (${whileOff} then ${a.moteCount()})`,
  )

  const before = a.moteCount()
  while (!a.isOn()) t.step()
  t.step()
  record(
    a.moteCount() > before + 5,
    `turning on shoots a burst up the column (${before} to ${a.moteCount()})`,
  )
}

// =====================================================================
//  The platform cannot be jumped to.  (the check you asked for)
// =====================================================================
{
  let onTop = null
  let best = 0
  let tries = 0
  const starts = []
  for (let x = 62.5; x <= 65.5; x += 0.5) starts.push([x, 0])
  for (let x = 66.5; x <= 83.5; x += 0.5) starts.push([x, -2])

  for (const [tile, h] of starts) {
    for (const plan of ['jump', 'jumpDash']) {
      tries++
      const t = room(tile, h)
      // Both fans forced off: this tests legs, not air.
      for (const id of ['fanA', 'fanB']) {
        t.level.entities.byId(id).draughtAt = () => null
      }
      t.input.dir = 1
      let jumped = false
      let dashed = false
      for (let f = 0; f < 200; f++) {
        if (!jumped && t.p.grounded && t.p.x > 83.4 * TILE - 46) {
          t.input.jumpPressed = true
          t.input.jumpHeld = true
          jumped = true
        } else if (plan === 'jumpDash' && jumped && !dashed && !t.p.grounded) {
          t.input.dashPressed = true
          dashed = true
        }
        t.step()
        best = M.max(best, PIT - foot(t.p))
        if (t.p.grounded && foot(t.p) <= TOP + 1) onTop = `${tile} by ${plan}`
      }
    }
  }
  record(
    onTop === null,
    `${tries} jump and jump-dash attempts from the floor and the pit: none reached the platform (best ${best.toFixed(1)}px above the pit floor, the platform is ${PIT - TOP})`,
  )
}

// =====================================================================
//  The pit lets you out on the left, and not on the right.
// =====================================================================
{
  const t = room(68, -2)
  for (const id of ['fanA', 'fanB']) {
    t.level.entities.byId(id).draughtAt = () => null
  }
  t.input.dir = -1
  let escaped = false
  for (let f = 0; f < 400; f++) {
    if (t.p.grounded && t.p.x < 66.6 * TILE) {
      t.input.jumpPressed = true
      t.input.jumpHeld = true
    }
    t.step()
    if (t.p.grounded && M.abs(foot(t.p) - FLOOR) < 1) { escaped = true; break }
  }
  record(
    escaped,
    `the pit's left wall is ${PIT - FLOOR}px, so you can always jump out that way`,
  )

  const r = room(82, -2)
  for (const id of ['fanA', 'fanB']) {
    r.level.entities.byId(id).draughtAt = () => null
  }
  r.input.dir = 1
  for (let f = 0; f < 400; f++) {
    if (r.p.grounded) {
      r.input.jumpPressed = true
      r.input.jumpHeld = true
    }
    r.step()
  }
  record(
    foot(r.p) > TOP + 1,
    `and its right wall is ${PIT - TOP}px, so the fans are the only way on (stuck at x${(r.p.x / TILE).toFixed(2)})`,
  )
}

// =====================================================================
//  Can 2C be finished?
// =====================================================================
{
  // The last leg is the hard one: Fan B's column tops out 64px above the
  // platform, four tiles to its left. `driftAt` is the height at which the
  // player starts holding right inside the column, `dashAt` the height at
  // which they dash (null for no dash), both above the pit floor.
  function lastLeg(driftAt, dashAt) {
    const t = room(78.9, -2)
    let dashed = false
    let apex = 0
    for (let f = 0; f < 60 * 14; f++) {
      const up = PIT - foot(t.p)
      apex = M.max(apex, up)
      t.input.dir = up >= driftAt ? 1 : 0
      if (dashAt !== null && !dashed && up >= dashAt && !t.p.grounded) {
        t.input.dashPressed = true
        dashed = true
      }
      t.step()
      if (t.p.grounded && foot(t.p) <= TOP + 1 && t.p.x > 84 * TILE) {
        return { ok: true, margin: t.p.x - 84 * TILE, apex, dashed }
      }
    }
    return { ok: false, margin: t.p.x - 84 * TILE, apex, dashed }
  }

  let best = null
  let bestNoDash = null
  let wins = 0
  let tries = 0
  let nearest = -1e9
  for (const driftAt of [120, 160, 200, 230, 250, 256, 262, 270]) {
    for (const dashAt of [null, 200, 240, 256, 262, 270, 278, 282]) {
      tries++
      const got = lastLeg(driftAt, dashAt)
      nearest = M.max(nearest, got.margin)
      if (!got.ok) continue
      wins++
      if (!best || got.margin > best.margin) best = got
      if (dashAt === null && (!bestNoDash || got.margin > bestNoDash.margin)) {
        bestNoDash = got
      }
    }
  }

  record(
    wins > 0,
    wins > 0
      ? `${wins} of ${tries} ride-and-steer lines off Fan B reach the platform`
      : `NONE of ${tries} ride-and-steer lines reach the platform; the closest fell ${(-nearest).toFixed(0)}px short of its edge`,
  )
  if (best) {
    record(
      best.margin > 32,
      `the best clears the edge by ${best.margin.toFixed(0)}px, a landing rather than a perch (1C's best was +31px)`,
    )
    record(
      best.apex > PIT - TOP,
      `it tops out ${best.apex.toFixed(0)}px above the pit floor, ${(best.apex - (PIT - TOP)).toFixed(0)}px over the platform`,
    )
    record(
      best.dashed,
      `and it spends the air dash on the leg out of the column`,
    )
    record(
      bestNoDash !== null && bestNoDash.margin < 8,
      bestNoDash
        ? `without the dash it still just lands, by ${bestNoDash.margin.toFixed(0)}px — too fine to count on, so the dash is the real answer`
        : 'without the dash no line lands at all',
    )
  }

  // The dash survives the crossing because the crossing is on the ground:
  // the fan grilles are not solid, so the pit floor runs unbroken from the
  // left wall to the platform. That is what makes the last leg possible.
  const walk = room(67, -2)
  walk.input.dir = 1
  let airborne = 0
  for (let f = 0; f < 60 * 6; f++) {
    walk.step()
    if (!walk.p.grounded && PIT - foot(walk.p) > 8) airborne++
    if (walk.p.x > 78.5 * TILE) break
  }
  record(
    walk.p.x > 78.5 * TILE,
    `walking x67 to Fan B along the pit floor works, so the fans are crossed on foot`,
  )
  record(
    airborne > 0,
    `though Fan A lifts you off it on the way (${airborne} frames of air), which is the beat that teaches the column`,
  )
}

// --- the room, start to finish, in one run ---
{
  const t = room(63)
  const colB = t.level.entities.byId('fanB').column()
  // Stand on Fan B's grille, a little in from its left edge.
  const mark = colB.left + 1.2 * TILE
  let dashed = false
  let landed = false
  let rides = 0
  let frames = 0
  for (; frames < 60 * 40 && !t.level.finished(); frames++) {
    const up = PIT - foot(t.p)
    if (t.p.grounded && foot(t.p) <= TOP + 1) landed = true

    if (landed) {
      // Walk to the door.
      t.input.dir = 1
    } else if (t.p.grounded) {
      // On any floor: head for the grille and wait there. Walking off the
      // approach into the pit happens on the way.
      t.input.dir = M.abs(t.p.x - mark) < 6 ? 0 : M.sign(mark - t.p.x)
    } else if (up < 160) {
      // In the air below the columns' halfway mark: ride it out.
      t.input.dir = 0
    } else {
      // High in a column: break right, and dash the moment the air lets go
      // — but only out of Fan B's, which is the one facing the platform.
      t.input.dir = 1
      const free = t.level.updraftAt(t.p) === null
      if (!dashed && up > 180 && free && t.p.x > colB.left) {
        t.input.dashPressed = true
        dashed = true
        rides++
      }
    }
    t.step()
  }
  record(landed, 'one run from the room entrance lands on the platform')
  record(
    t.level.finished(),
    `and walks into the door: Level 2 finishes, in ${(frames / 60).toFixed(1)}s`,
  )
  record(
    rides === 1,
    `on ${rides} dash, taken out of Fan B's column`,
  )
}

// --- the exit door finishes the level, which Level 2 could never do before ---
{
  const t = room(92, 4)
  record(!t.level.finished(), 'not finished yet')
  t.input.dir = 1
  let frames = 0
  while (!t.level.finished() && frames++ < 400) t.step()
  record(
    t.level.finished(),
    `walking into the door at x${(t.p.x / TILE).toFixed(1)} finishes Level 2`,
  )
}

// --- the tag ---
{
  const t = room(63)
  const tip = t.level.entities.byId('tipFans')
  for (let f = 0; f < 30; f++) t.step()
  const words = tip.serialize().state.text
  record(words === 'fans take turns', `the tag reads "${words}"`)
  record(words.split(' ').length === 3, 'three words')
  record(tip.alpha() > 0 && !tip.done(), 'up at the room entrance, uncleared')

  const ride = room(72, -2)
  const tag = ride.level.entities.byId('tipFans')
  for (let f = 0; f < 20; f++) ride.step()
  record(tag.done(), 'and riding a fan clears it')
}

// =====================================================================
//  Level 1's fan has no timer, so it never stops.
// =====================================================================
{
  const l1 = new Level(level1)
  const f1 = l1.entities.byId('f1')
  record(f1 instanceof Fan, "Level 1's fan is still there")
  let offAt = -1
  for (let i = 0; i <= 60 * 12; i++) {
    f1.update(DT, {
      player: {
        box: { left: -999, right: -998, top: 0, bottom: 1 },
        grounded: false, speed: 0, jumped: false, dashed: false,
        folded: false, sword: false, slash: false, failedAt: null,
      },
      swordOut: false,
      fx: { dust: () => {}, shake: () => {}, zoom: () => {}, sound: () => {}, label: () => {}, hum: () => {} },
    })
    if (!f1.isOn() && offAt < 0) offAt = i
  }
  record(offAt < 0, 'with no period it is on at every sample across 12 seconds')
  record(!f1.isWarning(), 'and never shows a warning, since it never turns off')
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
