// Records a solution for each Level 3 room and writes it where F3 looks.
//
//   npm run record
//
// A tool, like calibrate.mjs, not a check. It drives each room with a
// scripted route, samples it through the SAME Recorder the F2 key uses, and
// writes the SAME JSON the dev server writes on a POST — so a file from here
// is a file F3 loads, and one you record over it with F2 is a file
// solutions-check.mjs can read.
//
// These are the test drivers' routes, not human play: expect F3 to look
// efficient and a bit mechanical.
import { mkdirSync, writeFileSync } from 'node:fs'
import { Recorder, heldOf } from '../src/game/Solutions.ts'
import { level3 } from '../src/game/levels/level3.ts'
import { TILE } from '../src/game/constants.ts'
import { format } from '../vite.config.js'
import { openRoom } from './solution-harness.mjs'

const M = Math
const DIR = 'src/game/solutions'
/** Index of Level 3 in LEVELS, which the file is tagged with. */
const LEVEL = 2

/**
 * Drive one room, sampling every step through the recorder. `route` is
 * called each step with the world and may set `t.input`; it returns true
 * once the room is solved.
 */
function record(roomId, route, maxSeconds = 40) {
  const t = openRoom(level3, roomId)
  const rec = new Recorder(LEVEL, roomId)
  // The state the recording STARTS from, which is what a replay has to be
  // put back into. Reading it at the end instead was a real bug: every
  // Level 3 file claimed the blade began drawn when it began sheathed.
  const startedDrawn = t.level.swordOut()
  let solved = false
  // The four momentary keys as they were last step. A keyboard cannot press
  // one twice without releasing it, and Playback honours that: it derives
  // each press from an edge in the held state, so a route that sets one
  // every step is recorded as a single press and the file then replays a
  // different run from the one it recorded. Routes are written as conditions
  // ("slash while the bat is diving"), which is exactly that mistake, so the
  // release is inserted here once rather than remembered in every route.
  let down = { dash: false, sword: false, slash: false, reset: false }
  for (let f = 0; f < 60 * maxSeconds && !solved; f++) {
    solved = route(t, f) === true
    if (down.dash) t.input.dashPressed = false
    if (down.sword) t.input.swordPressed = false
    if (down.slash) t.input.slashPressed = false
    if (down.reset) t.input.resetPressed = false
    down = {
      dash: t.input.dashPressed,
      sword: t.input.swordPressed,
      slash: t.input.slashPressed,
      reset: t.input.resetPressed,
    }
    // Sampled after the route has set the input and before the step runs
    // it, which is the order GameScene samples in.
    rec.sample(heldOf(t.input))
    t.step()
  }
  const sol = rec.toSolution()
  sol.swordOut = startedDrawn
  return { sol, solved, t }
}

/** Walk toward a tile, returning true once settled there. */
function walkTo(t, tile, slack = 5) {
  const want = tile * TILE
  const d = want - t.p.x
  if (M.abs(d) < slack) {
    t.input.dir = 0
    return true
  }
  t.input.dir = M.sign(d)
  return false
}

// =====================================================================
//  3A: press the plate, run back, ride the freed column onto the ledge.
// =====================================================================
const a = record('3a', (t) => {
  const FLOOR = t.level.surfaceY(0)
  const LEDGE = t.level.surfaceY(8)
  const foot = t.p.y + t.p.halfH()
  const up = FLOOR - foot
  const plate = t.level.entities.byId('tsw3a')
  const col = t.level.entities.byId('fan3a').column()

  if (t.p.grounded && foot <= LEDGE + 1) {
    // On the ledge: walk clear of the edge and stop.
    return walkTo(t, 16)
  }
  if (!plate.isPressed()) {
    // Out to the plate under the overhang.
    t.input.dir = 1
    return false
  }
  if (t.p.grounded && up < 4) {
    // Back to the fan, and settle on the grille before riding.
    walkTo(t, (col.left + 1.1 * TILE) / TILE)
    return false
  }
  // Riding: hold still low, break right high, dash near the top.
  t.input.dir = up >= 240 ? 1 : 0
  if (up >= 340 && !t.p.grounded) t.input.dashPressed = true
  return false
})

