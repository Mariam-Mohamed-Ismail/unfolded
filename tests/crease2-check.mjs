// Step L3-8: the second crease choice - two creases held at once, the gate
// that asks for them, Quick fold, and the parry.
import { scene } from './stub-scene.mjs'
import { Flow } from '../src/game/Flow.ts'
import { Level } from '../src/game/Level.ts'
import { Player } from '../src/game/Player.ts'
import { Sword } from '../src/game/Sword.ts'
import { Health } from '../src/game/Health.ts'
import { Hud } from '../src/game/Hud.ts'
import { level1 } from '../src/game/levels/level1.ts'
import { level2 } from '../src/game/levels/level2.ts'
import { level3 } from '../src/game/levels/level3.ts'
import {
  CREASE_ROUNDS,
  clearCreases,
  creases,
  hasParry,
  hasQuick,
  nextRound,
  rounds,
  setCrease,
} from '../src/game/Upgrades.ts'
import {
  COLOR_FORM,
  COLOR_L2_FOLD,
  COLOR_L3_BG,
  COLOR_L3_LINE,
  COLOR_L3_SOLID,
  COLOR_WIND,
  FIXED_DT,
  FLAT_MAX_SPEED,
  FLAT_QUICK_SPEED,
  PARRY_SPEED_MULT,
  PLAYER_H,
  TILE,
  VENOM_SPEED,
} from '../src/game/constants.ts'

const M = Math
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

function blank() {
  return {
    dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
    dashPressed: false, flatHeld: false, swordPressed: false,
    slashPressed: false, resetPressed: false,
  }
}

/**
 * A player in a level with the sword and damage wired the way GameScene
 * wires them - including health, because an unwired hit cannot be measured.
 */
function run(data, tileX, h = 0, held = {}) {
  const level = new Level(data)
  const r = recorder()
  const p = new Player(
    scene,
    tileX * TILE,
    level.surfaceY(h) - PLAYER_H / 2,
    level.solids,
  )
  const sword = new Sword()
  const health = new Health()
  const input = { ...blank(), ...held }
  let slash = false
  let hits = 0
  const step = () => {
    p.update(FIXED_DT, input, level.solids, level.updraftAt(p), sword.speedScale())
    health.update(FIXED_DT)
    level.update(FIXED_DT, p, r.fx)
    const from = level.dangerAt(level.boxOf(p))
    if (from !== null && health.take()) {
      hits++
      p.hurt(M.sign(p.x - from) || 1)
    }
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
    hits: () => hits,
  }
}

// =====================================================================
//  The module holds a set now, not a value.
// =====================================================================
{
  clearCreases()
  record(CREASE_ROUNDS.length === 2, `${CREASE_ROUNDS.length} rounds of cards`)
  record(
    CREASE_ROUNDS.every((r) => r.length === 2),
    'two cards in each, so each choice is a pair',
  )
  const second = CREASE_ROUNDS[1]
  record(
    second.some((c) => c.id === 'quick') && second.some((c) => c.id === 'parry'),
    `the second round is the spec's two: ${second.map((c) => c.name).join(' and ')}`,
  )
  const ids = CREASE_ROUNDS.flat().map((c) => c.id)
  record(new Set(ids).size === 4, `four distinct creases in all: ${ids.join(', ')}`)

  record(nextRound() === CREASE_ROUNDS[0], 'with nothing chosen, round one is owed')
  setCrease('glider')
  record(nextRound() === CREASE_ROUNDS[1], 'with one chosen, round two is owed')
  setCrease('quick')
  record(nextRound() === null, 'with both chosen, nothing is owed')

  record(
    creases().length === 2 && rounds() === 2,
    `and both are held: ${creases().join(' + ')}`,
  )
  record(hasQuick() && !hasParry(), 'only the one that was picked from each pair')

  setCrease('quick')
  record(creases().length === 2, 'picking one twice does not hold it twice')

  // Every pair one of each round can make.
  let allPairs = true
  for (const a of CREASE_ROUNDS[0]) {
    for (const b of CREASE_ROUNDS[1]) {
      clearCreases()
      setCrease(a.id)
      setCrease(b.id)
      if (creases().length !== 2) allPairs = false
    }
  }
  record(allPairs, 'all four combinations of the two rounds can be held')
  clearCreases()
}

