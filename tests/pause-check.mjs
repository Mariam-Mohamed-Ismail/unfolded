// Step L2-10: the Level 2 end, and pausing in the middle of things.
//
// A paused Phaser scene simply stops being updated, so that is exactly how a
// pause is modelled here: skip N frames, then carry on. Which makes the test
// the strongest form of the claim — a run with a pause in it has to land in
// the same place as a run without one.
import { scene } from './stub-scene.mjs'
import { Level } from '../src/game/Level.ts'
import { Player } from '../src/game/Player.ts'
import { Sword } from '../src/game/Sword.ts'
import { Health } from '../src/game/Health.ts'
import { FixedClock } from '../src/game/Solutions.ts'
import { Records, roomLabel } from '../src/game/Records.ts'
import { summarise } from '../src/game/scenes/LevelCompleteScene.ts'
import { roomGroups } from '../src/game/levels/index.ts'
import { level1 } from '../src/game/levels/level1.ts'
import { level2 } from '../src/game/levels/level2.ts'
import {
  FIXED_DT,
  MAX_DT_MS,
  PLAYER_H,
  STEP_MS,
  TILE,
} from '../src/game/constants.ts'

const M = globalThis.Math
const out = []
const record = (ok, msg) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

const NO_FX = {
  dust: () => {}, shake: () => {}, zoom: () => {},
  sound: () => {}, label: () => {}, hum: () => {},
}

function blank() {
  return {
    dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
    dashPressed: false, flatHeld: false, swordPressed: false,
    slashPressed: false, resetPressed: false,
  }
}

/** A world with the sword and damage wired as GameScene wires them. */
function world(data, tileX, h = 0) {
  const level = new Level(data)
  const p = new Player(
    scene,
    tileX * TILE,
    level.surfaceY(h) - PLAYER_H / 2,
    level.solids,
  )
  const sword = new Sword()
  const health = new Health()
  const input = blank()
  let slash = false
  let hits = 0
  const step = () => {
    p.update(FIXED_DT, input, level.solids, level.updraftAt(p), sword.speedScale())
    level.update(FIXED_DT, p, NO_FX)
    sword.update(FIXED_DT, p, slash, level, NO_FX)
    health.update(FIXED_DT)
    const from = level.dangerAt(level.boxOf(p))
    if (from !== null && health.take()) {
      hits++
      p.hurt(M.sign(p.x - from) || 1)
    }
    input.jumpPressed = false
    input.jumpReleased = false
    input.dashPressed = false
    slash = false
  }
  step()
  return {
    level, p, sword, health, input, step,
    swing: () => { slash = true },
    hits: () => hits,
  }
}

const same = (a, b, tol = 0) => {
  if (a.length !== b.length) return `lengths ${a.length} vs ${b.length}`
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < a[i].length; k++) {
      if (M.abs(a[i][k] - b[i][k]) > tol) {
        return `point ${i} field ${k}: ${a[i][k]} vs ${b[i][k]}`
      }
    }
  }
  return null
}

