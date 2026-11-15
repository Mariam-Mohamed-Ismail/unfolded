// Step L3-6a: the snake's first half - patrol, telegraph, vanish, mark,
// appear - and the five clauses of where it comes back.
import { scene } from './stub-scene.mjs'
import { Level } from '../src/game/Level.ts'
import { Player } from '../src/game/Player.ts'
import { Snake } from '../src/game/entities/Snake.ts'
import { Playback } from '../src/game/Solutions.ts'
import { level3 } from '../src/game/levels/level3.ts'
import { readFileSync } from 'node:fs'
import { openRoom } from './solution-harness.mjs'
import {
  COLOR_FORM,
  COLOR_L3_BG,
  COLOR_L3_LINE,
  COLOR_L3_SOLID,
  COLOR_L2_FOLD,
  COLOR_SNAKE,
  COLOR_SNAKE_FACET,
  COLOR_VENOM,
  PARTICLES_SNAKE_VANISH,
  SNAKE_AIM_S,
  SNAKE_RECOVER_S,
  SNAKE_RESPAWN_S,
  SNAKE_RETREAT_COOLDOWN_S,
  SNAKE_STAGGER_KNOCK,
  SNAKE_STAGGER_S,
  VENOM_SPEED,
  COLOR_WIND,
  FIXED_DT,
  PLAYER_FLAT_H,
  PLAYER_H,
  SNAKE_APPEAR_S,
  SNAKE_H,
  SNAKE_MARK_S,
  SNAKE_NEAR_MAX,
  SNAKE_NEAR_MIN,
  SNAKE_PATROL_SPEED,
  SNAKE_RANGE_X,
  SNAKE_RANGE_Y,
  SNAKE_REAR_S,
  SNAKE_SEGMENTS,
  SNAKE_SEG_GAP,
  SNAKE_VANISH_S,
  SNAKE_W,
  TILE,
} from '../src/game/constants.ts'

const M = Math
const out = []
const record = (ok, msg) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

const hex = (n) => '#' + n.toString(16).padStart(6, '0').toUpperCase()

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

/** A flat test floor with a snake on it, plus whatever extra solids. */
function arena(extraSolids = [], patrol = [14, 26]) {
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
    solids: [{ x: 0, w: 60, h: 0 }, ...extraSolids],
    entities: [
      { id: 'cp', type: 'Checkpoint', x: 1, h: 0 },
      {
        id: 'snake', type: 'Snake', x: 20, homeX: 20,
        patrolFrom: patrol[0], patrolTo: patrol[1], floorH: 0,
      },
    ],
    rooms: [{ id: 'test', name: 'Test', from: 0, to: 60, checkpoint: 'cp' }],
  }
}

/** The level, a player at (tile, h), and a step. */
function run(data, tileX, h = 0, held = {}) {
  const level = new Level(data)
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
    ...held,
  }
  const step = () => {
    p.update(FIXED_DT, input, level.solids, level.updraftAt(p))
    level.update(FIXED_DT, p, r.fx)
    input.jumpPressed = false
    input.jumpReleased = false
    input.dashPressed = false
  }
  step()
  return { level, p, input, step, log: r.log, snake: level.entities.byId('snake') }
}

const until = (t, want, cap = 60 * 20) => {
  let f = 0
  while (t.snake.phase() !== want && f++ < cap) t.step()
  return f
}

// =====================================================================
//  Built on the Enemy base, with the spec's look and hit box.
// =====================================================================
{
  const t = run(arena(), 2)
  record(t.snake instanceof Snake, 'the snake is built')
  record(t.snake.alive() && t.snake.hits() === 2, `with ${t.snake.hits()} health`)
  record(t.snake.phase() === 'patrol', 'starting on patrol')
  record(hex(COLOR_SNAKE) === '#D85A30', `coral ${hex(COLOR_SNAKE)}`)
  record(hex(COLOR_SNAKE_FACET) === '#A63D1F', `with facets ${hex(COLOR_SNAKE_FACET)}`)

  const box = t.snake.hurtBox()
  record(
    !!box && M.abs(box.right - box.left - SNAKE_W) < 0.01 && M.abs(box.bottom - box.top - SNAKE_H) < 0.01,
    `the hit box is ${(box.right - box.left).toFixed(0)}x${(box.bottom - box.top).toFixed(0)} (spec ${SNAKE_W}x${SNAKE_H})`,
  )
  record(
    t.snake.segments().length === SNAKE_SEGMENTS,
    `${t.snake.segments().length} segments (spec ${SNAKE_SEGMENTS})`,
  )
}