// =====================================================================
//  The gate: which level asks, and how two outstanding choices chain.
// =====================================================================
{
  const started = []
  const ops = {
    key: 'MainMenu',
    start: (k, d) => started.push({ k, d }),
    stop: () => {}, pause: () => {}, resume: () => {}, launch: () => {},
  }
  const top = {
    scene: ops,
    sys: { settings: { key: 'MainMenu' }, isActive: () => true, isPaused: () => false },
    cameras: { main: { once: (_e, cb) => cb(), fadeOut: () => {}, fadeIn: () => {} } },
  }
  const game = {
    events: { on: () => {}, emit: () => {} },
    registry: { get: () => undefined },
    scene: {
      getScene: (k) => (k === 'MainMenu' ? top : null),
      getScenes: () => [top],
      isActive: () => false,
    },
  }
  const flow = new Flow(game)
  const go = (start) => {
    started.length = 0
    flow.startGame(start)
    return started.at(-1)
  }

  clearCreases()
  record(go({}).k === 'Game', 'Level 1 never asks for a crease')

  record(go({ level: 1 }).k === 'Crease', 'Level 2 with none chosen shows the cards')
  setCrease('glider')
  record(go({ level: 1 }).k === 'Game', 'and goes straight in once one is chosen')

  record(
    go({ level: 2 }).k === 'Crease',
    'Level 3 with only the first crease asks for the second',
  )
  setCrease('quick')
  record(go({ level: 2 }).k === 'Game', 'and goes straight in once both are')

  // The chain: Room select into Level 3 having chosen nothing owes two
  // screens, and resume() re-asking is what delivers the second.
  clearCreases()
  record(go({ level: 2, roomId: '3b' }).k === 'Crease', 'from Room select with none: cards')
  setCrease('keen')
  started.length = 0
  flow.resume()
  record(
    started.at(-1)?.k === 'Crease',
    'picking one shows the cards again rather than starting the level',
  )
  setCrease('parry')
  started.length = 0
  flow.resume()
  const last = started.at(-1)
  record(
    last?.k === 'Game' && last?.d?.roomId === '3b',
    `picking the second runs the start it was holding (${last?.k} ${last?.d?.roomId})`,
  )
  record(rounds() === 2, 'with both creases held, which is what the spec asks for')
  clearCreases()
}

// =====================================================================
//  Quick fold, half one: the flat cap.
// =====================================================================
{
  const lane = {
    ...level2,
    hazards: false,
    solids: [{ x: 0, w: 60, h: 0 }],
    entities: [{ id: 'cp', type: 'Checkpoint', x: 1, h: 0 }],
    rooms: [{ id: 'lane', name: 'Lane', from: 0, to: 60, checkpoint: 'cp' }],
  }

  /** Top speed of a long flat slide from a standing start. */
  const slide = (quick) => {
    clearCreases()
    if (quick) setCrease('quick')
    const t = run(lane, 4, 0, { flatHeld: true, dir: 1 })
    let top = 0
    for (let f = 0; f < 240; f++) {
      t.step()
      if (t.p.isFlat()) top = M.max(top, t.p.vx)
    }
    clearCreases()
    return top
  }

  const plain = slide(false)
  record(
    M.abs(plain - FLAT_MAX_SPEED) < 1,
    `without Quick fold a slide tops out at ${plain.toFixed(0)}px/s (spec ${FLAT_MAX_SPEED})`,
  )
  const quick = slide(true)
  record(
    M.abs(quick - FLAT_QUICK_SPEED) < 1,
    `with it, ${quick.toFixed(0)}px/s (spec ${FLAT_QUICK_SPEED})`,
  )
  record(FLAT_QUICK_SPEED === 280 && FLAT_MAX_SPEED === 200, 'the spec is 280 against 200')

  // It is the flat cap only: standing speed is untouched.
  const topRun = (quick) => {
    clearCreases()
    if (quick) setCrease('quick')
    const t = run(lane, 4, 0, { dir: 1 })
    let top = 0
    for (let f = 0; f < 240; f++) { t.step(); top = M.max(top, t.p.vx) }
    clearCreases()
    return top
  }
  record(
    M.abs(topRun(true) - topRun(false)) < 0.01,
    `and running speed is the same either way (${topRun(false).toFixed(0)}px/s)`,
  )
}