// =====================================================================
//  Pausing in the middle of a slash.
// =====================================================================
{
  // Script a swing at 2B's seal, sampling the swing's state each frame.
  // `pauseAt` is the frame the overlay opens on; 0 means never.
  function swingRun(pauseAt, pauseFrames) {
    const t = world(level2, 48.6)
    t.level.swordOut = () => true
    const trace = []
    for (let f = 0; f < 60; f++) {
      if (f === 1) t.swing()
      if (f === pauseAt) {
        // Paused: no update at all, exactly as a paused scene behaves.
        for (let k = 0; k < pauseFrames; k++) trace.push(null)
      }
      t.step()
      trace.push([t.sword.progress(), t.p.x, t.p.y, t.sword.swinging() ? 1 : 0])
    }
    return {
      trace: trace.filter((v) => v !== null),
      cut: t.level.entities.byId('seal1').hurtBox() === null,
      dust: t.hits(),
    }
  }

  const plain = swingRun(0, 0)
  record(plain.cut, 'a swing at the seal cuts it')

  // Paused inside the active window: windup is 120ms, so frame 10 is live.
  const paused = swingRun(10, 120)
  record(paused.cut, 'and still cuts it with a two-second pause mid-swing')
  record(
    same(plain.trace, paused.trace) === null,
    same(plain.trace, paused.trace) === null
      ? `the swing runs identically either way, across all ${plain.trace.length} frames`
      : `the swing diverged: ${same(plain.trace, paused.trace)}`,
  )

  // The seal must be cut once, not twice, by a swing that spans a pause.
  const t = world(level2, 48.6)
  t.level.swordOut = () => true
  t.swing()
  let cuts = 0
  for (let f = 0; f < 60; f++) {
    const before = t.level.entities.byId('seal1').hurtBox()
    if (f === 10) {
      // the pause
    }
    t.step()
    const after = t.level.entities.byId('seal1').hurtBox()
    if (before !== null && after === null) cuts++
  }
  record(cuts === 1, `the seal is cut exactly once (${cuts})`)
}

// =====================================================================
//  Pausing in the middle of a dive.
// =====================================================================
{
  function diveRun(pauseFrames) {
    const t = world(level2, 45)
    const bat = t.level.entities.byId('bat1')
    // Wait for the dive to start.
    let f = 0
    while (bat.phase() !== 'dive' && f++ < 60 * 8) t.step()
    const trace = []
    // Partway along the curve, then pause.
    for (let k = 0; k < 8; k++) {
      t.step()
      trace.push(bat.at())
    }
    for (let k = 0; k < pauseFrames; k++) {
      // Paused. Nothing is updated, so nothing moves.
    }
    for (let k = 0; k < 40; k++) {
      t.step()
      trace.push(bat.at())
    }
    return { trace, phase: bat.phase(), hits: t.hits() }
  }

  const plain = diveRun(0)
  const paused = diveRun(180)
  record(
    plain.trace.length > 20,
    `a dive traced over ${plain.trace.length} frames`,
  )
  record(
    same(plain.trace, paused.trace) === null,
    same(plain.trace, paused.trace) === null
      ? 'a three-second pause mid-dive changes the path by not one pixel'
      : `the dive diverged: ${same(plain.trace, paused.trace)}`,
  )
  record(
    plain.phase === paused.phase,
    `and it ends in the same state (${paused.phase})`,
  )
  record(
    plain.hits === paused.hits,
    `costing the same ${paused.hits} hits`,
  )
}

// =====================================================================
//  Pausing in the middle of a fan's warning.
// =====================================================================
{
  function fanRun(pauseFrames) {
    const t = world(level2, 63)
    const fan = t.level.entities.byId('fanA')
    // Into the last 0.4s of the on-window.
    let f = 0
    while (!fan.isWarning() && f++ < 60 * 10) t.step()
    const atPause = [fan.isOn(), fan.isWarning()]
    for (let k = 0; k < pauseFrames; k++) {
      // Paused.
    }
    // Sample the schedule from here on.
    const sched = []
    for (let k = 0; k < 60 * 8; k++) {
      t.step()
      sched.push([fan.isOn() ? 1 : 0, fan.isWarning() ? 1 : 0])
    }
    return { atPause, sched }
  }

  const plain = fanRun(0)
  record(
    plain.atPause[0] && plain.atPause[1],
    'caught the fan on, inside its warning',
  )
  const paused = fanRun(300)
  record(
    paused.atPause[0] && paused.atPause[1],
    'and still warning after a five-second pause - the timer froze with it',
  )
  record(
    same(plain.sched, paused.sched) === null,
    same(plain.sched, paused.sched) === null
      ? `the whole on/off schedule afterwards is unshifted, over ${plain.sched.length} frames`
      : `the fan's schedule shifted: ${same(plain.sched, paused.sched)}`,
  )
}