// --- the body trails the head ---
{
  const t = run(arena(), 2)
  for (let f = 0; f < 120; f++) t.step()
  const segs = t.snake.segments()
  let worst = 0
  for (let i = 1; i < segs.length; i++) {
    worst = M.max(worst, M.hypot(segs[i][0] - segs[i - 1][0], segs[i][1] - segs[i - 1][1]))
  }
  record(
    worst <= SNAKE_SEG_GAP + 4,
    `each segment stays within ${worst.toFixed(1)}px of the one in front (spacing ${SNAKE_SEG_GAP})`,
  )
  const head = t.snake.at()
  record(
    M.abs(segs[0][0] - head[0]) < 1,
    'and the first one is the head',
  )
  const spread = M.abs(segs[segs.length - 1][0] - head[0])
  record(
    spread > SNAKE_SEG_GAP,
    `the body stretches ${spread.toFixed(0)}px behind it rather than bunching up`,
  )
}

// =====================================================================
//  Patrol: 140px/s, inside its range, turning at both ends.
// =====================================================================
{
  const t = run(arena(), 2)
  const xs = []
  for (let f = 0; f < 60 * 12; f++) {
    t.step()
    xs.push(t.snake.at()[0])
  }
  record(
    t.snake.phase() === 'patrol',
    'with the player far away it just patrols',
  )
  const lo = M.min(...xs)
  const hi = M.max(...xs)
  record(
    lo >= 14 * TILE - 1 && hi <= 26 * TILE + 1,
    `staying inside x${(lo / TILE).toFixed(1)} to x${(hi / TILE).toFixed(1)} (range 14-26)`,
  )
  record(
    hi - lo > 10 * TILE,
    `and covering ${((hi - lo) / TILE).toFixed(1)} tiles of it, so it does turn at both ends`,
  )
  // Speed, measured between two frames mid-run.
  const speed = M.abs(xs[200] - xs[199]) / FIXED_DT
  record(
    M.abs(speed - SNAKE_PATROL_SPEED) < 2,
    `slithering at ${speed.toFixed(0)}px/s (spec ${SNAKE_PATROL_SPEED})`,
  )
}

// =====================================================================
//  The state machine, and its durations.
// =====================================================================
{
  const t = run(arena(), 20)
  record(t.snake.phase() === 'rear', 'standing next to it, it rears at once')
  // Each state raises its own one-off effects on its first frame, so they
  // land the step after the one that entered it.
  t.step()
  record(t.log.sounds.includes('hiss'), 'with a hiss')

  let f = 0
  while (t.snake.phase() === 'rear' && f++ < 300) t.step()
  record(
    M.abs(f * FIXED_DT - SNAKE_REAR_S) <= FIXED_DT * 2,
    `the rear lasts ${(f * FIXED_DT).toFixed(3)}s (spec ${SNAKE_REAR_S})`,
  )
  record(t.snake.phase() === 'vanish', 'then it vanishes')
  t.step()
  record(
    t.log.sounds.includes('crumple'),
    'with its own crumple voice, rather than the fold I borrowed last step',
  )
  record(
    t.log.dust.some((d) => d.color === COLOR_SNAKE),
    'and bursting into triangles',
  )

  let v = 0
  while (t.snake.phase() === 'vanish' && v++ < 300) t.step()
  record(
    M.abs(v * FIXED_DT - SNAKE_VANISH_S) <= FIXED_DT * 2,
    `the vanish lasts ${(v * FIXED_DT).toFixed(3)}s (spec ${SNAKE_VANISH_S})`,
  )
  record(t.snake.phase() === 'mark', 'then it marks the floor')
  record(t.snake.mark() !== null, 'and the mark says where it will come out')

  let m = 0
  while (t.snake.phase() === 'mark' && m++ < 300) t.step()
  record(
    M.abs(m * FIXED_DT - SNAKE_MARK_S) <= FIXED_DT * 2,
    `the mark lasts ${(m * FIXED_DT).toFixed(3)}s (spec ${SNAKE_MARK_S})`,
  )
  record(t.snake.phase() === 'appear', 'then it appears')
  // The arrival's effects are raised from inside the appear state, so they
  // land on the frame after the one that entered it.
  t.step()
  record(t.log.sounds.includes('pop'), 'with a pop')

  let ap = 0
  while (t.snake.phase() === 'appear' && ap++ < 300) t.step()
  record(
    M.abs(ap * FIXED_DT - SNAKE_APPEAR_S) <= FIXED_DT * 2,
    `the appear lasts ${(ap * FIXED_DT).toFixed(3)}s (spec ${SNAKE_APPEAR_S})`,
  )
  // Appear now leads into Aim rather than back to Patrol: that is the
  // second half of the machine arriving.
  record(t.snake.phase() === 'aim', 'and goes straight into aiming')
}