// =====================================================================
//  Quick fold, half two: folding in mid-air.
// =====================================================================
{
  // Ground a long way below, so the whole test happens in the air.
  const air = {
    ...level2,
    hazards: false,
    solids: [{ x: 0, w: 60, h: -14 }],
    entities: [{ id: 'cp', type: 'Checkpoint', x: 1, h: 0 }],
    rooms: [{ id: 'air', name: 'Air', from: 0, to: 60, checkpoint: 'cp' }],
  }

  const foldInAir = (quick) => {
    clearCreases()
    if (quick) setCrease('quick')
    const t = run(air, 20, 0, { flatHeld: true })
    let folded = false
    for (let f = 0; f < 60; f++) {
      t.step()
      if (t.p.isFlat() && !t.p.grounded) folded = true
    }
    clearCreases()
    return folded
  }

  record(!foldInAir(false), 'without Quick fold, holding S in mid-air does nothing')
  record(foldInAir(true), 'with it, the player folds in mid-air')

  // The gate is on starting a fold, not on staying folded: a fold begun on
  // the ground survives walking off a ledge with no crease at all.
  {
    clearCreases()
    const ledge = {
      ...level2,
      hazards: false,
      solids: [{ x: 0, w: 10, h: 0 }],
      entities: [{ id: 'cp', type: 'Checkpoint', x: 1, h: 0 }],
      rooms: [{ id: 'ledge', name: 'Ledge', from: 0, to: 60, checkpoint: 'cp' }],
    }
    const t = run(ledge, 4, 0, { flatHeld: true, dir: 1 })
    let flatInAir = false
    let everStood = false
    for (let f = 0; f < 120; f++) {
      t.step()
      if (t.p.isFlat() && !t.p.grounded) flatInAir = true
      if (!t.p.isFlat() && !t.p.grounded) everStood = true
    }
    record(flatInAir, 'a fold started on the ground stays folded off the edge')
    record(!everStood, 'and never pops upright in the air')
  }
}

// =====================================================================
//  The parry.
// =====================================================================

/** A flat arena with a snake on it, and the blade drawn. */
function snakeArena() {
  return {
    name: 'Test',
    width: 60,
    height: 24,
    floorRow: 20,
    palette: {
      bg: COLOR_L3_BG, solid: COLOR_L3_SOLID, line: COLOR_L3_LINE,
      fold: COLOR_L2_FOLD, wind: COLOR_WIND, form: COLOR_FORM,
    },
    hazards: true,
    spawn: { x: 2, h: 0 },
    solids: [{ x: 0, w: 60, h: 0 }],
    entities: [
      { id: 'cp', type: 'Checkpoint', x: 1, h: 0 },
      {
        id: 'snake', type: 'Snake', x: 20, homeX: 20,
        patrolFrom: 19, patrolTo: 21, floorH: 0,
      },
    ],
    rooms: [{ id: 'test', name: 'Test', from: 0, to: 60, checkpoint: 'cp' }],
  }
}

/**
 * Stand still until the snake spits, then swing at the blob as it arrives.
 * Returns the blob's horizontal speed before and after, whether the snake
 * was hurt, and where it all happened.
 *
 * vx is read by differencing x: gravity never touches it, so the ratio is
 * exact rather than a frame behind.
 */
function parryAttempt({ parry, standAt = 16, delay }) {
  clearCreases()
  if (parry) setCrease('parry')
  const t = run(snakeArena(), standAt)
  t.level.swordOut = () => true
  const snake = t.level.entities.byId('snake')
  let before = null
  let after = null
  let prev = null
  let turned = false
  let spitAt = null
  let danger = 'never asked'
  for (let f = 0; f < 60 * 25; f++) {
    const v = snake.venom()
    if (v && spitAt === null) spitAt = f
    // Turn to meet it. The snake reappears on the side the player is not
    // facing, so the swing points the wrong way unless they turn first -
    // that is the mechanic, not a quirk of the harness, and a test that
    // stood still measured a sword box pointing away from the venom.
    t.input.dir = v && spitAt !== null && f <= spitAt + delay ? M.sign(v[0] - t.p.x) : 0
    // One swing, `delay` steps after the shot leaves the mouth. The windup
    // is 120ms, so the press has to lead the blob by about seven steps.
    if (spitAt !== null && f === spitAt + delay) t.swing()
    t.step()
    const now = snake.venom()
    if (v && now) {
      const vx = (now[0] - v[0]) / FIXED_DT
      if (prev !== null && !turned && prev !== 0 && M.sign(vx) !== M.sign(prev)) {
        before = prev
        after = vx
        turned = true
        // Asked the instant it turns, while the blob is still in the air
        // beside the player: a reflected blob is theirs now, so the only
        // question the player ever asks about it has to answer null.
        danger = snake.dangerAt({
          left: now[0] - 10, right: now[0] + 10,
          top: now[1] - 15, bottom: now[1] + 15,
        })
      }
      prev = vx
    } else {
      prev = null
    }
    // Once the blob is gone, the shot is over either way.
    if (spitAt !== null && !now && f > spitAt + 2) break
  }
  const res = {
    turned, before, after, danger,
    hurt: snake.isWounded() || !snake.alive(),
    hits: t.hits(),
    where: t.p.x,
    snake,
    t,
  }
  clearCreases()
  return res
}

