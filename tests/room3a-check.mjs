// Step L3-2: room 3A. A timed plate far from the fan it frees, a sheet that
// cuts the draught off, and a ledge only the wind reaches.
import { scene } from './stub-scene.mjs'
import { Level } from '../src/game/Level.ts'
import { Player } from '../src/game/Player.ts'
import { Fan } from '../src/game/entities/Fan.ts'
import { FoldSheet } from '../src/game/entities/FoldSheet.ts'
import { TimedSwitch } from '../src/game/entities/TimedSwitch.ts'
import { level1 } from '../src/game/levels/level1.ts'
import { level2 } from '../src/game/levels/level2.ts'
import { level3 } from '../src/game/levels/level3.ts'
import {
  FIXED_DT,
  PLAYER_H,
  SHEET_FOLD_MS,
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

/** Level 3 with the player at (tile, h). */
function room(tileX, h = 0) {
  const level = new Level(level3)
  const r = recorder()
  const p = new Player(
    scene,
    tileX * TILE,
    level.surfaceY(h) - PLAYER_H / 2,
    level.solids,
  )
  const input = {
    dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
    dashPressed: false, flatHeld: false, swordPressed: false,
    slashPressed: false, resetPressed: false,
  }
  const step = () => {
    p.update(FIXED_DT, input, level.solids, level.updraftAt(p))
    level.update(FIXED_DT, p, r.fx)
    input.jumpPressed = false
    input.jumpReleased = false
    input.dashPressed = false
  }
  step()
  return {
    level, p, input, step, log: r.log,
    fan: level.entities.byId('fan3a'),
    sheet: level.entities.byId('sheet3a'),
    plate: level.entities.byId('tsw3a'),
  }
}

const base = new Level(level3)
const FLOOR = base.surfaceY(0)
const foot = (p) => p.y + p.halfH()
const up = (p) => FLOOR - foot(p)

// =====================================================================
//  The room as data.
// =====================================================================
{
  const t = room(2)
  record(t.fan instanceof Fan, 'the fan is built')
  record(t.sheet instanceof FoldSheet, 'the sheet is a FoldSheet')
  record(t.plate instanceof TimedSwitch, 'and the plate is a TimedSwitch')

  record(t.fan.tx === 6 && t.fan.tw === 2, `the fan sits at x${t.fan.tx}-${t.fan.tx + t.fan.tw - 1}`)
  record(
    t.sheet.tx === 4 && t.sheet.tw === 6 && t.sheet.th === 5,
    `the sheet spans x${t.sheet.tx} to x${t.sheet.tx + t.sheet.tw} at h${t.sheet.th}`,
  )
  record(t.plate.tx === 22, `the plate is at x${t.plate.tx}`)
  record(
    t.plate.secondsLeft() === 0 && t.plate.remaining() === 0,
    'unpressed, with an empty ring',
  )
  record(
    t.plate.targets.length === 1 && t.plate.targets[0] === t.sheet,
    'and it is linked to the sheet',
  )

  const overhang = base.solids.find((s) => s.x === 12 * TILE)
  record(
    !!overhang && overhang.w === 24 * TILE && overhang.y === base.surfaceY(8),
    `the overhang runs x12 to x${overhang ? (overhang.x + overhang.w) / TILE : '?'}, top ${FLOOR - overhang.y}px up`,
  )
  record(
    !!overhang && overhang.h === TILE,
    `one tile thick (${overhang?.h}px), so the floor is open underneath`,
  )

  // L3-7 filled the place this used to assert was empty.
  const bat = base.entities.byId('bat3a')
  record(!!bat, "3A's bat is built")
  const bb = bat.hurtBox()
  record(
    !!bb && M.abs((bb.left + bb.right) / 2 - 9.5 * TILE) < TILE,
    `hanging on the spec's anchor, x${((bb.left + bb.right) / 2 / TILE).toFixed(1)}`,
  )
  record(
    !!bb && M.abs((bb.top + bb.bottom) / 2 - base.surfaceY(12)) <= 24,
    'at h12, over the landing area',
  )
  // Its strip must not cap the fan: the column is x6-8 and the strip x8-11,
  // so they are adjacent. Move the strip one tile left and 3A dies.
  const strip = base.solids.find((sol) => sol.x === 8 * TILE)
  record(!!strip, 'its ceiling strip runs x8-11')
  record(
    !!strip && strip.h < TILE / 2,
    `a ${strip ? strip.h.toFixed(0) : '?'}px slab, something to hang from rather than stand on`,
  )
}

// =====================================================================
//  The sheet cuts the draught off.
// =====================================================================
{
  const t = room(7)
  record(t.sheet.isClosed(), 'the sheet starts closed')
  const shut = t.fan.column()
  record(
    M.abs(FLOOR - shut.top - 5 * TILE) <= SHEET_PX + 1,
    `so the column stops ${(FLOOR - shut.top).toFixed(0)}px up - just under the sheet at h5 (${5 * TILE}px)`,
  )

  // Riding it goes no higher than the sheet.
  let best = 0
  for (let f = 0; f < 60 * 6; f++) {
    t.step()
    best = M.max(best, up(t.p))
  }
  record(
    best < 5 * TILE,
    `riding the blocked fan tops out at ${best.toFixed(0)}px, under the sheet`,
  )
  record(
    best < 8 * TILE,
    `and nowhere near the ledge at ${8 * TILE}px`,
  )

  // Fold it aside and the column reaches its full height.
  t.sheet.trigger(0, 'unfold')
  for (let f = 0; f < 60; f++) t.step()
  record(!t.sheet.isClosed(), 'folded aside, it is no longer solid')
  const open = t.fan.column()
  record(
    M.abs(FLOOR - open.top - 10 * TILE) < 1,
    `and the column reaches ${(FLOOR - open.top).toFixed(0)}px, its full 10 tiles`,
  )
}

// --- the fold takes 0.4s, and collision goes at once ---
{
  const t = room(2)
  record(t.sheet.progress() === 0, 'closed sits at 0')
  t.sheet.trigger(0, 'unfold')
  t.step()
  record(
    !t.sheet.isClosed(),
    'collision is gone on the first frame of opening, so there is no edge to catch on',
  )
  let frames = 0
  while (t.sheet.progress() < 1 && frames++ < 300) t.step()
  record(
    M.abs(frames * FIXED_DT - SHEET_FOLD_MS / 1000) <= FIXED_DT * 2,
    `the fold takes ${(frames * FIXED_DT).toFixed(2)}s (spec ${SHEET_FOLD_MS / 1000})`,
  )
  record(t.log.sounds.includes('fold'), 'with a fold sound at the end')

  // And closing again takes the same time, solid only on arrival.
  t.sheet.trigger(0, 'fold')
  let back = 0
  while (t.sheet.progress() > 0 && back++ < 300) {
    t.step()
    if (t.sheet.progress() > 0) {
      if (t.sheet.isClosed()) back = 9999
    }
  }
  record(back < 9999, 'it is not solid again until it has arrived')
  record(
    M.abs(back * FIXED_DT - SHEET_FOLD_MS / 1000) <= FIXED_DT * 2,
    `coming back takes ${(back * FIXED_DT).toFixed(2)}s`,
  )
  record(t.sheet.isClosed(), 'and then it blocks again')
}

// --- nobody gets crushed ---
{
  // Open the sheet from outside the column, so the player is not already
  // riding past its line before the test begins.
  const t = room(20)
  t.sheet.trigger(0, 'unfold')
  for (let f = 0; f < 40; f++) t.step()
  record(t.sheet.progress() >= 1, 'sheet folded aside, player away from the fan')

  // Now step into the column and ride up into the sheet's line. It is a 4px
  // band against a 30px player, so the overlap is a window to catch.
  t.p.x = 7 * TILE
  t.p.y = FLOOR - PLAYER_H / 2
  t.step()
  let f = 0
  while (!t.level.occupied(t.sheet.space()) && f++ < 60 * 8) t.step()
  record(
    t.level.occupied(t.sheet.space()),
    `riding up, the player fills the sheet's space at ${up(t.p).toFixed(0)}px`,
  )

  t.sheet.trigger(0, 'fold')
  t.step()
  record(
    t.sheet.isWaiting(),
    'told to close with someone in the way, it waits instead',
  )
  record(!t.sheet.isClosed(), 'and stays out of the way')
  record(
    t.sheet.progress() > 0.9,
    `still folded aside (${t.sheet.progress().toFixed(2)})`,
  )

  // It keeps waiting for as long as the player is there.
  let held = 0
  while (held++ < 60) {
    // Hold the player in the sheet's line rather than letting the draught
    // carry them through it.
    t.p.y = t.sheet.space().top + 2 - t.p.halfH()
    t.p.vy = 0
    t.step()
  }
  record(
    t.sheet.isWaiting() && !t.sheet.isClosed(),
    'a second of standing in it and it is still waiting',
  )

  // Move clear and it closes.
  t.p.x = 20 * TILE
  t.p.y = FLOOR - PLAYER_H / 2
  let g = 0
  while (!t.sheet.isClosed() && g++ < 300) t.step()
  record(
    t.sheet.isClosed(),
    `once the space is clear it closes, ${(g * FIXED_DT).toFixed(2)}s later`,
  )
  record(!t.sheet.isWaiting(), 'and stops waiting')
}

// =====================================================================
//  The timed plate.
// =====================================================================
{
  const t = room(21)
  record(!t.plate.isPressed(), 'the plate starts up')
  t.input.dir = 1
  let f = 0
  while (!t.plate.isPressed() && f++ < 60 * 5) t.step()
  record(t.plate.isPressed(), `stepping on it presses it`)
  record(
    M.abs(t.plate.secondsLeft() - 7) < 0.1,
    `with ${t.plate.secondsLeft().toFixed(2)}s on the clock`,
  )
  record(t.sheet.progress() > 0 || t.sheet.isClosed() === false, 'and the sheet starts folding away')

  // The ring empties monotonically.
  let last = t.plate.remaining()
  let rose = false
  let held = 0
  t.input.dir = 0
  while (t.plate.isPressed() && held++ < 60 * 10) {
    t.step()
    const now = t.plate.remaining()
    if (now > last + 1e-9) rose = true
    last = now
  }
  record(!rose, 'the ring only ever empties, never fills')
  record(
    M.abs(held * FIXED_DT - 7) <= FIXED_DT * 2,
    `it stays down for ${(held * FIXED_DT).toFixed(2)}s (spec 7)`,
  )
  record(t.plate.remaining() === 0, 'and the ring is empty when it lets go')

  // Releasing closes the sheet again.
  let g = 0
  while (!t.sheet.isClosed() && g++ < 300) t.step()
  record(t.sheet.isClosed(), 'the release closes the sheet')

  // And it can be pressed again: the run has to be retryable.
  record(!t.plate.isPressed(), 'the plate is up again')
  record(
    !t.plate.isArmed(),
    'but not armed while you are still standing on it, so it cannot flicker',
  )
  // Step off, which re-arms it.
  t.p.x = 18 * TILE
  t.step()
  record(t.plate.isArmed(), 'stepping off re-arms it')
  t.input.dir = 1
  let h = 0
  while (!t.plate.isPressed() && h++ < 60 * 8) t.step()
  record(t.plate.isPressed(), 'and walking back onto it presses it again')
}

// =====================================================================
//  The ledge cannot be reached by jumping.  (the check you asked for)
// =====================================================================
{
  const LEDGE = base.surfaceY(8)
  let onTop = null
  let best = 0
  let tries = 0
  for (let x = 2; x <= 35; x += 0.5) {
    for (const plan of ['jump', 'jumpDash']) {
      tries++
      const t = room(x)
      // Sheet shut, so the fan is no help: this is legs only.
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
        if (t.p.grounded && foot(t.p) <= LEDGE + 1) onTop = `${x} by ${plan}`
      }
    }
  }
  record(
    onTop === null,
    `${tries} jump and jump-dash attempts across the floor: none reached the ledge (best ${best.toFixed(0)}px against ${FLOOR - LEDGE}px)`,
  )

  // Nor by riding the fan while the sheet is still shut.
  const r = room(7)
  let high = 0
  for (let f = 0; f < 60 * 8; f++) {
    r.step()
    if (r.p.grounded && foot(r.p) <= LEDGE + 1) high = 9999
    high = M.max(high, up(r.p))
  }
  record(
    high < 8 * TILE,
    `and riding the blocked fan reaches only ${high.toFixed(0)}px, so the plate is the only way up`,
  )
}

