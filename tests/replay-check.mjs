// Step L2-6: the fixed step and the solution recorder.
//
// The claim being tested is the one the whole step rests on: the same inputs
// produce the same result, whatever the frame rate.
import { scene } from './stub-scene.mjs'
import { Player } from '../src/game/Player.ts'
import { Level } from '../src/game/Level.ts'
import { level1 } from '../src/game/levels/level1.ts'
import { level2 } from '../src/game/levels/level2.ts'
import {
  ACTIONS,
  FixedClock,
  Playback,
  Recorder,
  heldOf,
  noneHeld,
  tuningDrift,
  tuningNow,
} from '../src/game/Solutions.ts'
import {
  FIXED_DT,
  MAX_DT_MS,
  PLAYER_H,
  STEP_HZ,
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

// =====================================================================
//  FixedClock: the display's frame rate must not reach the simulation.
// =====================================================================
{
  const runFor = (seconds, hz, jitter = 0) => {
    const clock = new FixedClock()
    const frames = M.round(seconds * hz)
    let steps = 0
    const perFrame = []
    for (let f = 0; f < frames; f++) {
      // A deterministic wobble either side of the true frame time, which is
      // what a real display delivers.
      const wobble = jitter === 0 ? 0 : (f % 2 === 0 ? jitter : -jitter)
      const n = clock.advance(1000 / hz + wobble)
      steps += n
      perFrame.push(n)
    }
    return { steps, perFrame }
  }

  for (const hz of [60, 75, 120, 144]) {
    const got = runFor(10, hz)
    const note = hz === STEP_HZ ? 'which is also its frame count' : `not its ${10 * hz} frames`
    record(
      M.abs(got.steps - 10 * STEP_HZ) <= 1,
      `a ${hz}Hz display runs ${got.steps} steps in 10s — ${note}`,
    )
  }
  const slow = runFor(10, 30)
  record(
    M.abs(slow.steps - 10 * STEP_HZ) <= 1,
    `a 30Hz display still runs ${slow.steps} steps in 10s, two per frame`,
  )
  record(
    M.max(...slow.perFrame) <= 2,
    `and never more than ${M.max(...slow.perFrame)} steps in one frame, so there is no runaway`,
  )

  const even = runFor(10, 60)
  record(
    even.perFrame.every((n) => n === 1),
    'at exactly 60Hz it is one step per frame, every frame',
  )

  const jittery = runFor(10, 60, 1.2)
  record(
    M.abs(jittery.steps - 10 * STEP_HZ) <= 1,
    `with +/-1.2ms of jitter it is still ${jittery.steps} steps in 10s (leftover time is kept, not dropped)`,
  )

  // A stall: the clamp throws the lost time away rather than simulating it.
  const stalled = new FixedClock()
  stalled.advance(1000 / 60)
  const after = stalled.advance(2000)
  record(
    after <= 2,
    `a 2s stall yields ${after} steps, not ${M.round(2000 / STEP_MS)}: the ${M.round(MAX_DT_MS)}ms clamp drops it`,
  )
  record(
    stalled.advance(1000 / 60) === 1,
    'and the clock is back to normal on the next frame',
  )
  record(
    M.abs(FIXED_DT * STEP_HZ - 1) < 1e-12,
    `the step is ${STEP_HZ} per second, dt ${FIXED_DT.toFixed(5)}s`,
  )
}

// =====================================================================
//  The codec: what is recorded must be exactly what comes back.
// =====================================================================
{
  // A stream that exercises every edge case I could think of: two actions
  // changing on the same step, an action tapped for one step, one held from
  // step 0, and one still held when the recording ends.
  const stream = []
  for (let s = 0; s < 40; s++) {
    const h = noneHeld()
    h.right = s < 30
    h.left = s >= 32
    h.jump = s >= 5 && s < 12
    h.dash = s === 12
    h.flat = s >= 20 && s < 22
    h.sword = s === 20
    h.slash = s === 21
    h.reset = s === 39
    stream.push(h)
  }

  const rec = new Recorder(1, '2c')
  for (const h of stream) rec.sample(h)
  const sol = rec.toSolution()

  record(sol.steps === 40, `40 steps recorded as ${sol.events.length} events`)
  record(
    sol.events.every((e) => ACTIONS.includes(e[1]) && (e[2] === 0 || e[2] === 1)),
    'every event is [step, action, down|up]',
  )
  record(
    sol.events.every((e, i) => i === 0 || e[0] >= sol.events[i - 1][0]),
    'in step order',
  )
  // Every step's event count must equal the number of actions that changed
  // on it — the property, rather than one hand-counted step.
  let worst = null
  let busiest = 0
  for (let s = 0; s < 40; s++) {
    const prev = s === 0 ? noneHeld() : stream[s - 1]
    const changed = ACTIONS.filter((a) => stream[s][a] !== prev[a]).length
    const emitted = sol.events.filter((e) => e[0] === s).length
    busiest = M.max(busiest, changed)
    if (changed !== emitted && worst === null) {
      worst = `step ${s}: ${changed} changed, ${emitted} emitted`
    }
  }
  record(
    worst === null,
    worst ?? `every step emits one event per action that changed (busiest step changes ${busiest} at once)`,
  )
  record(sol.hz === STEP_HZ, `tagged ${sol.hz}Hz`)
  record(sol.level === 1 && sol.room === '2c', 'and tagged with level and room')

  const play = new Playback(sol)
  let same = true
  let firstBad = -1
  for (let s = 0; s < 40; s++) {
    const got = play.next()
    for (const a of ACTIONS) {
      if (got[a] !== stream[s][a] && firstBad < 0) {
        same = false
        firstBad = s
      }
    }
  }
  record(same, same ? 'decoded back identically at all 40 steps' : `decode differs at step ${firstBad}`)
  record(play.done, 'and the playback reports itself finished')

  // The edges playback writes must match what Input would have derived.
  const fake = { dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
    dashPressed: false, flatHeld: false, swordPressed: false, slashPressed: false,
    resetPressed: false }
  const p2 = new Playback(sol)
  const edges = { jumpPressed: [], jumpReleased: [], dashPressed: [] }
  for (let s = 0; s < 40; s++) {
    p2.apply(fake)
    for (const k of Object.keys(edges)) if (fake[k]) edges[k].push(s)
  }
  record(
    edges.jumpPressed.length === 1 && edges.jumpPressed[0] === 5,
    `jump reads as pressed once, at step ${edges.jumpPressed.join()}`,
  )
  record(
    edges.jumpReleased.length === 1 && edges.jumpReleased[0] === 12,
    `and released once, at step ${edges.jumpReleased.join()}`,
  )
  record(
    edges.dashPressed.length === 1 && edges.dashPressed[0] === 12,
    `the one-step dash reads as a single press, at step ${edges.dashPressed.join()}`,
  )

  // heldOf is the other half of the round trip: Input's fields in, Held out.
  const sampled = heldOf({
    dir: -1, jumpHeld: true, flatHeld: false, dashPressed: true,
    swordPressed: false, slashPressed: true, resetPressed: false,
  })
  record(
    sampled.left && !sampled.right && sampled.jump && sampled.dash && sampled.slash,
    'heldOf turns a negative dir into left, and the edges into their actions',
  )
  record(
    !heldOf({ dir: 0, jumpHeld: false, flatHeld: false, dashPressed: false,
      swordPressed: false, slashPressed: false, resetPressed: false }).left,
    'and dir 0 is neither, so holding both keys records as neither',
  )
}

// =====================================================================
//  The tuning guard.
// =====================================================================
{
  const rec = new Recorder(0, '1a')
  rec.sample(noneHeld())
  const sol = rec.toSolution()
  record(
    Object.keys(sol.tuning).length === 11,
    `a solution carries all ${Object.keys(sol.tuning).length} live-tunable numbers`,
  )
  record(tuningDrift(sol).length === 0, 'and matches the live ones it was made from')

  const moved = { ...sol, tuning: { ...sol.tuning, JUMP_VELOCITY: -520, MAX_SPEED: 999 } }
  const drift = tuningDrift(moved)
  record(
    drift.length === 2 && drift.includes('JUMP_VELOCITY'),
    `a retuned file is caught, naming ${drift.join(' and ')}`,
  )
  record(
    tuningNow().MAX_SPEED !== 999,
    'without the check it would have replayed against different physics',
  )
}

// =====================================================================
//  Determinism, which is the point of the whole step.
// =====================================================================

/** Runs a recorded solution against a fresh level, sampling the player. */
function run(data, tileX, h, sol, stepsPerFrame = 1) {
  const level = new Level(data)
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
  const play = new Playback(sol)
  const trace = []
  let pending = 0
  // Frames, each spending `stepsPerFrame` steps, to prove the result does not
  // depend on how the steps are grouped.
  while (!play.done) {
    pending += stepsPerFrame
    while (pending >= 1 && !play.done) {
      pending -= 1
      play.apply(input)
      p.update(FIXED_DT, input, level.solids, level.updraftAt(p))
      level.update(FIXED_DT, p, NO_FX)
      trace.push([p.x, p.y, p.vx, p.vy])
    }
  }
  return { level, p, trace }
}

/** Captures a driver's inputs into a solution, the way F2 would. */
function capture(level, room, drive) {
  const rec = new Recorder(level, room)
  drive((input) => rec.sample(heldOf(input)))
  return rec.toSolution()
}

const diff = (a, b) => {
  if (a.length !== b.length) return `lengths ${a.length} vs ${b.length}`
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < 4; k++) {
      if (a[i][k] !== b[i][k]) return `step ${i}, field ${k}: ${a[i][k]} vs ${b[i][k]}`
    }
  }
  return null
}

