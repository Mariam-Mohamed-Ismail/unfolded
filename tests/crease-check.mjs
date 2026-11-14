// Step L2-9: the crease choice.
import { scene } from './stub-scene.mjs'
import { Flow } from '../src/game/Flow.ts'
import { Level } from '../src/game/Level.ts'
import { Player } from '../src/game/Player.ts'
import { Sword } from '../src/game/Sword.ts'
import { level1 } from '../src/game/levels/level1.ts'
import { level2 } from '../src/game/levels/level2.ts'
import {
  CREASES,
  clearCrease,
  crease,
  chosenYet,
  hasGlider,
  hasKeen,
  setCrease,
} from '../src/game/Upgrades.ts'
import {
  FIXED_DT,
  GLIDE_FALL_SPEED,
  MAX_FALL_SPEED,
  PLAYER_H,
  SLASH_BOX_W,
  SLASH_KEEN_W,
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

/** A player in a level, with damage wired as GameScene wires it. */
function run(data, tileX, h = 0, held = {}) {
  const level = new Level(data)
  const p = new Player(
    scene,
    tileX * TILE,
    level.surfaceY(h) - PLAYER_H / 2,
    level.solids,
  )
  const sword = new Sword()
  const input = { ...blank(), ...held }
  let slash = false
  let hits = 0
  const step = () => {
    p.update(FIXED_DT, input, level.solids, level.updraftAt(p), sword.speedScale())
    level.update(FIXED_DT, p, NO_FX)
    sword.update(FIXED_DT, p, slash, level, NO_FX)
    const from = level.dangerAt(level.boxOf(p))
    if (from !== null) { hits++; p.hurt(M.sign(p.x - from) || 1) }
    input.jumpPressed = false
    input.jumpReleased = false
    input.dashPressed = false
    slash = false
  }
  step()
  return {
    level, p, input, sword, step,
    swing: () => { slash = true },
    hits: () => hits,
  }
}

// =====================================================================
//  The module.
// =====================================================================
{
  clearCrease()
  record(crease() === 'none', 'a fresh session has no crease')
  record(!chosenYet(), 'and nothing has been chosen')
  record(!hasGlider() && !hasKeen(), 'so neither effect is on')

  record(CREASES.length === 2, `two cards are offered`)
  record(
    CREASES.some((c) => c.id === 'glider') && CREASES.some((c) => c.id === 'keen'),
    `the spec's two: ${CREASES.map((c) => c.name).join(' and ')}`,
  )
  record(
    CREASES.every((c) => c.effect.length > 0),
    'each with a line saying what it does',
  )

  setCrease('glider')
  record(crease() === 'glider' && chosenYet(), 'picking the glider sticks')
  record(hasGlider() && !hasKeen(), 'and turns on exactly one effect')

  setCrease('keen')
  record(hasKeen() && !hasGlider(), 'picking the keen edge swaps it')

  clearCrease()
  record(crease() === 'none', 'and it can be cleared for a new session')
}

// =====================================================================
//  The glider fold.
// =====================================================================
{
  // A long drop, so terminal speed is reached either way.
  const drop = [{ x: 0, w: 40, h: -14 }]
  const air = {
    ...level2,
    hazards: false,
    solids: drop,
    entities: [{ id: 'cp', type: 'Checkpoint', x: 1, h: 0 }],
    rooms: [{ id: 'air', name: 'Air', from: 0, to: 40, checkpoint: 'cp' }],
  }

  const terminal = (glide, holding) => {
    clearCrease()
    if (glide) setCrease('glider')
    const t = run(air, 20, 0, { jumpHeld: holding })
    let top = 0
    for (let f = 0; f < 90; f++) {
      t.step()
      top = M.max(top, t.p.vy)
    }
    clearCrease()
    return top
  }

  const free = terminal(false, true)
  record(
    M.abs(free - MAX_FALL_SPEED) < 1,
    `without a crease, holding jump still falls at ${free.toFixed(0)}px/s`,
  )

  const glided = terminal(true, true)
  record(
    M.abs(glided - GLIDE_FALL_SPEED) < 1,
    `with the glider, holding jump caps the fall at ${glided.toFixed(0)}px/s (spec ${GLIDE_FALL_SPEED})`,
  )

  const released = terminal(true, false)
  record(
    M.abs(released - MAX_FALL_SPEED) < 1,
    `letting go falls at ${released.toFixed(0)}px/s again, so it is held, not owned`,
  )

  // It must not slow a rise, or it would cap every jump. Needs solid
  // ground: the drop level above spawns you already falling.
  const ground = { ...air, solids: [{ x: 0, w: 40, h: 0 }] }
  clearCrease()
  setCrease('glider')
  {
    const t = run(ground, 20, 0, { jumpHeld: true })
    t.input.jumpPressed = true
    t.step()
    const rising = t.p.vy
    record(rising < -200, `a jump still leaves at ${rising.toFixed(0)}px/s`)
    record(!t.p.isGliding(), 'and is not gliding on the way up')
    let gliding = false
    for (let f = 0; f < 90; f++) {
      t.step()
      if (t.p.isGliding()) gliding = true
    }
    record(gliding, 'the wing comes out once the fall starts')
  }

  // Not while flat: a folded sheet has no wings out.
  {
    const t = run(ground, 20, 0, { jumpHeld: true, flatHeld: true })
    t.input.jumpPressed = true
    let flatGlide = false
    for (let f = 0; f < 60; f++) {
      t.step()
      if (t.p.isFlat() && t.p.isGliding()) flatGlide = true
    }
    record(!flatGlide, 'folded flat, the glider stays stowed')
  }

  // Not in a draught: the fan owns vertical speed there.
  {
    const t = run(level2, 72, -2, { jumpHeld: true })
    let liftGlide = false
    for (let f = 0; f < 60; f++) {
      t.step()
      if (t.level.updraftAt(t.p) && t.p.isGliding()) liftGlide = true
    }
    record(!liftGlide, 'and inside a fan column it never fights the draught')
  }
  clearCrease()
}

// =====================================================================
//  The keen edge, measured as a distance.
// =====================================================================
{
  /** The furthest tile a standing player can cut 2B's seal from. */
  function reach() {
    const seal = new Level(level2).entities.byId('seal1')
    const target = seal.hurtBox().left / TILE
    let best = null
    for (let x = target; x > target - 4; x -= 0.05) {
      const t = run(level2, x)
      t.level.swordOut = () => true
      t.swing()
      // One whole swing: windup, active, recovery.
      for (let f = 0; f < 40; f++) t.step()
      if (t.level.entities.byId('seal1').hurtBox() === null) {
        best = target - x
      } else if (best !== null) {
        break
      }
    }
    return best
  }

  clearCrease()
  const plain = reach()
  record(plain !== null, `without a crease the seal is cut from ${plain?.toFixed(2)} tiles`)

  setCrease('keen')
  const keen = reach()
  record(keen !== null, `with the keen edge, from ${keen?.toFixed(2)} tiles`)
  record(
    keen !== null && plain !== null && keen > plain,
    `${(keen - plain).toFixed(2)} tiles further, which is the ${SLASH_KEEN_W - SLASH_BOX_W}px the box grew`,
  )
  record(
    keen !== null && M.abs(keen - 2.5) < 0.5,
    `about the spec's 2.5 tiles (${keen?.toFixed(2)})`,
  )
  clearCrease()
}

// --- and the box itself ---
{
  const sword = new Sword()
  clearCrease()
  record(sword.reach() === SLASH_BOX_W, `the hit area is ${sword.reach()}px by default`)
  setCrease('keen')
  record(sword.reach() === SLASH_KEEN_W, `and ${sword.reach()}px with the keen edge`)
  record(
    SLASH_KEEN_W / TILE === 2.5,
    `${SLASH_KEEN_W}px is exactly ${SLASH_KEEN_W / TILE} tiles, which is why no second rule is needed`,
  )
  setCrease('glider')
  record(sword.reach() === SLASH_BOX_W, 'the glider leaves the sword alone')
  clearCrease()
}

// =====================================================================
//  No room requires a crease - and none is broken by one.
// =====================================================================

/** 2C start to finish. Returns whether it finished, and at what cost. */
function run2c() {
  const t = run(level2, 63)
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
  return { done: t.level.finished(), secs: frames / 60, hits: t.hits() }
}

/** 2B start to finish: through the slit, cut the seal, out. */
function run2b() {
  const t = run(level2, 34)
  t.level.swordOut = () => true
  let cut = false
  let frames = 0
  for (; frames < 60 * 30; frames++) {
    const x = t.p.x / TILE
    t.input.flatHeld = x > 35 && x < 42.6
    t.input.dir = 1
    if (x > 48.4 && !cut) { t.swing(); cut = true }
    t.step()
    if (x > 52) break
  }
  return { done: t.p.x / TILE > 52, secs: frames / 60, hits: t.hits() }
}

for (const which of ['none', 'glider', 'keen']) {
  clearCrease()
  if (which !== 'none') setCrease(which)

  const c = run2c()
  record(
    c.done,
    `2C finishes with crease "${which}" in ${c.secs.toFixed(1)}s for ${c.hits} hits`,
  )
  const b = run2b()
  record(
    b.done,
    `2B finishes with crease "${which}" in ${b.secs.toFixed(1)}s for ${b.hits} hits`,
  )
}
clearCrease()

// --- the glider is a help, not a requirement ---
{
  clearCrease()
  const without = run2c()
  setCrease('glider')
  const with_ = run2c()
  clearCrease()
  record(
    without.done && with_.done,
    `2C is beatable both ways: ${without.secs.toFixed(1)}s without the glider, ${with_.secs.toFixed(1)}s with it`,
  )
  record(
    with_.hits <= without.hits,
    `and the glider costs no more hits (${with_.hits} against ${without.hits})`,
  )
}

// --- Level 1 is untouched by either crease ---
{
  const trace = (which) => {
    clearCrease()
    if (which !== 'none') setCrease(which)
    const level = new Level(level1)
    const p = new Player(
      scene,
      level.startPoint().x,
      level.startPoint().y,
      level.solids,
    )
    const input = blank()
    const seen = []
    for (let f = 0; f < 180; f++) {
      input.dir = 1
      input.jumpPressed = f === 30
      input.jumpHeld = f >= 30 && f < 50
      p.update(FIXED_DT, input, level.solids, level.updraftAt(p))
      level.update(FIXED_DT, p, NO_FX)
      input.jumpPressed = false
      seen.push([p.x, p.y])
    }
    clearCrease()
    return seen
  }

  const plain = trace('none')
  const keen = trace('keen')
  const same = plain.every((v, i) => v[0] === keen[i][0] && v[1] === keen[i][1])
  record(same, 'the keen edge changes nothing about how Level 1 moves')

  // The glider does change movement - but only if you hold jump while
  // falling, which this trace does not do past frame 50.
  const glider = trace('glider')
  const unchanged = plain.every(
    (v, i) => v[0] === glider[i][0] && v[1] === glider[i][1],
  )
  record(
    unchanged,
    'and so does the glider, until you actually hold jump as you fall',
  )
}

// =====================================================================
//  The routing rule, which is what decides whether the game is reachable.
// =====================================================================
//
//  Worth testing headlessly because this is the shape of code that once
//  broke Play entirely: a scene swap that threw inside the rAF callback and
//  killed the loop. The rule is pure, so it can be checked without a canvas.
{
  const started = []
  const ops = {
    key: 'MainMenu',
    start: (k, d) => started.push({ k, d }),
    stop: () => {},
    pause: () => {},
    resume: () => {},
    launch: () => {},
  }
  const top = {
    scene: ops,
    sys: {
      settings: { key: 'MainMenu' },
      isActive: () => true,
      isPaused: () => false,
    },
    // The fade's callback is run at once, so a swap is synchronous here.
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
  record(flow.hasNext(0) === true, 'there is a level after Level 1')
  record(flow.hasNext(1) === false, 'and none after Level 2')

  clearCrease()
  started.length = 0
  flow.startGame({})
  record(
    started.at(-1)?.k === 'Game',
    `Level 1 starts straight away (${started.at(-1)?.k}) - no crease needed for a level with no danger`,
  )

  started.length = 0
  flow.startGame({ level: 1 })
  record(
    started.at(-1)?.k === 'Crease',
    `Level 2 without a choice shows the cards first (${started.at(-1)?.k})`,
  )

  // Choosing then resuming runs the start that was waiting.
  started.length = 0
  setCrease('keen')
  flow.resume()
  record(
    started.at(-1)?.k === 'Game' && started.at(-1)?.d?.level === 1,
    `and picking one goes on into the level it was holding (${started.at(-1)?.k} ${started.at(-1)?.d?.level})`,
  )

  started.length = 0
  flow.startGame({ level: 1, roomId: '2c' })
  record(
    started.at(-1)?.k === 'Game' && started.at(-1)?.d?.roomId === '2c',
    'with a crease already chosen, room select goes straight in',
  )
  clearCrease()
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