// =====================================================================
//  The switch-to-fan run fits inside 7 seconds.  (the check you asked for)
// =====================================================================
{
  const t = room(21)
  // Walk on to the plate.
  t.input.dir = 1
  let f = 0
  while (!t.plate.isPressed() && f++ < 60 * 5) t.step()
  record(t.plate.isPressed(), 'pressed the plate at x22')

  // Now run back to the column and ride.
  const col = t.fan.column()
  t.input.dir = -1
  let run = 0
  let arrived = false
  for (; run < 60 * 10; run++) {
    t.step()
    if (t.p.x < col.right - 6 && t.p.x > col.left + 6) {
      arrived = true
      break
    }
  }
  const secs = run * FIXED_DT
  record(arrived, `ran back to the column in ${secs.toFixed(2)}s`)
  record(
    arrived && t.plate.secondsLeft() > 0,
    `with ${t.plate.secondsLeft().toFixed(2)}s still on the clock - a margin of ${((t.plate.secondsLeft() / 7) * 100).toFixed(0)}%`,
  )
  record(
    secs < 7,
    `${secs.toFixed(2)}s against the 7s the plate allows`,
  )
  // And the sheet is out of the way by the time you get there.
  record(
    !t.sheet.isClosed() && t.sheet.progress() >= 1,
    'and the sheet has finished folding aside before you arrive',
  )
}