// --- Level 2, room 2C: the real solution, captured and replayed ---
{
  // The same route room2c-check proves: walk the pit to Fan B, ride it,
  // break right and dash onto the platform.
  const sol = capture(1, '2c', (sample) => {
    const level = new Level(level2)
    const PIT = level.surfaceY(-2)
    const TOP = level.surfaceY(4)
    const p = new Player(scene, 63 * TILE, level.surfaceY(0) - PLAYER_H / 2, level.solids)
    const input = {
      dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
      dashPressed: false, flatHeld: false, swordPressed: false,
      slashPressed: false, resetPressed: false,
    }
    const colB = level.entities.byId('fanB').column()
    const mark = colB.left + 1.2 * TILE
    const foot = () => p.y + p.halfH()
    let dashed = false
    let landed = false
    for (let f = 0; f < 60 * 12 && !level.finished(); f++) {
      const up = PIT - foot()
      if (p.grounded && foot() <= TOP + 1) landed = true
      input.dashPressed = false
      if (landed) input.dir = 1
      else if (p.grounded) input.dir = M.abs(p.x - mark) < 6 ? 0 : M.sign(mark - p.x)
      else if (up < 160) input.dir = 0
      else {
        input.dir = 1
        if (!dashed && up > 180 && level.updraftAt(p) === null && p.x > colB.left) {
          input.dashPressed = true
          dashed = true
        }
      }
      sample(input)
      p.update(FIXED_DT, input, level.solids, level.updraftAt(p))
      level.update(FIXED_DT, p, NO_FX)
    }
  })

  record(
    sol.events.length > 0 && sol.steps > 60,
    `2C's route records as ${sol.events.length} events over ${sol.steps} steps (${(sol.steps / STEP_HZ).toFixed(1)}s)`,
  )

  const a = run(level2, 63, 0, sol)
  record(a.level.finished(), 'replaying the file finishes room 2C')

  const b = run(level2, 63, 0, sol)
  record(
    diff(a.trace, b.trace) === null,
    diff(a.trace, b.trace) === null
      ? `two replays agree on x, y, vx and vy at all ${a.trace.length} steps`
      : `the two replays diverged: ${diff(a.trace, b.trace)}`,
  )

  // The property the fixed step exists for: how the steps are grouped into
  // frames must not change the outcome.
  const doubled = run(level2, 63, 0, sol, 2)
  const half = run(level2, 63, 0, sol, 0.5)
  record(
    diff(a.trace, doubled.trace) === null,
    'two steps per frame lands in exactly the same places',
  )
  record(
    diff(a.trace, half.trace) === null,
    'and so does one step every other frame',
  )
  record(
    doubled.level.finished() && half.level.finished(),
    'both still finish the room',
  )
}