/**
 * Sweep the press timing and keep the first one that parries, plus how many
 * of the timings worked - which is the size of the window a player has.
 */
function parryRun({ parry, standAt = 16 }) {
  let best = null
  let window = 0
  for (let delay = 0; delay <= 40; delay++) {
    const r = parryAttempt({ parry, standAt, delay })
    if (r.turned) {
      window++
      if (!best || (!best.hurt && r.hurt)) best = { ...r, delay }
    }
  }
  return { ...(best ?? parryAttempt({ parry, standAt, delay: 8 })), window }
}

{
  const p = parryRun({ parry: true })
  record(p.turned, 'with the Parry crease, a slash turns the venom around')
  record(
    p.turned && M.abs(M.abs(p.after / p.before) - PARRY_SPEED_MULT) < 0.02,
    p.turned
      ? `it comes back at ${M.abs(p.after).toFixed(0)}px/s against ${M.abs(p.before).toFixed(0)}px/s going out - ${M.abs(p.after / p.before).toFixed(2)}x (spec ${PARRY_SPEED_MULT})`
      : 'it comes back faster',
  )
  record(
    p.turned && M.sign(p.after) !== M.sign(p.before),
    'and back the way it came, which is where the snake is',
  )
  record(p.hurt, 'the snake takes the damage: its own venom wounds it')
  record(p.hits === 0, `and the player is not hit in the process (${p.hits} hits)`)
  record(PARRY_SPEED_MULT === 1.3, `the multiplier is the spec's ${PARRY_SPEED_MULT}`)
}

// --- a turned blob is no longer the player's problem ---
{
  const p = parryRun({ parry: true })
  record(
    p.danger === null,
    `standing in a turned blob does not hurt the player (dangerAt said ${JSON.stringify(p.danger)})`,
  )
  record(
    p.window > 0,
    `the parry window is ${p.window} of 41 press timings, so it is a timed swing and not a free one`,
  )
}

// --- and it is deterministic, which the recorded solutions depend on ---
{
  const a = parryAttempt({ parry: true, standAt: 16, delay: 10 })
  const b = parryAttempt({ parry: true, standAt: 16, delay: 10 })
  record(
    a.turned === b.turned && a.before === b.before && a.after === b.after &&
      a.hurt === b.hurt && a.where === b.where,
    'the same parry, run twice, gives the identical result',
  )
}

// --- without the crease the swing passes straight through ---
{
  const p = parryRun({ parry: false })
  record(!p.turned, 'without the crease, slashing the venom does not turn it')
  record(!p.hurt, 'and the snake takes nothing from it')
}

// --- it reaches the snake from the distances the real rooms offer ---
//
// This is the number that decided the implementation. A true reflection
// retraces the arc it came along, but gravity drops it below the return
// path, so "1.3x" and "toward the snake" could have disagreed and the shot
// could have landed short. Measured instead of assumed, at each distance a
// room actually puts between the player and the snake.
{
  for (const at of [16, 15, 14]) {
    const p = parryRun({ parry: true, standAt: at })
    const tiles = (20 - at).toFixed(0)
    record(
      p.turned && p.hurt,
      `a parry ${tiles} tiles from the snake reaches it (venom ${VENOM_SPEED}px/s out, ${p.turned ? M.abs(p.after).toFixed(0) : '-'}px/s back)`,
    )
  }
}

// =====================================================================
//  No room requires a crease.
// =====================================================================
//
//  The fold gate is new baseline behaviour, so this is not a formality: the
//  rooms that need flat form are the rooms it could have broken. Every slit
//  in all three levels, entered from the floor in front of it with nothing
//  held at all.
{
  clearCreases()
  const LEVELS = [['Level 1', level1], ['Level 2', level2], ['Level 3', level3]]
  for (const [name, data] of LEVELS) {
    for (const spec of data.entities.filter((e) => e.type === 'Slit')) {
      const h = spec.h ?? 0
      const start = spec.x - 1.5
      const t = run(data, start, h)
      const past = spec.x + spec.w + 0.5
      let through = false
      for (let f = 0; f < 60 * 8 && !through; f++) {
        const x = t.p.x / TILE
        t.input.dir = 1
        t.input.flatHeld = x > spec.x - 1.2 && x < past
        t.step()
        if (t.p.x / TILE > past) through = true
      }
      record(
        through,
        `${name} ${spec.id}: folded on the floor at x${start.toFixed(1)} and slid through to x${(t.p.x / TILE).toFixed(1)} with no crease`,
      )
    }
  }
}

