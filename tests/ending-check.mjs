// Step L3-10: the ending, and the Game complete screen after it.
import { scene } from './stub-scene.mjs'
import { Ending, foldsOf } from '../src/game/Ending.ts'
import { Flow } from '../src/game/Flow.ts'
import { Level } from '../src/game/Level.ts'
import { Player } from '../src/game/Player.ts'
import { LEVELS } from '../src/game/levels/index.ts'
import { level3 } from '../src/game/levels/level3.ts'
import {
  creasesLine,
  playAgain,
  replayLine,
  totalsLine,
} from '../src/game/scenes/GameCompleteScene.ts'
import { clearCreases, rounds, setCrease } from '../src/game/Upgrades.ts'
import {
  END_DRIFT_END_S,
  END_SHEET_FRAC,
  END_SKIP_AFTER_S,
  END_TILE_PX,
  END_TOTAL_S,
  END_UNFOLD_EACH_S,
  FIXED_DT,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_H,
  SFX_CHIME_NOTES,
  TILE,
} from '../src/game/constants.ts'

const M = Math
const out = []
const record = (ok, msg) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)
const VIEW = { w: GAME_WIDTH, h: GAME_HEIGHT }

/**
 * The real figure, standing at the 3C door, as nine screen-space triangles.
 * Built by the real Player and PlayerView, so the ending is tested against
 * the shape it will actually be handed.
 */
function figure() {
  const level = new Level(level3)
  const p = new Player(scene, 117 * TILE, level.surfaceY(14) - PLAYER_H / 2, level.solids)
  // A few frames standing, so the figure has been drawn - by the time a
  // player reaches the door it has been drawn every frame.
  const input = {
    dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
    dashPressed: false, flatHeld: false, swordPressed: false,
    slashPressed: false, resetPressed: false,
  }
  for (let f = 0; f < 10; f++) p.update(FIXED_DT, input, level.solids)
  // Into screen space as GameScene does, with the camera somewhere plausible.
  const camX = p.x - GAME_WIDTH / 2
  const camY = p.y - GAME_HEIGHT * 0.6
  return p.view.pieces().map((t) => t.map(([x, y]) => [x - camX, y - camY]))
}

/** Run an ending to the end, logging chimes and when each phase began. */
function play(skipAt = null) {
  const chimes = []
  const e = new Ending(figure(), LEVELS, VIEW, (i) => chimes.push({ i, t: e.time() }))
  const phases = []
  let steps = 0
  while (!e.done() && steps < 60 * 30) {
    const skip = skipAt !== null && e.time() >= skipAt
    e.update(FIXED_DT, skip)
    const ph = e.phase()
    if (phases.at(-1)?.ph !== ph) phases.push({ ph, t: e.time() })
    steps++
  }
  return { e, chimes, phases }
}

// =====================================================================
//  The figure it starts from.
// =====================================================================
{
  const tris = figure()
  record(tris.length === 9, `the figure hands over ${tris.length} triangles`)
  const e = new Ending(tris, LEVELS, VIEW, () => {})
  const shapes = e.shapes()
  // At t=0 each piece is its triangle exactly, as a quad with the last
  // corner doubled.
  let worst = 0
  shapes.forEach((q, i) => {
    for (let k = 0; k < 3; k++) {
      worst = M.max(worst, M.hypot(q[k][0] - tris[i][k][0], q[k][1] - tris[i][k][1]))
    }
  })
  record(worst < 1e-6, `and the ending starts from exactly where they stood (${worst.toExponential(1)}px off)`)
}

// =====================================================================
//  The length and the order of the beats.
// =====================================================================
{
  const { e, chimes, phases } = play()
  record(
    M.abs(e.time() - END_TOTAL_S) <= FIXED_DT + 1e-9,
    `the sequence runs ${e.time().toFixed(2)}s (spec: about 12)`,
  )
  record(!e.wasSkipped(), 'played through rather than skipped')

  const order = phases.map((p) => p.ph).join(' > ')
  record(
    order === 'freeze > drift > unfold > sheet > pull > title > done',
    `in the spec's order: ${order}`,
  )
  const at = (ph) => phases.find((p) => p.ph === ph)?.t ?? NaN
  record(
    at('drift') < 1 && at('unfold') >= END_DRIFT_END_S - FIXED_DT,
    `the pieces drift from ${at('drift').toFixed(2)}s and start unfolding at ${at('unfold').toFixed(2)}s`,
  )
  record(at('title') >= 9.9 && at('title') < 10.1, `the title begins at ${at('title').toFixed(2)}s`)

  // --- nine chimes, rising ---
  record(chimes.length === 9, `${chimes.length} chimes, one per tile`)
  record(chimes.every((c, k) => c.i === k), 'played in order, 0 to 8')
  const gaps = chimes.slice(1).map((c, k) => c.t - chimes[k].t)
  record(
    gaps.every((g) => M.abs(g - END_UNFOLD_EACH_S) <= FIXED_DT + 1e-9),
    `half a second apart (${gaps.map((g) => g.toFixed(2)).join(', ')})`,
  )
  record(
    SFX_CHIME_NOTES.length === 9 &&
      SFX_CHIME_NOTES.every((hz, k) => k === 0 || hz > SFX_CHIME_NOTES[k - 1]),
    `each note higher than the last: ${SFX_CHIME_NOTES.map((h) => h.toFixed(0)).join(' ')} Hz`,
  )
}