// --- the telegraph is never skipped ---
{
  const t = run(arena(), 20)
  const seen = []
  for (let f = 0; f < 60 * 4; f++) {
    const p = t.snake.phase()
    if (seen[seen.length - 1] !== p) seen.push(p)
    t.step()
  }
  const order = seen.join(' -> ')
  // Standing next to it, it is already rearing on frame one, so the trace
  // starts mid-cycle. What matters is the order it runs in.
  record(
    order.includes(
      'rear -> vanish -> mark -> appear -> aim -> spit -> recover -> retreat',
    ),
    `the cycle runs ${seen.slice(0, 6).join(' -> ')} ...`,
  )
  // Every arrival is preceded by a rear and a mark, which is the fairness
  // rule: it never attacks without showing both.
  let fair = true
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] !== 'appear') continue
    if (seen[i - 1] !== 'mark' || seen[i - 2] !== 'vanish' || seen[i - 3] !== 'rear') {
      fair = false
    }
  }
  record(fair, 'and every appearance is preceded by a rear and a mark')
}

// =====================================================================
//  Notice range: the corners of 9 x 3, not just the middle.
// =====================================================================
{
  const near = run(arena([], [20, 20]), 20 - (SNAKE_RANGE_X - 1))
  for (let f = 0; f < 10; f++) near.step()
  record(near.snake.phase() !== 'patrol', `${SNAKE_RANGE_X - 1} tiles away it notices`)

  const far = run(arena([], [20, 20]), 20 - (SNAKE_RANGE_X + 1))
  for (let f = 0; f < 60; f++) far.step()
  record(far.snake.phase() === 'patrol', `${SNAKE_RANGE_X + 1} tiles away it does not`)

  // Vertically: a ledge above the snake, inside and outside the 3 tiles.
  const up = run(arena([{ x: 18, w: 4, h: 2 }], [20, 20]), 20, 2)
  for (let f = 0; f < 10; f++) up.step()
  record(up.snake.phase() !== 'patrol', '2 tiles above it, it notices')

  const high = run(arena([{ x: 18, w: 4, h: 5 }], [20, 20]), 20, 5)
  for (let f = 0; f < 60; f++) high.step()
  record(
    high.snake.phase() === 'patrol',
    `${SNAKE_RANGE_Y + 2} tiles above it, it does not`,
  )
}

// =====================================================================
//  Hiding: flat under a slab is ignored, flat in the open is not.
// =====================================================================
{
  // A slab over the player, a couple of tiles from the snake's home.
  const roof = [{ x: 17, w: 2, h: 2, bottomH: 1.5 }]
  const hidden = run(arena(roof, [20, 20]), 17.5, 0, { flatHeld: true })
  for (let f = 0; f < 60 * 6; f++) hidden.step()
  record(hidden.p.isFlat(), 'folded flat under a slab, within range')
  record(
    hidden.snake.phase() === 'patrol',
    `the snake ignores a hidden player (${hidden.snake.phase()})`,
  )

  // Stand up in the same place and it notices.
  hidden.input.flatHeld = false
  for (let f = 0; f < 60; f++) hidden.step()
  record(
    !hidden.p.isFlat() && hidden.snake.phase() !== 'patrol',
    `standing up wakes it (${hidden.snake.phase()})`,
  )

  // Flat in the open is NOT hiding.
  const open = run(arena([], [20, 20]), 18, 0, { flatHeld: true })
  for (let f = 0; f < 60; f++) open.step()
  record(open.p.isFlat(), 'folded flat in the open')
  record(
    open.snake.phase() !== 'patrol',
    `is still noticed (${open.snake.phase()})`,
  )
  record(
    PLAYER_FLAT_H < PLAYER_H,
    'which is the half of the rule that could silently never fire',
  )
}