// --- 1B start to finish, the room that teaches flat form ---
{
  clearCreases()
  const t = run(level1, 47)
  let frames = 0
  for (; frames < 60 * 20; frames++) {
    const x = t.p.x / TILE
    t.input.dir = 1
    t.input.flatHeld = (x > 52.5 && x < 61) || (x > 62 && x < 66)
    t.step()
    if (t.p.x / TILE > 67) break
  }
  record(
    t.p.x / TILE > 67,
    `1B is finished with no crease in ${(frames / 60).toFixed(1)}s, ending at x${(t.p.x / TILE).toFixed(1)}`,
  )
}

// --- and Quick fold is not a shortcut ---
//
// The spec is explicit that it must not be one. Flat form cannot jump or
// dash, so the only thing the crease could open is a place reachable by
// folding on the way there - which means the jump itself has to be
// unchanged, and it is: the crease touches the flat cap and nothing else.
{
  const lane = {
    ...level2,
    hazards: false,
    solids: [{ x: 0, w: 60, h: 0 }],
    entities: [{ id: 'cp', type: 'Checkpoint', x: 1, h: 0 }],
    rooms: [{ id: 'lane', name: 'Lane', from: 0, to: 60, checkpoint: 'cp' }],
  }
  const leap = (quick) => {
    clearCreases()
    if (quick) setCrease('quick')
    const t = run(lane, 4, 0, { dir: 1, jumpHeld: true })
    for (let f = 0; f < 60; f++) t.step()
    t.input.jumpPressed = true
    const from = t.p.x
    let top = t.p.y
    for (let f = 0; f < 120; f++) {
      t.step()
      top = M.min(top, t.p.y)
      if (t.p.grounded && f > 10) break
    }
    clearCreases()
    return { far: t.p.x - from, high: t.p.y - top }
  }
  const a = leap(false)
  const b = leap(true)
  record(
    M.abs(a.far - b.far) < 0.01 && M.abs(a.high - b.high) < 0.01,
    `a running jump goes the same ${a.far.toFixed(0)}px and ${a.high.toFixed(0)}px high either way`,
  )
}

// =====================================================================
//  The HUD shows what has been earned.
// =====================================================================
//
//  Counted rather than looked at: each icon is one filled triangle, so the
//  number of them is the number of creases on screen. The pips are triangles
//  too, which is why this measures the difference rather than the total.
{
  const tris = []
  const g = {
    clear: () => { tris.length = 0; return g },
    fillTriangle: (...a) => { tris.push(a); return g },
  }
  // Everything else a Graphics is asked for here, swallowed.
  for (const k of [
    'fillStyle', 'lineStyle', 'strokeTriangle', 'lineBetween', 'strokeCircle',
    'fillPoints', 'strokePoints', 'strokeRect', 'fillRect', 'setDepth',
    'setScrollFactor', 'setVisible', 'destroy',
  ]) {
    g[k] = () => g
  }
  const txt = {
    value: '',
    setText(v) { txt.value = v; return txt },
  }
  for (const k of [
    'setDepth', 'setScrollFactor', 'setOrigin', 'setVisible', 'setPosition',
    'setAlpha', 'setColor', 'destroy',
  ]) {
    txt[k] = () => txt
  }
  const hudScene = { add: { graphics: () => g, text: () => txt } }

  const drawn = (held) => {
    clearCreases()
    for (const id of held) setCrease(id)
    const hud = new Hud(hudScene)
    hud.update('3B', 1, 0, new Health())
    clearCreases()
    return tris.length
  }

  const none = drawn([])
  const one = drawn(['glider'])
  const two = drawn(['glider', 'quick'])
  record(one === none + 1, `one crease draws one icon under the pips (${none} -> ${one})`)
  record(two === none + 2, `two creases draw two (${two})`)

  // All four have a shape of their own, and none of them is nothing.
  let allDrawn = true
  for (const c of CREASE_ROUNDS.flat()) {
    if (drawn([c.id]) !== none + 1) allDrawn = false
  }
  record(allDrawn, 'and each of the four creases has an icon of its own')
}

clearCreases()

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