// =====================================================================
//  Nine pieces become one square.
// =====================================================================
{
  const e = new Ending(figure(), LEVELS, VIEW, () => {})
  // Step to just after the last tile lands.
  const last = END_DRIFT_END_S + 9 * END_UNFOLD_EACH_S
  while (e.time() < last + 0.05) e.update(FIXED_DT, false)
  const shapes = e.shapes()
  const squareOk = shapes.every((q) => {
    const xs = q.map((p) => p[0])
    const ys = q.map((p) => p[1])
    const w = M.max(...xs) - M.min(...xs)
    const h = M.max(...ys) - M.min(...ys)
    return M.abs(w - END_TILE_PX) < 0.01 && M.abs(h - END_TILE_PX) < 0.01
  })
  record(squareOk, `every piece has opened into a ${END_TILE_PX}px square tile`)

  const all = shapes.flat()
  const w = M.max(...all.map((p) => p[0])) - M.min(...all.map((p) => p[0]))
  const h = M.max(...all.map((p) => p[1])) - M.min(...all.map((p) => p[1]))
  record(
    M.abs(w - END_TILE_PX * 3) < 0.01 && M.abs(h - END_TILE_PX * 3) < 0.01,
    `and together they make one ${w.toFixed(0)}x${h.toFixed(0)} square`,
  )
  // No two tiles share a place.
  const centres = shapes.map((q) => [
    q.reduce((s, p) => s + p[0], 0) / 4,
    q.reduce((s, p) => s + p[1], 0) / 4,
  ])
  let overlap = false
  for (let a = 0; a < 9; a++) {
    for (let b = a + 1; b < 9; b++) {
      if (M.hypot(centres[a][0] - centres[b][0], centres[a][1] - centres[b][1]) < END_TILE_PX - 0.01) {
        overlap = true
      }
    }
  }
  record(!overlap, 'with no two tiles in the same place')
}

// =====================================================================
//  The pull-back, and the creases that are the levels.
// =====================================================================
{
  const folds = foldsOf(LEVELS)
  const n = LEVELS.length
  const horizontals = folds.filter((f) => f[1] === f[3] && f[0] === 0 && f[2] === 1)
  record(
    horizontals.length >= n - 1,
    `${n} levels, so ${n - 1} folds divide the sheet into bands`,
  )
  // One upright fold per room boundary, in that level's band.
  for (const [k, level] of LEVELS.entries()) {
    const top = k / n
    const bottom = (k + 1) / n
    const uprights = folds.filter(
      (f) => f[0] === f[2] && f[1] === top && f[3] === bottom,
    )
    record(
      uprights.length === level.rooms.length - 1,
      `${level.name}: ${uprights.length} upright folds for its ${level.rooms.length} rooms`,
    )
    const flat = folds.filter(
      (f) => f[1] === f[3] && f[1] > top && f[1] <= bottom && !(f[0] === 0 && f[2] === 1 && f[1] === bottom),
    )
    record(
      flat.length > 0,
      `and ${flat.length} level folds from its platforms, all inside its band`,
    )
  }
  const inside = folds.every((f) => f.every((v) => v >= 0 && v <= 1))
  record(inside, `all ${folds.length} creases lie on the sheet`)

  // The sheet once the camera has backed away.
  const e = new Ending(figure(), LEVELS, VIEW, () => {})
  while (e.time() < 10.0) e.update(FIXED_DT, false)
  const s = e.sheet()
  record(
    M.abs(s.side - GAME_HEIGHT * END_SHEET_FRAC) < 0.5,
    `the sheet fills the view: ${s.side.toFixed(0)}px of ${GAME_HEIGHT}`,
  )
  record(
    M.abs(s.x + s.side / 2 - GAME_WIDTH / 2) < 0.5 && M.abs(s.y + s.side / 2 - GAME_HEIGHT / 2) < 0.5,
    'centred on the screen',
  )

  // Drawn: the backdrop and every crease, with nothing thrown.
  const calls = { rects: 0, lines: 0 }
  const g = {
    fillStyle: () => g, lineStyle: () => g,
    fillRect: () => { calls.rects++; return g },
    strokeRect: () => g,
    lineBetween: () => { calls.lines++; return g },
    fillPoints: () => g, strokePoints: () => g,
  }
  e.draw(g)
  record(
    calls.rects >= 2 && calls.lines >= folds.length,
    `at the end of the pull the backdrop, the sheet and ${calls.lines} lines are drawn`,
  )
}

// --- the title ---
{
  const e = new Ending(figure(), LEVELS, VIEW, () => {})
  while (e.time() < 9.9) e.update(FIXED_DT, false)
  const before = e.titleAlpha()
  while (e.time() < 11.2) e.update(FIXED_DT, false)
  const after = e.titleAlpha()
  record(before === 0, 'the title is not there during the pull-back')
  record(after === 1, '"Unfolded" has faded fully in by 11s')
}