// =====================================================================
//  3B: draw the blade, slide the slit, cut the seal, cross the bridge.
// =====================================================================
const b = record('3b', (t, f) => {
  const seal = t.level.entities.byId('seal3b')
  const bridge = t.level.entities.byId('bridge3b')
  const x = t.p.x / TILE

  // Draw the blade on the second step: the pieces are carried, so R is all
  // it takes, and one frame of settling first keeps the edge clean.
  if (f === 2) t.input.swordPressed = true

  if (!seal.isCut()) {
    // Flat through the pillar, upright after it, then swing at the tape.
    t.input.flatHeld = x > 38.5 && x < 45.8
    if (x > 50.4 && !t.p.isFlat()) {
      t.input.dir = 0
      t.input.slashPressed = true
      return false
    }
    t.input.dir = 1
    return false
  }
  // Wait out the concertina rather than walking into a half-open bridge.
  if (!bridge.isOpen()) {
    t.input.dir = 0
    return false
  }
  t.input.dir = 1
  return x > 69
}, 45)

// =====================================================================
//  3C: drop in, slide the slit, cut the seal, ride onto the platform.
// =====================================================================
// How long 3C has held still in the slit. Outside the route so it
// survives across frames.
let held = 0
const c = record('3c', (t, f) => {
  const SHAFT = t.level.surfaceY(0)
  const HIGH = t.level.surfaceY(14)
  const foot = t.p.y + t.p.halfH()
  const up = SHAFT - foot
  const seal = t.level.entities.byId('seal3c')
  const sheet = t.level.entities.byId('sheet3c')
  const snake = t.level.entities.byId('snake3c')
  const bat = t.level.entities.byId('bat3c')
  const col = t.level.entities.byId('fan3c').column()
  const x = t.p.x / TILE

  if (f === 2) t.input.swordPressed = true

  if (t.p.grounded && foot <= HIGH + 1 && x > 108) {
    // On the platform: on to the door.
    t.input.dir = 1
    return t.level.finished()
  }

  // Swat at the bat whenever it commits to a dive and is close, whatever
  // else is going on. Measured: without this the ride costs three hits -
  // one per attempt, always at the top of the column - because the bat
  // hangs in the only drift path. With it, one.
  const bb = bat.hurtBox()
  const close =
    bb &&
    M.hypot((bb.left + bb.right) / 2 - t.p.x, (bb.top + bb.bottom) / 2 - t.p.y) < 70
  if (bat.phase() === 'dive' && close && !t.p.isFlat()) {
    t.input.slashPressed = true
    t.input.dir = up > 400 ? 1 : 0
    return false
  }

  if (!seal.isCut()) {
    // Off the ledge, down the shaft, then hole up flat in the slit for a
    // second: the snake cannot see a hidden player, so this takes its
    // whole cycle off the table before the dash for the seal.
    const inSlit = x > 90.2 && x < 93.3
    if (inSlit && held < 60) {
      held++
      t.input.flatHeld = true
      t.input.dir = 0
      return false
    }
    // Fold on the shaft floor, not on the way down to it: starting a fold in
    // mid-air is the Quick fold crease now (L3-8), and this route has to work
    // without any crease. Already flat counts, so the fold is not dropped the
    // moment the slit's floor stops counting as ground.
    t.input.flatHeld = x > 88.5 && x < 92.8 && (t.p.grounded || t.p.isFlat())
    if (x > 97.4 && !t.p.isFlat()) {
      t.input.dir = 0
      t.input.slashPressed = true
      return false
    }
    t.input.dir = 1
    void snake
    return false
  }
  if (!sheet.isWaiting() && sheet.progress() < 1) {
    // Let the sheet finish folding aside before stepping on the grille.
    t.input.dir = 0
    return false
  }
  if (t.p.grounded && up < 4) {
    walkTo(t, (col.left + 1.1 * TILE) / TILE)
    return false
  }
  t.input.dir = up >= 440 ? 1 : 0
  if (up >= 512 && !t.p.grounded) t.input.dashPressed = true
  return false
}, 50)

// =====================================================================
mkdirSync(DIR, { recursive: true })
for (const { sol, solved, t } of [a, b, c]) {
  writeFileSync(`${DIR}/${sol.room}.json`, format(sol), 'utf8')
  const where = `x${(t.p.x / TILE).toFixed(1)}`
  console.log(
    `${sol.room}: ${solved ? 'SOLVED' : 'NOT SOLVED'}  ` +
      `${sol.steps} steps (${(sol.steps / 60).toFixed(1)}s), ` +
      `${sol.events.length} events, ends at ${where}` +
      `${sol.swordOut ? ', blade out' : ''}`,
  )
}
console.log(`\nwritten to ${DIR}/`)