// =====================================================================
//  Resuming cannot fast-forward, and the invulnerable second freezes.
// =====================================================================
{
  const clock = new FixedClock()
  clock.advance(1000 / 60)
  // The frame a resume lands on carries the whole pause as its delta.
  const burst = clock.advance(5000)
  record(
    burst <= 2,
    `a five-second pause yields ${burst} steps on resume, not ${M.round(5000 / STEP_MS)}: the ${M.round(MAX_DT_MS)}ms clamp drops it`,
  )
  record(clock.advance(1000 / 60) === 1, 'and the next frame is normal again')

  const h = new Health()
  h.take()
  for (let f = 0; f < 30; f++) h.update(FIXED_DT)
  const left = h.shield()
  // Paused: no updates.
  record(h.shield() === left, 'the invulnerable window does not tick while paused')
  let f = 0
  while (h.invulnerable() && f++ < 300) h.update(FIXED_DT)
  record(
    M.abs(f * FIXED_DT - left) <= FIXED_DT * 1.5,
    `and resumes with the ${left.toFixed(2)}s it had left`,
  )
}

// =====================================================================
//  The jump held across a pause: the finding, and the fix.
// =====================================================================
//
//  Phaser clears a scene's keys when it pauses, so on the first frame back
//  every key reads up. Input derives its edges against its own previous
//  frame, so without a resync it reports a release that never happened —
//  and a release is what cuts a jump short.
{
  /** `resync` true models Input.resync() running on resume. */
  function jumpAcrossPause(resync) {
    const t = world(level2, 10)
    t.input.jumpPressed = true
    t.input.jumpHeld = true
    t.step()
    // Rising, with the key still held.
    for (let f = 0; f < 4; f++) t.step()
    const rising = t.p.vy
    // The pause. Phaser has cleared the keys, so held reads false.
    // Without a resync, Input would compare false against its own true and
    // report jumpReleased on the first frame back.
    t.input.jumpHeld = false
    t.input.jumpReleased = !resync
    t.step()
    return { rising, after: t.p.vy }
  }

  const fixed = jumpAcrossPause(true)
  const broken = jumpAcrossPause(false)
  record(
    fixed.rising < -300,
    `mid-jump the player is rising at ${fixed.rising.toFixed(0)}px/s`,
  )
  record(
    M.abs(fixed.after - fixed.rising) < 60,
    `with the resync the jump keeps going (${fixed.after.toFixed(0)}px/s)`,
  )
  record(
    broken.after > fixed.after + 100,
    `without it the phantom release cuts the jump to ${broken.after.toFixed(0)}px/s - which is what resync() prevents`,
  )
}

// =====================================================================
//  The end of Level 2: time, resets and hits taken.
// =====================================================================
{
  record(
    summarise({ time: 83, resets: 2, hits: 1 }) === 'time 1:23   2 resets   1 hit',
    `"${summarise({ time: 83, resets: 2, hits: 1 })}"`,
  )
  record(
    summarise({ time: 5, resets: 1, hits: 0 }) === 'time 0:05   1 reset   0 hits',
    `"${summarise({ time: 5, resets: 1, hits: 0 })}" - both singulars`,
  )
  record(
    summarise({ time: 5, resets: 0, hits: 3 }).endsWith('3 hits'),
    `"${summarise({ time: 5, resets: 0, hits: 3 })}"`,
  )
  // Level 1 cannot hurt you, so it says nothing about hits at all.
  record(
    summarise({ time: 60, resets: 0 }) === 'time 1:00   0 resets',
    `and with no hits in the payload: "${summarise({ time: 60, resets: 0 })}"`,
  )
}