// =====================================================================
//  Skipping.
// =====================================================================
{
  const early = new Ending(figure(), LEVELS, VIEW, () => {})
  while (early.time() < END_SKIP_AFTER_S - 0.1) early.update(FIXED_DT, false)
  early.update(FIXED_DT, true)
  record(!early.done(), `Enter at ${early.time().toFixed(2)}s does nothing`)

  const { e, chimes } = play(END_SKIP_AFTER_S + 0.1)
  record(
    e.done() && e.wasSkipped(),
    `Enter at ${(END_SKIP_AFTER_S + 0.1).toFixed(1)}s ends the sequence at ${e.time().toFixed(2)}s`,
  )
  record(chimes.length === 0, 'before a single tile has landed')
}

// =====================================================================
//  Routing and the run totals.
// =====================================================================
function harness() {
  const started = []
  const handlers = {}
  const ops = {
    key: 'Game',
    start: (k, d) => started.push({ k, d }),
    stop: () => {}, pause: () => {}, resume: () => {}, launch: () => {},
  }
  const top = {
    scene: ops,
    sys: { settings: { key: 'Game' }, isActive: () => true, isPaused: () => false },
    cameras: { main: { once: (_e, cb) => cb(), fadeOut: () => {}, fadeIn: () => {} } },
  }
  const game = {
    events: {
      on: (name, fn) => { handlers[name] = fn },
      emit: (name, data) => handlers[name]?.(data),
    },
    registry: { get: () => undefined },
    scene: {
      getScene: (k) => (k === 'Game' ? top : null),
      getScenes: () => [top],
      isActive: () => false,
    },
  }
  const flow = new Flow(game)
  return { flow, started, emit: game.events.emit }
}

{
  clearCreases()
  setCrease('glider')
  setCrease('quick')
  const { flow, started, emit } = harness()

  flow.startGame({ level: 0 })
  emit('level:finished', { level: 0, time: 10, resets: 1 })
  record(started.at(-1).k === 'LevelComplete', 'Level 1 still ends on Level complete')

  flow.startGame({ level: 1, carry: true })
  emit('level:finished', { level: 1, time: 20, resets: 2, hits: 3 })
  record(started.at(-1).k === 'LevelComplete', 'and so does Level 2')

  flow.startGame({ level: 2, carry: true })
  emit('level:finished', { level: 2, time: 30, resets: 0, hits: 1 })
  const last = started.at(-1)
  record(last.k === 'GameComplete', `Level 3 goes to ${last.k}`)
  record(
    last.d.time === 60 && last.d.resets === 3 && last.d.hits === 4,
    `with the whole run added up: ${JSON.stringify(last.d)}`,
  )

  // A fresh start begins a new run.
  flow.startGame({ level: 2, roomId: '3c' })
  emit('level:finished', { level: 2, time: 7, resets: 0, hits: 0 })
  record(
    started.at(-1).d.time === 7,
    `from Room select straight into 3C, the total is just 3C (${started.at(-1).d.time}s)`,
  )

  // So does a different room from the pause overlay.
  flow.startGame({ level: 1, carry: true })
  emit('level:finished', { level: 1, time: 5, resets: 0, hits: 0 })
  emit('game:restart', { level: 2, roomId: '3a' })
  record(flow.totals().time === 0, 'a restart from the pause overlay starts the totals again')
  clearCreases()
}

// =====================================================================
//  The Game complete screen's words.
// =====================================================================
{
  const line = totalsLine({ time: 125, resets: 3, hits: 0 })
  record(
    line.includes('2:05') && line.includes('3 resets') && line.includes('0 hits'),
    `totals read "${line}", hits shown even at zero`,
  )

  const pairs = [
    ['glider', 'quick', 'Keen edge', 'Parry crease'],
    ['glider', 'parry', 'Keen edge', 'Quick fold'],
    ['keen', 'quick', 'Glider fold', 'Parry crease'],
    ['keen', 'parry', 'Glider fold', 'Quick fold'],
  ]
  for (const [a, b, x, y] of pairs) {
    clearCreases()
    setCrease(a)
    setCrease(b)
    const r = replayLine()
    record(
      r.includes(x) && r.includes(y),
      `with ${a} + ${b}: "${creasesLine()}" / "${r}"`,
    )
  }
  clearCreases()
}

// --- Play again puts the cards back on the table ---
{
  clearCreases()
  setCrease('keen')
  setCrease('parry')
  const { flow, started } = harness()
  playAgain(flow)
  record(rounds() === 0, 'Play again clears the creases')
  record(
    started.at(-1).k === 'Game' && (started.at(-1).d.level ?? 0) === 0,
    'and starts the game from Level 1',
  )
  flow.startGame({ level: 1, carry: true })
  record(
    started.at(-1).k === 'Crease',
    'so Level 2 offers the cards again, and the replay line can be followed',
  )
  clearCreases()
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(
  out.some((r) => r.startsWith('FAIL'))
    ? nl + 'SOME CHECKS FAILED'
    : nl + 'ALL CHECKS PASSED',
)