// =====================================================================
//  Where it reappears: the spec's five clauses.
// =====================================================================
{
  /** Run until it marks, and report where. */
  function markFor(data, tile, h = 0, held = {}, face = 1) {
    const t = run(data, tile, h, held)
    // Point the player somewhere, so "the side you are not facing" means
    // something: dir sets facing.
    t.input.dir = face
    for (let f = 0; f < 4; f++) t.step()
    t.input.dir = 0
    until(t, 'mark')
    const mk = t.snake.mark()
    return { t, mk, px: t.p.x }
  }

  // 3 to 4 tiles away, every time.
  let worstNear = 0
  let worstFar = 99
  for (const face of [1, -1]) {
    for (let tile = 18; tile <= 22; tile += 0.5) {
      const { mk, px } = markFor(arena([], [20, 20]), tile, 0, {}, face)
      if (!mk) continue
      const d = M.abs(mk[0] - px) / TILE
      worstNear = M.max(worstNear, d)
      worstFar = M.min(worstFar, d)
    }
  }
  record(
    worstFar >= SNAKE_NEAR_MIN - 0.6 && worstNear <= SNAKE_NEAR_MAX + 0.6,
    `it always marks ${worstFar.toFixed(1)} to ${worstNear.toFixed(1)} tiles away (spec ${SNAKE_NEAR_MIN}-${SNAKE_NEAR_MAX})`,
  )

  // Behind the player: facing right means it comes back on the left.
  const right = markFor(arena([], [20, 20]), 20, 0, {}, 1)
  record(
    right.mk !== null && right.mk[0] < right.px,
    `facing right, it marks ${((right.px - right.mk[0]) / TILE).toFixed(1)} tiles to the LEFT`,
  )
  const left = markFor(arena([], [20, 20]), 20, 0, {}, -1)
  record(
    left.mk !== null && left.mk[0] > left.px,
    `facing left, it marks ${((left.mk[0] - left.px) / TILE).toFixed(1)} tiles to the RIGHT`,
  )

  // Never on top of the player.
  for (const face of [1, -1]) {
    const { t, mk, px } = markFor(arena([], [20, 20]), 20, 0, {}, face)
    const box = t.level.boxOf(t.p)
    const overlap =
      mk !== null && mk[0] + SNAKE_W / 2 > box.left && mk[0] - SNAKE_W / 2 < box.right
    record(!overlap, `and never on top of the player (facing ${face})`)
    void px
  }

  // Never inside a slit: a slab 3 tiles to the left means it has to use
  // the other side even though that is the side the player faces.
  {
    // Wide enough to cover all three candidates behind the player (3, 3.5
    // and 4 tiles), or it just picks the one that pokes out the far end.
    const slab = [{ x: 13, w: 6, h: 2, bottomH: 1.2 }]
    const { mk, px } = markFor(arena(slab, [20, 20]), 18.5, 0, {}, 1)
    record(
      mk !== null && mk[0] > px,
      mk !== null
        ? `with a slit covering every spot behind them it marks to the right instead, ${((mk[0] - px) / TILE).toFixed(1)} tiles away`
        : 'it found nowhere legal',
    )
  }

  // Only on a floor: a hole where it would otherwise appear sends it to
  // the other side.
  {
    // Floor with a gap from x14 to x17.
    const holed = {
      ...arena([], [20, 20]),
      solids: [
        { x: 0, w: 14, h: 0 },
        { x: 17, w: 43, h: 0 },
      ],
    }
    const { mk, px } = markFor(holed, 20, 0, {}, 1)
    const over = mk !== null && mk[0] > 14 * TILE && mk[0] < 17 * TILE
    record(
      !over,
      mk !== null
        ? `it will not mark over a hole; it chose x${(mk[0] / TILE).toFixed(1)}`
        : 'it found nowhere legal',
    )
  }
}

