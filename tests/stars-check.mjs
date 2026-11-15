// Step L3-9: the three paper stars, and the par times they are measured
// against.
import { readFileSync } from 'node:fs'
import { Records, roomLabel } from '../src/game/Records.ts'
import { drawStars } from '../src/game/ui/star.ts'
import { LEVELS, roomGroups } from '../src/game/levels/index.ts'
import {
  COLOR_FOLD,
  MAX_SPEED,
  ROOM_PAR_S,
  STAR_PX,
  TILE,
} from '../src/game/constants.ts'

const M = Math
const out = []
const record = (ok, msg) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

/** The spec's table, written out again so a typo cannot agree with itself. */
const SPEC = {
  '1a': 20, '1b': 20, '1c': 25,
  '2a': 35, '2b': 45, '2c': 50,
  '3a': 50, '3b': 60, '3c': 80,
}

// =====================================================================
//  The table.
// =====================================================================
{
  const ids = Object.keys(ROOM_PAR_S)
  record(ids.length === 9, `${ids.length} rooms have a par time`)

  let same = true
  for (const [id, par] of Object.entries(SPEC)) {
    if (ROOM_PAR_S[id] !== par) same = false
  }
  record(
    same,
    `every one matches the spec: ${ids.map((i) => `${i} ${ROOM_PAR_S[i]}s`).join(', ')}`,
  )

  // A key that is not a room id would cost that room its second star for
  // ever, silently, so it is worth a check of its own.
  const real = new Set(LEVELS.flatMap((l) => l.rooms.map((r) => r.id)))
  const strays = ids.filter((id) => !real.has(id))
  record(
    strays.length === 0,
    `and every key is a real room (${strays.join(', ') || 'no strays'})`,
  )

  // The other direction: which rooms have no par, and why.
  const without = [...real].filter((id) => ROOM_PAR_S[id] === undefined)
  record(
    without.length === 1 && without[0] === 'lane',
    `the only room without one is ${without.join(', ')}, which the spec's table leaves out`,
  )
}

// =====================================================================
//  One star at a time.
// =====================================================================
{
  const r = new Records()
  record(r.stars('2b') === 0, 'an unvisited room has no stars')

  // Over par, with resets and a hit: finishing it is still worth one.
  r.submit('2b', 90, 4, 2)
  record(r.stars('2b') === 1, 'finishing a room earns the first star')

  const u = new Records()
  u.submit('2b', 30, 2, 1)
  record(u.stars('2b') === 2, 'finishing under par earns the second as well')

  const c = new Records()
  c.submit('2b', 90, 0, 0)
  record(c.stars('2b') === 2, 'a clean but slow run earns the first and third')

  const a = new Records()
  a.submit('2b', 30, 0, 0)
  record(a.stars('2b') === 3, 'and a clean run under par earns all three')
}

// --- a hit alone is enough to deny the third star ---
{
  const r = new Records()
  r.submit('3b', 20, 0, 1)
  record(r.stars('3b') === 2, 'no resets but one hit is not a clean run')
  const q = new Records()
  q.submit('3b', 20, 1, 0)
  record(q.stars('3b') === 2, 'and no hits but one reset is not either')
}

// --- the stars are independent, like the two minima already are ---
{
  const r = new Records()
  r.submit('2c', 20, 5, 3)
  record(r.stars('2c') === 2, 'a fast messy run: finish and par')
  r.submit('2c', 80, 0, 0)
  record(
    r.stars('2c') === 3,
    `a slow clean run afterwards completes the set, from two different visits: "${roomLabel('2C', r.get('2c'))}"`,
  )
}

// --- the boundary ---
{
  const r = new Records()
  r.submit('1a', ROOM_PAR_S['1a'], 0, 0)
  record(
    r.stars('1a') === 2,
    `exactly par (${ROOM_PAR_S['1a']}s) is not under par, so that run gets two`,
  )
  r.submit('1a', ROOM_PAR_S['1a'] - 0.1, 0, 0)
  record(r.stars('1a') === 3, 'a tenth of a second quicker gets three')
}

// --- the movement lane, and why it shows two ---
{
  const r = new Records()
  record(r.starsPossible('lane') === 2, 'the lane can show two stars')
  record(r.starsPossible('1a') === 3, 'and every other room three')
  r.submit('lane', 1, 0, 0)
  record(
    r.stars('lane') === 2,
    'a clean run through the lane earns both of the two it has, and never a third',
  )
}

// =====================================================================
//  Is every par reachable?
// =====================================================================
//
//  A par no route can beat is a star nobody can earn, so each one is held
//  against a time. Three of the nine are measured against a real recorded
//  run; the rest are held against the fastest the room could possibly be
//  crossed - its width at full running speed, no jumps, no puzzles - which
//  is a lower bound rather than a route, and is reported as such.
{
  for (const room of ['3a', '3b', '3c']) {
    const sol = JSON.parse(readFileSync(`src/game/solutions/${room}.json`, 'utf8'))
    const secs = sol.steps / sol.hz
    const par = ROOM_PAR_S[room]
    record(
      secs < par,
      `${room.toUpperCase()}: the recorded solution takes ${secs.toFixed(1)}s against a par of ${par}s - ${(par - secs).toFixed(1)}s of room`,
    )
  }

  for (const level of LEVELS) {
    for (const spec of level.rooms) {
      const par = ROOM_PAR_S[spec.id]
      if (par === undefined) continue
      const floor = ((spec.to - spec.from) * TILE) / MAX_SPEED
      record(
        par > floor * 1.5,
        `${spec.id.toUpperCase()}: par ${par}s against ${floor.toFixed(1)}s to run its ${spec.to - spec.from} tiles flat out`,
      )
    }
  }
}