// --- Level 1: the same claim, in the other level ---
{
  const sol = capture(0, '1a', (sample) => {
    const level = new Level(level1)
    const p = new Player(
      scene,
      level.startPoint().x,
      level.startPoint().y,
      level.solids,
    )
    const input = {
      dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
      dashPressed: false, flatHeld: false, swordPressed: false,
      slashPressed: false, resetPressed: false,
    }
    // Run, jump, hold, dash, fold: enough of the move set that a divergence
    // anywhere in the controller would show up.
    for (let f = 0; f < 240; f++) {
      input.dir = 1
      input.jumpPressed = f === 30 || f === 120
      input.jumpHeld = (f >= 30 && f < 50) || (f >= 120 && f < 128)
      input.jumpReleased = f === 50 || f === 128
      input.dashPressed = f === 70
      input.flatHeld = f >= 160 && f < 190
      sample(input)
      p.update(FIXED_DT, input, level.solids, level.updraftAt(p))
      level.update(FIXED_DT, p, NO_FX)
    }
  })

  record(sol.level === 0, `a Level 1 recording is tagged level ${sol.level}`)
  const one = run(level1, 2, 0, sol)
  const two = run(level1, 2, 0, sol)
  const grouped = run(level1, 2, 0, sol, 2)
  record(
    diff(one.trace, two.trace) === null,
    `two Level 1 replays agree at all ${one.trace.length} steps`,
  )
  record(
    diff(one.trace, grouped.trace) === null,
    'and grouping the steps two to a frame changes nothing there either',
  )
  record(
    one.trace.some((t, i) => i > 0 && t[1] !== one.trace[i - 1][1]),
    'the recording actually moved the player, so this is not a trace of standing still',
  )
}

// --- a replay must not depend on what the keyboard is doing ---
{
  const rec = new Recorder(1, '2c')
  for (let s = 0; s < 20; s++) {
    const h = noneHeld()
    h.right = true
    rec.sample(h)
  }
  const sol = rec.toSolution()

  // Playback writes over a "keyboard" that is holding everything down.
  const noisy = {
    dir: -1, jumpPressed: true, jumpReleased: true, jumpHeld: true,
    dashPressed: true, flatHeld: true, swordPressed: true,
    slashPressed: true, resetPressed: true,
  }
  const play = new Playback(sol)
  play.apply(noisy)
  record(
    noisy.dir === 1 && !noisy.jumpHeld && !noisy.dashPressed && !noisy.flatHeld,
    'playback overwrites every field it owns, so a held key cannot leak in',
  )
  record(
    !noisy.swordPressed && !noisy.slashPressed && !noisy.resetPressed,
    'including the sword, the slash and the reset',
  )
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