// --- an unfolded bridge counts as floor, a folded one does not ---
{
  // Real 3B: the player on the approach, the snake across the gap. Before
  // the bridge opens there is no floor over x56-66; after, there is.
  const before = openRoom(level3, '3b')
  const snake = before.level.entities.byId('snake3b')
  const bridge = before.level.entities.byId('bridge3b')
  record(!bridge.isOpen(), 'with 3B\'s bridge still folded')
  const deckBefore = before.level.solids.filter(
    (s) => s.x >= 56 * TILE && s.x < 66 * TILE && M.abs(s.y - before.level.surfaceY(8)) < 1,
  )
  record(deckBefore.length === 0, 'there is no floor over the gap')

  // Stand on the far side next to the snake and let it mark.
  before.p.x = 68 * TILE
  before.p.y = before.level.surfaceY(8) - PLAYER_H / 2
  before.input.dir = 1
  for (let f = 0; f < 4; f++) before.step()
  before.input.dir = 0
  let f = 0
  while (snake.phase() !== 'mark' && f++ < 60 * 10) before.step()
  const mkBefore = snake.mark()
  record(
    mkBefore !== null,
    `it marks at x${mkBefore ? (mkBefore[0] / TILE).toFixed(1) : '?'} with the bridge shut`,
  )
  record(
    mkBefore === null || mkBefore[0] < 56 * TILE || mkBefore[0] > 66 * TILE,
    'and not out over the open gap',
  )

  // Now open the bridge and put the player on it: the deck is floor.
  const after = openRoom(level3, '3b')
  const b2 = after.level.entities.byId('bridge3b')
  const s2 = after.level.entities.byId('snake3b')
  b2.trigger(0, 'unfold')
  for (let k = 0; k < 120; k++) after.step()
  record(b2.isOpen(), 'with the bridge open')
  // Facing right, so the side it prefers is the one back across the deck.
  after.p.x = 64 * TILE
  after.p.y = after.level.surfaceY(8) - PLAYER_H / 2
  after.input.dir = 1
  for (let k = 0; k < 4; k++) after.step()
  after.input.dir = 0
  let g = 0
  while (s2.phase() !== 'mark' && g++ < 60 * 10) after.step()
  const mkAfter = s2.mark()
  record(
    mkAfter !== null,
    `it marks at x${mkAfter ? (mkAfter[0] / TILE).toFixed(1) : '?'} with the player on the bridge`,
  )
  record(
    mkAfter !== null && mkAfter[0] > 56 * TILE && mkAfter[0] < 66 * TILE,
    'on the deck itself - an unfolded bridge counts as floor',
  )
}

// =====================================================================
//  Nothing about it is random.
// =====================================================================
{
  const trace = () => {
    const t = run(arena(), 20)
    const seen = []
    for (let f = 0; f < 60 * 8; f++) {
      t.step()
      const at = t.snake.at()
      seen.push([at[0], at[1], t.snake.phase()])
    }
    return seen
  }
  const a = trace()
  const b = trace()
  let same = true
  let where = -1
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1] || a[i][2] !== b[i][2]) {
      same = false
      where = i
      break
    }
  }
  record(
    same,
    same
      ? `two runs give the same head position and state at all ${a.length} steps`
      : `the snake diverged at step ${where}`,
  )
}

// --- and 3B's recorded solution still replays with it in the room ---
{
  const sol = JSON.parse(readFileSync('src/game/solutions/3b.json', 'utf8'))
  const replay = () => {
    const t = openRoom(level3, '3b')
    if (sol.swordOut !== undefined) t.level.setSwordOut(sol.swordOut)
    const play = new Playback(sol)
    const snake = t.level.entities.byId('snake3b')
    const seen = []
    while (!play.done) {
      play.apply(t.input)
      t.step()
      seen.push([t.p.x, t.p.y, snake.at()[0], snake.at()[1]])
    }
    return { t, seen }
  }
  const one = replay()
  const two = replay()
  record(
    one.t.p.x > 68 * TILE,
    `the 3B solution still crosses to x${(one.t.p.x / TILE).toFixed(1)} with a snake in the room`,
  )
  let identical = true
  for (let i = 0; i < one.seen.length; i++) {
    for (let k = 0; k < 4; k++) {
      if (one.seen[i][k] !== two.seen[i][k]) identical = false
    }
  }
  record(
    identical,
    `and player AND snake land identically across two replays, all ${one.seen.length} steps`,
  )
  record(
    one.t.hits() === 0,
    `taking ${one.t.hits()} hits - the route is through before it can strike`,
  )
}

// =====================================================================
//  The sword can still cut it, and a reset puts it home.
// =====================================================================
{
  const t = run(arena(), 2)
  record(t.snake.hurtBox() !== null, 'it has a box the sword can find')
  record(t.snake.hurt(1) === true, 'the first hit leaves it alive (2 health)')
  record(t.snake.hits() === 1, `on ${t.snake.hits()} health`)
  record(t.snake.hurt(1) === false, 'the second kills it')
  record(!t.snake.alive(), 'it is dead')
  record(t.snake.hurtBox() === null, 'and cannot be cut again')

  t.level.resetRoom()
  record(t.snake.alive() && t.snake.hits() === 2, 'a room reset brings it back whole')
  record(t.snake.phase() === 'patrol', 'on patrol')
  record(
    M.abs(t.snake.at()[0] - 20.5 * TILE) < TILE,
    `back at its home, x${(t.snake.at()[0] / TILE).toFixed(1)}`,
  )
}