// --- the counter cannot drift from the health bar ---
{
  const h = new Health()
  let counted = 0
  // The same branch GameScene counts on.
  const hit = () => {
    if (!h.take()) return false
    counted++
    return true
  }
  record(hit() && counted === 1, 'a hit counts one')
  record(!hit() && counted === 1, 'a hit refused inside the window counts nothing')
  while (h.invulnerable()) h.update(FIXED_DT)
  record(hit() && counted === 2, 'the next real one counts')
  while (h.invulnerable()) h.update(FIXED_DT)
  record(hit() && counted === 3 && h.dead(), 'and the fatal one is counted too')
  record(
    counted === 3,
    `three hits taken, three counted - ${3 - h.hits} lost of 3`,
  )
}

// --- the whole 2C run, and what it finishes with ---
{
  const t = world(level2, 63)
  const colB = t.level.entities.byId('fanB').column()
  const PIT = t.level.surfaceY(-2)
  const TOP = t.level.surfaceY(4)
  const mark = colB.left + 1.2 * TILE
  const foot = () => t.p.y + t.p.halfH()
  let dashed = false
  let landed = false
  let frames = 0
  for (; frames < 60 * 60 && !t.level.finished(); frames++) {
    const up = PIT - foot()
    if (t.p.grounded && foot() <= TOP + 1) landed = true
    if (landed) t.input.dir = 1
    else if (t.p.grounded) t.input.dir = M.abs(t.p.x - mark) < 6 ? 0 : M.sign(mark - t.p.x)
    else if (up < 160) t.input.dir = 0
    else {
      t.input.dir = 1
      const free = t.level.updraftAt(t.p) === null
      if (!dashed && up > 180 && free && t.p.x > colB.left) {
        t.input.dashPressed = true
        dashed = true
      }
    }
    t.step()
  }
  record(t.level.finished(), 'the 2C run reaches the exit door')
  const line = summarise({ time: frames / 60, resets: 0, hits: t.hits() })
  record(
    line.includes('hit'),
    `and the screen would read "${line}"`,
  )
}

// =====================================================================
//  Records, for Level 2 as well as Level 1.
// =====================================================================
{
  const groups = roomGroups()
  record(groups.length === 2, `Room select is built from ${groups.length} levels`)
  // Level 1 has four: the movement lane is a room in its own right.
  record(
    groups[0].choices.length === 4 && groups[1].choices.length === 3,
    `listing ${groups.map((g) => g.choices.map((c) => c.room).join('/')).join(' and ')}`,
  )
  const ids = groups.flatMap((g) => g.choices.map((c) => c.room))
  record(
    new Set(ids).size === ids.length,
    'every room id is unique across both levels, which is what lets one records map serve both lists',
  )
  record(
    groups[1].choices.every((c) => c.level === 1),
    "and Level 2's entries carry level 1, so they start the right level",
  )

  const r = new Records()
  const name = groups[1].choices[2].name
  record(
    roomLabel(name, r.get('2c')) === name,
    `an unvisited room shows its bare name: "${roomLabel(name, r.get('2c'))}"`,
  )

  r.submit('2c', 12.5, 3)
  record(
    roomLabel(name, r.get('2c')).includes('0:12'),
    `a banked 2C visit shows up: "${roomLabel(name, r.get('2c'))}"`,
  )

  // The two minima are independent: a fast messy run and a slow clean one
  // each keep their own record.
  r.submit('2c', 9.0, 7)
  r.submit('2c', 30.0, 0)
  const rec = r.get('2c')
  record(
    rec.bestTime === 9 && rec.fewestResets === 0,
    `best time 9s from one run, fewest resets 0 from another: "${roomLabel(name, rec)}"`,
  )
  record(rec.attempts === 3, `over ${rec.attempts} banked visits`)

  // Level 1's rooms still work the same way.
  r.submit('1a', 4.25, 1)
  record(
    roomLabel(groups[0].choices[0].name, r.get('1a')).includes('0:04'),
    `and Level 1 is unchanged: "${roomLabel(groups[0].choices[0].name, r.get('1a'))}"`,
  )
  record(
    level1.rooms.length === 4 && level2.rooms.length === 3,
    `Level 1 declares ${level1.rooms.length} rooms and Level 2 declares ${level2.rooms.length}`,
  )
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