// =====================================================================
//  The draught lifts you onto the ledge.  (the check you asked for)
// =====================================================================
{
  const LEDGE = base.surfaceY(8)

  /**
   * Press the plate, walk back and settle on the fan, then ride and break
   * right. Settling matters: arriving with leftward momentum starts the
   * drift most of a tile further left, which is the difference between
   * landing and clipping the ledge's face.
   */
  function attempt(driftAt, dashAt) {
    const t = room(21)
    const col = t.fan.column()
    const mark = col.left + 1.1 * TILE
    t.input.dir = 1
    let f = 0
    while (!t.plate.isPressed() && f++ < 60 * 5) t.step()

    // Back to the fan, and stop on it.
    let g = 0
    while (g++ < 60 * 10) {
      if (!t.p.grounded) break
      const d = mark - t.p.x
      if (M.abs(d) < 5) break
      t.input.dir = M.sign(d)
      t.step()
    }
    t.input.dir = 0
    for (let k = 0; k < 6 && t.p.grounded; k++) t.step()

    // Ride.
    let dashed = false
    let apex = 0
    for (let k = 0; k < 60 * 12; k++) {
      const h = up(t.p)
      apex = M.max(apex, h)
      t.input.dir = h >= driftAt ? 1 : 0
      if (dashAt !== null && !dashed && h >= dashAt && !t.p.grounded) {
        t.input.dashPressed = true
        dashed = true
      }
      t.step()
      if (t.p.grounded && foot(t.p) <= LEDGE + 1 && t.p.x > 12 * TILE) {
        return { ok: true, margin: t.p.x - 12 * TILE, apex, dashed }
      }
      if (t.p.grounded && up(t.p) < 4 && k > 90) break
    }
    return { ok: false, margin: t.p.x - 12 * TILE, apex, dashed }
  }

  let wins = 0
  let tries = 0
  let best = null
  let noDash = null
  let nearest = -1e9
  for (const driftAt of [200, 240, 260, 280, 300, 320]) {
    for (const dashAt of [null, 240, 280, 300, 320, 340]) {
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
      ? `${wins} of ${tries} ride-and-drift lines land on the ledge`
      : `NONE of ${tries} lines reached it; the closest fell ${(-nearest).toFixed(0)}px short`,
  )
  if (best) {
    record(
      best.margin > 32,
      `the best clears the ledge's edge by ${best.margin.toFixed(0)}px`,
    )
    record(
      best.apex > FLOOR - LEDGE,
      `topping out ${best.apex.toFixed(0)}px up, ${(best.apex - (FLOOR - LEDGE)).toFixed(0)}px over the ledge`,
    )
    // The honest answer, not the one I guessed in the plan.
    record(
      best.dashed,
      'and it spends the air dash on the drift',
    )
    // Same story as 2C, which landed by 4px without a dash: technically
    // possible, far too fine to call a line.
    record(
      noDash === null || noDash.margin < 8,
      noDash === null
        ? 'and no line lands without it at all'
        : `without the dash one line scrapes on by ${noDash.margin.toFixed(0)}px - too fine to count on, so the dash is the real answer, exactly as in 2C`,
    )
  }
}

// =====================================================================
//  Levels 1 and 2 are untouched by the fan's new ceiling.
// =====================================================================
{
  for (const [name, data] of [['Level 1', level1], ['Level 2', level2]]) {
    const level = new Level(data)
    const fans = level.entities.all.filter((e) => e instanceof Fan)
    record(fans.length > 0, `${name} has ${fans.length} fan(s)`)
    for (const fan of fans) {
      // Enter the fan's own room, then tick it so the ceiling is computed.
      const room = level.roomAt(fan.centerX())
      if (room) level.startAt(room.id)
      const before = fan.column()
      level.update(FIXED_DT, {
        x: fan.centerX(), y: 0, vx: 0, grounded: false,
        justJumped: false, justDashed: false, justFolded: false,
        isFlat: () => false, halfW: () => 1, halfH: () => 1,
      })
      const after = fan.column()
      record(
        before.top === after.top,
        `${name}'s ${fan.id} column still tops out at ${after.top} - nothing hangs over it`,
      )
    }
  }
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