// =====================================================================
//  The second half: aim, spit, recover, retreat.
// =====================================================================
{
  const t = run(arena(), 20)
  until(t, 'aim')
  record(t.snake.phase() === 'aim', 'it reaches the aim')
  record(t.snake.target() === null, 'with nothing locked yet - that is the point')

  let f = 0
  while (t.snake.phase() === 'aim' && f++ < 300) t.step()
  record(
    M.abs(f * FIXED_DT - SNAKE_AIM_S) <= FIXED_DT * 2,
    `the aim lasts ${(f * FIXED_DT).toFixed(3)}s (spec ${SNAKE_AIM_S})`,
  )
  record(t.snake.target() !== null, 'and the target is locked when it ends')

  // Step only as far as the spit, so none of Recover's frames are eaten
  // before it is measured.
  let spat = false
  let s = 0
  while (t.snake.phase() !== 'recover' && s++ < 20) {
    if (t.snake.phase() === 'spit') spat = true
    t.step()
  }
  record(spat, 'it spits')
  record(t.log.sounds.includes('spit'), 'with a wet spit')

  let r = 0
  while (t.snake.phase() === 'recover' && r++ < 300) t.step()
  record(
    M.abs(r * FIXED_DT - SNAKE_RECOVER_S) <= FIXED_DT * 3,
    `the recover lasts ${(r * FIXED_DT).toFixed(2)}s (spec ${SNAKE_RECOVER_S}) - the attack window`,
  )
  record(t.snake.phase() === 'retreat', 'then it retreats')

  const before = t.snake.at()[0]
  let q = 0
  while (t.snake.phase() === 'retreat' && q++ < 600) t.step()
  record(
    M.abs(t.snake.at()[0] - before) > 40,
    `slithering ${M.abs(t.snake.at()[0] - before).toFixed(0)}px away before settling`,
  )
  record(t.snake.phase() === 'patrol', 'and back to patrol')

  let held = 0
  while (t.snake.phase() === 'patrol' && held++ < 60 * 6) t.step()
  record(
    held * FIXED_DT >= SNAKE_RETREAT_COOLDOWN_S - FIXED_DT * 3,
    `waiting ${(held * FIXED_DT).toFixed(2)}s before it may notice again (spec ${SNAKE_RETREAT_COOLDOWN_S})`,
  )
}

// =====================================================================
//  The venom.
// =====================================================================
{
  const t = run(arena(), 23.5)
  until(t, 'spit')
  t.step()
  record(t.snake.venom() !== null, 'spitting puts a blob in the air')

  const v1 = t.snake.venom()
  t.step()
  const v2 = t.snake.venom()
  const sp = v1 && v2 ? M.hypot(v2[0] - v1[0], v2[1] - v1[1]) / FIXED_DT : 0
  record(
    M.abs(sp - VENOM_SPEED) < 40,
    `leaving at about ${sp.toFixed(0)}px/s (spec ${VENOM_SPEED})`,
  )
  record(hex(COLOR_VENOM) === '#8E2D6B', `drawn in ${hex(COLOR_VENOM)}`)
}

// --- it lands where you were, and does not track you ---
{
  const t = run(arena(), 23)
  until(t, 'aim')
  let f = 0
  while (t.snake.phase() === 'aim' && f++ < 60) t.step()
  const aim = t.snake.target()
  record(aim !== null, 'the aim point is locked at the end of Aim')

  t.p.x = 30 * TILE
  t.step()
  let closest = 1e9
  for (let k = 0; k < 60 * 6; k++) {
    t.step()
    const v = t.snake.venom()
    if (!v || !aim) continue
    closest = M.min(closest, M.hypot(v[0] - aim[0], v[1] - aim[1]))
  }
  record(
    closest < 20,
    `teleport the player away and the blob still passes within ${closest.toFixed(0)}px of the locked point`,
  )
}