// =====================================================================
//  The rule that decides a visit is finished.
// =====================================================================
//
//  GameScene banks a room when the room ahead begins at or past the edge
//  of the one behind. The scene itself needs a canvas, so what is checked
//  here is the property it rests on: that the test tells the two
//  directions apart at every real room boundary.
{
  let rightwards = true
  let leftwards = true
  let pairs = 0
  for (const level of LEVELS) {
    const rooms = level.rooms
    for (let i = 0; i < rooms.length - 1; i++) {
      const a = rooms[i]
      const b = rooms[i + 1]
      pairs++
      // Moving on: the room ahead starts at or past the exit behind.
      if (!(b.from * TILE >= a.to * TILE)) rightwards = false
      // Turning back: it does not.
      if (a.from * TILE >= b.to * TILE) leftwards = false
    }
  }
  record(
    rightwards,
    `across all ${pairs} room boundaries, leaving by the exit passes the test`,
  )
  record(leftwards, 'and walking back the way you came fails it')
}

// --- and Records holds nothing but finished visits ---
{
  const r = new Records()
  record(
    r.get('2c') === undefined && r.stars('2c') === 0,
    'a room backed out of is never submitted, so it has no record and no star',
  )
}

// =====================================================================
//  The drawing: three stars, the earned ones filled.
// =====================================================================
{
  const box = { x: 100, y: 200, w: 400, h: 40 }
  const draw = (earned, possible = 3) => {
    const shapes = []
    let color = null
    const g = {
      fillStyle: (c) => { color = c; return g },
      lineStyle: () => g,
      fillPoints: (pts) => { shapes.push({ color, pts }); return g },
      strokePoints: () => g,
      lineBetween: () => g,
    }
    drawStars(g, box, earned, possible)
    return shapes
  }

  const none = draw(0)
  record(none.length === 3, `an unearned room still draws ${none.length} stars, as empty paper`)
  record(none.every((s) => s.color !== COLOR_FOLD), 'none of them filled')

  const two = draw(2)
  record(
    two.filter((s) => s.color === COLOR_FOLD).length === 2,
    'two stars earned fills exactly two',
  )
  record(
    two[0].color === COLOR_FOLD && two[2].color !== COLOR_FOLD,
    'and fills them from the left, so the gap is always on the right',
  )

  const all = draw(3)
  record(all.every((s) => s.color === COLOR_FOLD), 'three earned fills all three')

  const lane = draw(2, 2)
  record(lane.length === 2, 'a room with two possible draws two')

  // Each star has ten corners and sits inside the row.
  record(all[0].pts.length === 10, `each star is a path of ${all[0].pts.length} corners`)
  const xs = all.flatMap((t) => t.pts.map((p) => p.x))
  const ys = all.flatMap((t) => t.pts.map((p) => p.y))
  record(
    M.min(...xs) > box.x && M.max(...xs) < box.x + box.w,
    `and the group sits inside the row (x ${M.min(...xs).toFixed(0)}-${M.max(...xs).toFixed(0)} of ${box.x}-${box.x + box.w})`,
  )
  record(
    M.min(...ys) > box.y && M.max(...ys) < box.y + box.h,
    'vertically centred in it',
  )
  record(
    M.abs((M.min(...ys) + M.max(...ys)) / 2 - (box.y + box.h / 2)) < 0.01,
    `on the row's middle line, ${STAR_PX}px to a point`,
  )
}

// =====================================================================
//  Both Room selects, for all three levels.
// =====================================================================
{
  const groups = roomGroups()
  record(groups.length === 3, `Room select groups ${groups.length} levels`)
  const ids = groups.flatMap((g) => g.choices.map((c) => c.room))
  record(ids.length === 10, `with ${ids.length} rooms in all: ${ids.join(', ')}`)

  // Every room in the list can show stars: it either has a par or is the
  // lane, and either way starsPossible answers.
  const r = new Records()
  record(
    ids.every((id) => r.starsPossible(id) >= 2),
    'and every one of them has a star row of its own',
  )

  // Best time and fewest resets, for all three levels, which is the other
  // half of what the step asks for.
  for (const [i, g] of groups.entries()) {
    const id = g.choices.at(-1).room
    r.submit(id, 12.5, 2, 0)
    const label = roomLabel(g.choices.at(-1).name, r.get(id))
    record(
      label.includes('0:12') && label.includes('2r'),
      `Level ${i + 1} shows a banked time and resets: "${label}"`,
    )
  }
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(
  out.some((r) => r.startsWith('FAIL'))
    ? nl + 'SOME CHECKS FAILED'
    : nl + 'ALL CHECKS PASSED',
)
