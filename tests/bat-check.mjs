// Step L2-8a: the bat.
//
// Built on its own tiny level, so every state can be driven without
// disturbing the two rooms that are already proven.
import { scene } from './stub-scene.mjs'
import { Level } from '../src/game/Level.ts'
import { Player } from '../src/game/Player.ts'
import { level2 } from '../src/game/levels/level2.ts'
import {
  BAT_ALERT_S,
  BAT_COOLDOWN_S,
  BAT_DIVE_SPEED,
  BAT_H,
  BAT_RANGE_X,
  BAT_RANGE_Y,
  BAT_RETURN_S,
  BAT_STUN_S,
  BAT_W,
  COLOR_FORM,
  COLOR_L2_BG,
  COLOR_L2_FOLD,
  COLOR_WIND,
  FIXED_DT,
  HURT_KNOCK_X,
  PLAYER_H,
  TILE,
} from '../src/game/constants.ts'

const M = globalThis.Math
const out = []
const record = (ok, msg) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

function recorder() {
  const log = { sounds: [], dust: [], labels: [] }
  return {
    log,
    fx: {
      dust: (x, y, count, color) => log.dust.push({ x, y, count, color }),
      shake: () => {}, zoom: () => {},
      sound: (name) => log.sounds.push(name),
      label: (id, x, y, text) => log.labels.push({ id, x, y, text }),
      hum: () => {},
    },
  }
}

/**
 * A level that is nothing but a floor, a bat on a strip, and whatever extra
 * solids or entities a test needs.
 */
function arena(extraSolids = [], extraEntities = []) {
  return {
    name: 'Test',
    width: 40,
    height: 18,
    floorRow: 14,
    palette: { bg: COLOR_L2_BG, fold: COLOR_L2_FOLD, wind: COLOR_WIND, form: COLOR_FORM },
    hazards: true,
    spawn: { x: 2, h: 0 },
    solids: [{ x: 0, w: 40, h: 0 }, ...extraSolids],
    entities: [
      { id: 'cp', type: 'Checkpoint', x: 1, h: 0 },
      { id: 'bat', type: 'Bat', x: 20, w: 1, h: 7.5 },
      ...extraEntities,
    ],
    rooms: [{ id: 'test', name: 'Test', from: 0, to: 40, checkpoint: 'cp' }],
  }
}