// --- the drawn arc IS the flight ---
{
  // The check I most wanted: the telegraph cannot promise a shot the blob
  // will not make, because the arc and the flight come out of one solve.
  const t = run(arena(), 23.5)
  until(t, 'aim')
  for (let k = 0; k < 20; k++) t.step()
  const arc = t.snake.arcFor([t.p.x, t.p.y])
  record(arc.length > 4, `the arc is drawn as ${arc.length} samples`)

  let f = 0
  while (t.snake.phase() !== 'spit' && f++ < 120) t.step()
  t.step()
  const flown = []
  for (let k = 0; k < 24; k++) {
    const v = t.snake.venom()
    if (v) flown.push([v[0], v[1]])
    t.step()
  }
  let worst = 0
  for (const p of flown) {
    let near = 1e9
    for (const a of arc) near = M.min(near, M.hypot(p[0] - a[0], p[1] - a[1]))
    worst = M.max(worst, near)
  }
  record(
    flown.length > 5 && worst < 16,
    `every point of the real flight sits within ${worst.toFixed(1)}px of the drawn arc`,
  )
}

// --- a fan pushes it up ---
{
  const topOf = (data) => {
    const t = run(data, 23.5)
    until(t, 'spit')
    t.step()
    let top = 1e9
    for (let k = 0; k < 60 * 4; k++) {
      t.step()
      const v = t.snake.venom()
      if (v) top = M.min(top, v[1])
    }
    return top
  }
  const plain = topOf(arena([], [20, 20]))
  const windyData = arena([], [20, 20])
  windyData.entities = [
    ...windyData.entities,
    { id: 'fan', type: 'Fan', x: 21, w: 3, floorH: 0, columnH: 10 },
  ]
  const windy = topOf(windyData)
  record(
    windy < plain - 4,
    `a draught under the shot lifts it ${(plain - windy).toFixed(0)}px higher (${plain.toFixed(0)} to ${windy.toFixed(0)})`,
  )
}

// --- destroyed by solids ---
{
  const t = run(arena(), 23.5)
  until(t, 'spit')
  t.step()
  record(t.snake.venom() !== null, 'one blob in the air')
  let gone = -1
  for (let k = 0; k < 60 * 6; k++) {
    t.step()
    if (t.snake.venom() === null) {
      gone = k
      break
    }
  }
  record(
    gone >= 0,
    `destroyed after ${(gone * FIXED_DT).toFixed(2)}s, on the floor or on the player`,
  )
}

// =====================================================================
//  Damage: the venom, the body, once each.
// =====================================================================
{
  const t = run(arena(), 23)
  let from = null
  for (let k = 0; k < 60 * 14; k++) {
    t.step()
    const at = t.level.dangerAt(t.level.boxOf(t.p))
    if (at !== null) {
      from = at
      break
    }
  }
  record(from !== null, 'standing three tiles away, something connects')
  record(
    from !== null && from < t.p.x,
    `and the knockback points away from it, from x${from !== null ? (from / TILE).toFixed(1) : '?'}`,
  )
  record(
    t.snake.venom() === null,
    'the blob is spent on that one hit rather than carrying on',
  )
}

{
  const t = run(arena([], [20, 20]), 14)
  t.input.dir = 1
  let touched = null
  for (let k = 0; k < 60 * 8; k++) {
    t.step()
    const at = t.level.dangerAt(t.level.boxOf(t.p))
    if (at !== null) {
      touched = at
      break
    }
  }
  record(touched !== null, 'walking into its body costs a hit')
  record(
    touched !== null && M.abs(touched - t.snake.at()[0]) < SNAKE_W,
    'reported from the body, so the knockback throws you off it',
  )
}

// =====================================================================
//  Two health, with a stagger.
// =====================================================================
{
  const t = run(arena(), 2)
  record(t.snake.hits() === 2 && !t.snake.isWounded(), 'two health, unhurt')

  record(t.snake.hurt(1), 'the first hit leaves it alive')
  record(t.snake.isWounded(), 'and hurt - drawn darker from now on')
  record(t.snake.phase() === 'stagger', 'staggered')
  record(t.snake.isFlashing(), 'with a flash')

  const x0 = t.snake.at()[0]
  let f = 0
  while (t.snake.phase() === 'stagger' && f++ < 300) t.step()
  record(
    M.abs(f * FIXED_DT - SNAKE_STAGGER_S) <= FIXED_DT * 2,
    `the stagger lasts ${(f * FIXED_DT).toFixed(3)}s (spec ${SNAKE_STAGGER_S})`,
  )
  const moved = M.abs(t.snake.at()[0] - x0) / (f * FIXED_DT)
  record(
    M.abs(moved - SNAKE_STAGGER_KNOCK) < 25,
    `knocked back at about ${moved.toFixed(0)}px/s (spec ${SNAKE_STAGGER_KNOCK})`,
  )
  record(
    t.snake.phase() === 'vanish',
    'and then it vanishes, which is what the spec says happens next',
  )

  record(t.snake.hurt(1) === false, 'the second hit kills it')
  record(!t.snake.alive(), 'it is dead')
  t.step()
  record(
    t.log.dust.some((d) => d.count >= PARTICLES_SNAKE_VANISH * 2),
    'with a bigger burst than its vanish',
  )
}

// =====================================================================
//  It will not spit at a hidden player.
// =====================================================================
{
  const roof = [{ x: 22, w: 3, h: 2, bottomH: 1.5 }]
  const t = run(arena(roof, [20, 20]), 23)
  until(t, 'aim')
  record(t.snake.phase() === 'aim', 'it aims at an upright player')
  t.input.flatHeld = true
  let f = 0
  while (t.snake.phase() === 'aim' && f++ < 120) t.step()
  record(t.p.isFlat(), 'folding flat under cover before it fires')
  record(t.snake.target() === null, 'the aim is abandoned rather than fired blind')
  record(t.snake.venom() === null, 'no blob is spat')
  record(
    t.snake.phase() === 'recover',
    `and it goes straight to recovering (${t.snake.phase()})`,
  )
}

// =====================================================================
//  Respawn: 25s, unless the room has been finished with.
// =====================================================================
{
  const t = run(arena(), 2)
  t.snake.hurt(1)
  t.snake.hurt(1)
  record(!t.snake.alive(), 'dead')
  for (let k = 0; k < 60 * 20; k++) t.step()
  record(!t.snake.alive(), 'still dead after 20s')
  // Step to the exact frame it comes back: it starts patrolling at once,
  // so a second later it is already tiles away from where it arrived.
  let back = 0
  while (!t.snake.alive() && back++ < 60 * 10) t.step()
  record(t.snake.alive(), `back after ${SNAKE_RESPAWN_S}s`)
  record(
    M.abs(t.snake.at()[0] - 14.5 * TILE) < TILE,
    `at its patrol start, x${(t.snake.at()[0] / TILE).toFixed(1)}`,
  )
  record(t.snake.hits() === 2, 'with both health back')
  record(!t.snake.isWounded(), 'and no longer hurt')
}

{
  const t = run(arena(), 2)
  t.snake.hurt(1)
  t.snake.hurt(1)
  record(!t.snake.alive(), 'dead again')
  // Cleared, the way leaving a room to the right marks it.
  t.level.roomAt(t.p.x).cleared = true
  for (let k = 0; k < 60 * 30; k++) t.step()
  record(
    !t.snake.alive(),
    'and it stays dead for 30s once the room has been cleared',
  )
}

// --- the venom is deterministic too ---
{
  const trace = () => {
    const t = run(arena(), 23.5)
    const seen = []
    for (let k = 0; k < 60 * 10; k++) {
      t.step()
      const v = t.snake.venom()
      seen.push(v ? [v[0], v[1]] : null)
    }
    return seen
  }
  const a = trace()
  const b = trace()
  let same = true
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if ((x === null) !== (y === null)) same = false
    else if (x && y && (x[0] !== y[0] || x[1] !== y[1])) same = false
  }
  record(same, `two runs fly the venom identically across ${a.length} steps`)
}

// =====================================================================
//  Step L3-7: it respects a fan column too.
// =====================================================================
{
  // A fan right over its patrol, so the draught cannot be walked out of.
  const data = arena([], [20, 21])
  data.entities = [
    ...data.entities,
    { id: 'fan', type: 'Fan', x: 20, w: 2, floorH: 0, columnH: 10 },
  ]
  const t = run(data, 2)
  const floorY = t.snake.at()[1]
  let highest = floorY
  for (let f = 0; f < 60 * 4; f++) {
    t.step()
    highest = M.min(highest, t.snake.at()[1])
  }
  record(
    highest < floorY - 40,
    `a snake standing in a draught is carried ${(floorY - highest).toFixed(0)}px up`,
  )

  // Take the fan away and it comes back down to its own floor.
  t.level.entities.byId('fan').draughtAt = () => null
  let back = 0
  while (t.snake.at()[1] < floorY - 2 && back++ < 60 * 6) t.step()
  record(
    M.abs(t.snake.at()[1] - floorY) < 3,
    `and falls back to its floor in ${(back * FIXED_DT).toFixed(2)}s once the air stops`,
  )
  record(
    t.snake.phase() === 'patrol',
    'carrying on patrolling the whole time - it is lifted, not launched',
  )
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