/**
 * The level, a player standing at `tileX`, and a step function. `held` is
 * applied before the first step, so a test can start the player already
 * folded rather than giving the bat a frame to notice them standing.
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
  const input = {
    dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
    dashPressed: false, flatHeld: false, swordPressed: false,
    slashPressed: false, resetPressed: false,
    ...held,
  }
  // What GameScene does: ask the level whether anything hit us, and hurt the
  // player if so. Four lines, so the test exercises the real damage path.
  let hits = 0
  const step = () => {
    p.update(FIXED_DT, input, level.solids, level.updraftAt(p))
    level.update(FIXED_DT, p, r.fx)
    const from = level.dangerAt(level.boxOf(p))
    if (from !== null) {
      hits++
      p.hurt(Math.sign(p.x - from) || 1)
    }
    input.jumpPressed = false
    input.jumpReleased = false
    input.dashPressed = false
  }
  step()
  return {
    level,
    p,
    input,
    step,
    log: r.log,
    bat: level.entities.byId('bat'),
    hits: () => hits,
  }
}

const until = (t, want, cap = 60 * 20) => {
  let f = 0
  while (t.bat.phase() !== want && f++ < cap) t.step()
  return f
}

// =====================================================================
//  The state machine, and the spec's timings.
// =====================================================================
{
  // Player far away: it should just hang.
  const far = run(arena(), 2)
  for (let f = 0; f < 120; f++) far.step()
  record(far.bat.phase() === 'hang', 'with the player out of range it hangs')
  record(far.hits() === 0, 'and nothing is hurt')
  const a = far.bat.at()
  for (let f = 0; f < 60; f++) far.step()
  const b = far.bat.at()
  record(
    a[1] !== b[1] && M.abs(a[1] - b[1]) < 8,
    `swaying on its strip, by ${M.abs(a[1] - b[1]).toFixed(1)}px`,
  )
  record(far.bat.at()[0] === far.bat.at()[0], 'without drifting sideways')

  // Player underneath: the whole cycle.
  const t = run(arena(), 20)
  record(t.bat.phase() === 'alert', 'standing under it, it alerts on the first frame')
  record(t.log.sounds.includes('sting'), 'playing the two-note sting')
  // The tag is raised from inside the alert state, so it appears on the
  // frame after the one that entered it.
  t.step()
  record(
    t.log.labels.some((l) => l.text === '!'),
    'and popping a "!" tag above itself',
  )

  let alertFrames = 0
  while (t.bat.phase() === 'alert' && alertFrames++ < 300) t.step()
  record(
    M.abs(alertFrames * FIXED_DT - BAT_ALERT_S) <= FIXED_DT * 2,
    `the alert lasts ${(alertFrames * FIXED_DT).toFixed(3)}s (spec ${BAT_ALERT_S})`,
  )
  record(t.bat.phase() === 'dive', 'then it dives')
  record(t.bat.target() !== null, 'with a target locked')

  let diveFrames = 0
  while (t.bat.phase() === 'dive' && diveFrames++ < 300) t.step()
  const dived = diveFrames * FIXED_DT
  record(
    dived > 0.2 && dived < 1.6,
    `the dive from directly overhead takes ${dived.toFixed(2)}s at ${BAT_DIVE_SPEED}px/s`,
  )

  // It caught the player standing still underneath, so no stun.
  record(
    t.hits() === 1,
    `it hit the player once on the way through (${t.hits()})`,
  )
  record(
    t.bat.phase() === 'return',
    `and flies home rather than being stunned (${t.bat.phase()})`,
  )

  let returnFrames = 0
  while (t.bat.phase() === 'return' && returnFrames++ < 300) t.step()
  record(
    M.abs(returnFrames * FIXED_DT - BAT_RETURN_S) <= FIXED_DT * 2,
    `the return takes ${(returnFrames * FIXED_DT).toFixed(2)}s (spec ${BAT_RETURN_S})`,
  )
  record(t.bat.phase() === 'hang', 'and it hangs again')
  const home = t.bat.at()
  record(
    M.abs(home[0] - 20.5 * TILE) < 2,
    `back on its strip at x${(home[0] / TILE).toFixed(2)}`,
  )

  // The cooldown: it must not alert again immediately, even though the
  // player is still standing right there.
  let waited = 0
  while (t.bat.phase() === 'hang' && waited++ < 60 * 6) t.step()
  const gap = waited * FIXED_DT
  record(
    gap >= BAT_COOLDOWN_S - FIXED_DT * 2,
    `it waits ${gap.toFixed(2)}s before alerting again (spec ${BAT_COOLDOWN_S})`,
  )
  record(t.bat.phase() === 'alert', 'and then it does')
}

// =====================================================================
//  Range: the corners of the box, not just the middle.
// =====================================================================
{
  const near = run(arena(), 20 - (BAT_RANGE_X - 1))
  for (let f = 0; f < 10; f++) near.step()
  record(
    near.bat.phase() === 'alert',
    `${BAT_RANGE_X - 1} tiles away it alerts`,
  )

  const away = run(arena(), 20 - (BAT_RANGE_X + 1))
  for (let f = 0; f < 60; f++) away.step()
  record(
    away.bat.phase() === 'hang',
    `${BAT_RANGE_X + 1} tiles away it does not`,
  )

  // Vertically. The reach is measured between the boxes, which is what
  // makes the spec's h7.5 anchor and its 6-tile reach agree: centre to
  // centre a player on the floor is 6.5 tiles away and could never be
  // attacked from the bat's own anchor.
  const low = run(arena(), 20)
  const centres = M.abs(low.bat.at()[1] - low.p.y) / TILE
  // The gap proper: the bat's underside to the top of the player's head.
  const gap = (low.p.y - low.p.halfH() - low.bat.hurtBox().bottom) / TILE
  record(
    centres > BAT_RANGE_Y && gap < BAT_RANGE_Y,
    `a player on the floor is ${centres.toFixed(1)} tiles below the bat centre to centre - outside its ${BAT_RANGE_Y}-tile reach - but ${gap.toFixed(1)} box to box`,
  )
  for (let f = 0; f < 10; f++) low.step()
  record(
    low.bat.phase() !== 'hang',
    `so standing under it does wake it (${low.bat.phase()})`,
  )

  // And a player far enough below genuinely is out of reach: drop the
  // player 7 tiles under the bat's box and it stays put.
  const deep = run(arena([{ x: 26, w: 6, h: -7 }]), 29, -7)
  for (let f = 0; f < 90; f++) deep.step()
  record(
    deep.bat.phase() === 'hang',
    `${BAT_RANGE_Y + 1} tiles below, it ignores them`,
  )
}

// =====================================================================
//  Hiding: flat under a slab is ignored, flat in the open is not.
// =====================================================================
{
  // A platform under the bat, so a flat player is still within its reach —
  // folding on the floor takes 30px off your height and puts you outside it
  // anyway, which would prove nothing about the hiding rule.
  const floor = [{ x: 16, w: 10, h: 3 }]
  // A slab over part of that platform: a slit's pillar is exactly this
  // shape. Its underside is 48px up, so a standing player fits under it too,
  // which is what lets one spot test both halves of the rule.
  const roof = [...floor, { x: 18, w: 2, h: 4.5, bottomH: 4 }]

  // Flat from the first frame, so the bat never sees them standing.
  const t = run(arena(roof), 18.5, 3, { flatHeld: true })
  for (let f = 0; f < 180; f++) t.step()
  record(t.p.isFlat(), 'folded flat under a slab, within reach')
  record(
    t.bat.phase() === 'hang',
    `the bat ignores a player hiding under it, however long they wait (${t.bat.phase()})`,
  )
  record(t.hits() === 0, 'and never touches them')

  // Stand up in the same spot and it notices.
  t.input.flatHeld = false
  for (let f = 0; f < 60; f++) t.step()
  record(
    !t.p.isFlat() && t.bat.phase() !== 'hang',
    `standing up in the same place wakes it (${t.bat.phase()})`,
  )

  // Flat in the open is NOT hiding - the half of the rule that could
  // silently never fire, and the one that makes it a hiding rule rather
  // than a folding rule.
  const open = run(arena(floor), 22, 3, { flatHeld: true })
  for (let f = 0; f < 60; f++) open.step()
  record(open.p.isFlat(), 'folded flat in the open, at the same height')
  record(
    open.bat.phase() !== 'hang',
    `is still fair game (${open.bat.phase()})`,
  )
}

// =====================================================================
//  Fairness: the dive target is locked when the alert ends.
// =====================================================================
{
  const t = run(arena(), 20)
  until(t, 'dive')
  const locked = t.bat.target()

  // Teleport the player clean across the arena mid-dive.
  const path = []
  for (let f = 0; f < 10; f++) {
    t.step()
    path.push(t.bat.at())
  }
  t.p.x = 6 * TILE
  const after = []
  for (let f = 0; f < 20; f++) {
    t.step()
    after.push(t.bat.at())
  }
  record(
    JSON.stringify(t.bat.target()) === JSON.stringify(locked),
    'moving the player mid-dive does not move the locked target',
  )

  // Re-run the identical dive without the teleport and compare the paths.
  const same = run(arena(), 20)
  until(same, 'dive')
  const ref = []
  for (let f = 0; f < 30; f++) {
    same.step()
    ref.push(same.bat.at())
  }
  const mine = [...path, ...after]
  let diverged = -1
  for (let i = 0; i < M.min(ref.length, mine.length); i++) {
    if (M.abs(ref[i][0] - mine[i][0]) > 0.001 || M.abs(ref[i][1] - mine[i][1]) > 0.001) {
      diverged = i
      break
    }
  }
  record(
    diverged < 0,
    diverged < 0
      ? `the dive follows the same ${mine.length} points either way, to the pixel`
      : `the dive changed at point ${diverged}, so it is tracking the player`,
  )
}

// =====================================================================
//  The dive: speed, shape, and the stun.
// =====================================================================
{
  // Player off to one side, so the curve is a real swoop.
  const t = run(arena(), 24)
  until(t, 'dive')
  const start = t.bat.at()
  let lowest = start[1]
  let steps = 0
  let dist = 0
  let prev = start
  while (t.bat.phase() === 'dive' && steps++ < 400) {
    t.step()
    const now = t.bat.at()
    dist += M.hypot(now[0] - prev[0], now[1] - prev[1])
    prev = now
    lowest = M.max(lowest, now[1])
  }
  const secs = steps * FIXED_DT
  record(
    M.abs(dist / secs - BAT_DIVE_SPEED) / BAT_DIVE_SPEED < 0.08,
    `it travels at ${(dist / secs).toFixed(0)}px/s (spec ${BAT_DIVE_SPEED})`,
  )
  record(
    secs > 0.4 && secs < 1.8,
    `a ${(dist).toFixed(0)}px dive takes ${secs.toFixed(2)}s - the spec's "about 0.9s" is one distance, not all of them`,
  )
  record(lowest > start[1] + 100, `swooping ${(lowest - start[1]).toFixed(0)}px down on the way`)

  // A dive into a wall, with nobody to hit: stunned at the contact point.
  const wall = run(arena([{ x: 26, w: 2, h: 6 }]), 26.9)
  until(wall, 'dive')
  let f = 0
  while (wall.bat.phase() === 'dive' && f++ < 400) wall.step()
  record(
    wall.bat.phase() === 'stunned' || wall.hits() > 0,
    `diving at a wall ends in ${wall.bat.phase()}`,
  )
  if (wall.bat.phase() === 'stunned') {
    const stuck = wall.bat.at()
    let stunFrames = 0
    while (wall.bat.phase() === 'stunned' && stunFrames++ < 300) wall.step()
    record(
      M.abs(stunFrames * FIXED_DT - BAT_STUN_S) <= FIXED_DT * 2,
      `the stun lasts ${(stunFrames * FIXED_DT).toFixed(2)}s (spec ${BAT_STUN_S})`,
    )
    record(
      M.abs(wall.bat.at()[0] - stuck[0]) < 1 && M.abs(wall.bat.at()[1] - stuck[1]) < 1,
      'and it stays stuck where it hit',
    )
    record(wall.bat.phase() === 'return', 'then it flies home')
  }
}

// =====================================================================
//  Damage: only during the dive, only on overlap, only once.
// =====================================================================
{
  const t = run(arena(), 20)
  const box = () => t.level.boxOf(t.p)

  record(t.bat.dangerAt(box()) === null, 'hanging, it is harmless')
  until(t, 'alert')
  record(t.bat.dangerAt(box()) === null, 'alerting, it is harmless')

  until(t, 'dive')
  // Not yet overlapping: it starts eight tiles up.
  record(t.bat.dangerAt(box()) === null, 'diving but not yet touching, harmless')

  let hitAt = -1
  let extra = 0
  for (let f = 0; f < 200 && t.bat.phase() === 'dive'; f++) {
    t.step()
    if (t.hits() > 0 && hitAt < 0) hitAt = f
    else if (hitAt >= 0 && t.bat.dangerAt(box()) !== null) extra++
  }
  record(hitAt >= 0, `it hits the player ${hitAt} frames into the dive`)
  record(extra === 0, 'and cannot hit again in the same dive')
  record(t.hits() === 1, `exactly one hit per dive (${t.hits()})`)

  // Knockback points away from the bat.
  const k = run(arena(), 20)
  until(k, 'dive')
  const x0 = k.p.x
  let guard = 0
  while (k.hits() === 0 && guard++ < 60 * 10) k.step()
  record(
    M.abs(k.p.vx) === HURT_KNOCK_X,
    `the hit throws the player at ${M.abs(k.p.vx)}px/s`,
  )
  for (let f = 0; f < 20; f++) k.step()
  record(k.p.x !== x0, `and moves them ${(k.p.x - x0).toFixed(0)}px`)
}

// =====================================================================
//  One hit kills it, and it stays dead until the room resets.
// =====================================================================
{
  const t = run(arena(), 20)
  record(t.bat.alive() && t.bat.hits() === 1, 'one health')
  // done() is what the "watch its wings" tag waits on: seen the telegraph.
  record(t.bat.done(), 'and it reports itself seen, having just alerted')
  const unseen = run(arena(), 2)
  for (let f = 0; f < 60; f++) unseen.step()
  record(
    !unseen.bat.done(),
    'while one that has never alerted does not',
  )
  record(t.bat.hurtBox() !== null, 'and a box the sword can find')

  const survived = t.bat.hurt(1)
  record(!survived, 'one hit kills it')
  record(!t.bat.alive(), 'it is dead')
  record(t.bat.hurtBox() === null, 'and cannot be cut again')

  t.log.dust.length = 0
  t.log.sounds.length = 0
  t.step()
  record(t.log.dust.length === 1, 'bursting into triangles once')
  record(
    t.log.dust[0] && t.log.dust[0].count >= 8,
    `${t.log.dust[0]?.count} of them`,
  )
  record(t.log.sounds.includes('hit'), 'with the crunch')

  t.log.dust.length = 0
  for (let f = 0; f < 60; f++) t.step()
  record(t.log.dust.length === 0, 'and it does not burst every frame after')
  record(t.hits() === 0, 'a dead bat does no damage')

  t.level.resetRoom()
  record(t.bat.alive(), 'a room reset brings it back')
  record(t.bat.phase() === 'hang', 'hanging where it started')
}

// =====================================================================
//  Wind: the same dive bends upward over a fan.
// =====================================================================
{
  const plain = run(arena(), 24)
  until(plain, 'dive')
  let bare = 0
  let f = 0
  while (plain.bat.phase() === 'dive' && f++ < 400) {
    plain.step()
    bare = M.max(bare, plain.bat.at()[1])
  }

  // The same geometry, with a fan blowing up through the middle of it.
  const windy = run(
    arena([], [
      { id: 'fan', type: 'Fan', x: 21, w: 3, floorH: 0, columnH: 9 },
    ]),
    24,
  )
  until(windy, 'dive')
  let lifted = 0
  f = 0
  while (windy.bat.phase() === 'dive' && f++ < 400) {
    windy.step()
    lifted = M.max(lifted, windy.bat.at()[1])
  }
  record(
    lifted < bare - 4,
    `a fan under the dive bends it ${(bare - lifted).toFixed(0)}px shallower (${bare.toFixed(0)} to ${lifted.toFixed(0)})`,
  )
}

// =====================================================================
//  Room 2B's bat, in the real level.
// =====================================================================
{
  const level = new Level(level2)
  const bat = level.entities.byId('bat1')
  record(!!bat, "2B's bat is built from the level data")

  const r = recorder()
  const p = new Player(
    scene,
    45 * TILE,
    level.surfaceY(0) - PLAYER_H / 2,
    level.solids,
  )
  const input = {
    dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
    dashPressed: false, flatHeld: false, swordPressed: false,
    slashPressed: false, resetPressed: false,
  }
  let hits = 0
  const seen = new Set()
  for (let f = 0; f < 60 * 12; f++) {
    p.update(FIXED_DT, input, level.solids, level.updraftAt(p))
    level.update(FIXED_DT, p, r.fx)
    seen.add(bat.phase())
    const from = level.dangerAt(level.boxOf(p))
    if (from !== null) {
      hits++
      p.hurt(Math.sign(p.x - from) || 1)
    }
  }
  record(
    seen.has('alert') && seen.has('dive'),
    `standing in the arena it runs through ${[...seen].join(', ')}`,
  )
  record(
    hits > 0,
    `and hits a player who just stands there ${hits} times in 12s`,
  )
  record(
    hits <= 5,
    `which is ${hits} in 12s, not a hit every frame`,
  )

  // Its hitbox is the spec's 28x20.
  const box = bat.hurtBox()
  record(
    !!box && M.abs(box.right - box.left - BAT_W) < 0.01 && M.abs(box.bottom - box.top - BAT_H) < 0.01,
    `the hitbox is ${(box.right - box.left).toFixed(0)}x${(box.bottom - box.top).toFixed(0)} (spec ${BAT_W}x${BAT_H})`,
  )
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
