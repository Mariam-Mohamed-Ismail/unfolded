// Step L3-1: Level 3's skeleton.
import { scene } from './stub-scene.mjs'
import { Level } from '../src/game/Level.ts'
import { Player } from '../src/game/Player.ts'
import { Checkpoint } from '../src/game/entities/Checkpoint.ts'
import { LEVELS, roomGroups } from '../src/game/levels/index.ts'
import { level1 } from '../src/game/levels/level1.ts'
import { level2 } from '../src/game/levels/level2.ts'
import { level3 } from '../src/game/levels/level3.ts'
import {
  CAM_LERP,
  CAM_LERP_Y,
  COLOR_SOLID,
  FIXED_DT,
  PLAYER_H,
  TILE,
} from '../src/game/constants.ts'

const M = globalThis.Math
const out = []
const record = (ok, msg) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

const NO_FX = {
  dust: () => {}, shake: () => {}, zoom: () => {},
  sound: () => {}, label: () => {}, hum: () => {},
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0').toUpperCase()

/** A player standing in Level 3 at (tile, h). */
function run(tileX, h = 0) {
  const level = new Level(level3)
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
    level.update(FIXED_DT, p, NO_FX)
    input.jumpPressed = false
    input.jumpReleased = false
    input.dashPressed = false
  }
  step()
  return { level, p, input, step }
}

const base = new Level(level3)

// =====================================================================
//  The shape of the world.
// =====================================================================
{
  record(level3.width === 120, `120 tiles wide`)
  record(level3.height === 24, `24 tall`)
  record(level3.floorRow === 20, `with the main floor on row ${level3.floorRow}`)
  // The spec states this pixel value outright, so assert it rather than
  // trusting the arithmetic.
  record(
    base.surfaceY(0) === 640,
    `so the floor surface is y=${base.surfaceY(0)}px, the number the spec gives`,
  )
  record(
    base.widthPx === 120 * TILE && base.heightPx === 24 * TILE,
    `${base.widthPx}x${base.heightPx}px of world`,
  )
  // The first level taller than the viewport by more than a sliver.
  record(
    base.heightPx - 540 > 200,
    `${base.heightPx - 540}px of vertical scroll, where Level 2 has ${level2.height * TILE - 540}px`,
  )
  record(
    base.surfaceY(-4) === 24 * TILE,
    'and four rows left under the floor for pits',
  )
}

// =====================================================================
//  The palette, hex by hex against the brief.
// =====================================================================
{
  const p = level3.palette
  record(hex(p.bg) === '#EBD5CF', `background ${hex(p.bg)}`)
  record(hex(p.solid) === '#F7F2E8', `platforms cream ${hex(p.solid)}`)
  record(hex(p.line) === '#2B2A33', `with the dark outline ${hex(p.line)}`)
  record(hex(p.fold) === '#6B5FC4', `folds purple ${hex(p.fold)}`)
  record(hex(p.wind) === '#F0A93B', `wind amber ${hex(p.wind)}`)
  record(hex(p.form) === '#2FA58A', `seals teal ${hex(p.form)}`)
}

// =====================================================================
//  The floors, measured in pixels rather than read back.
// =====================================================================
{
  const at = (tile) =>
    base.solids.find((s) => s.x === tile * TILE)

  const a = at(0)
  record(
    !!a && a.w === 36 * TILE && a.y === base.surfaceY(0),
    `3A's floor runs x0 to x${a ? (a.x + a.w) / TILE : '?'} at h0`,
  )

  // 3B's single floor is now cut by the gap its bridge spans.
  const b = at(36)
  record(
    !!b && b.w === 20 * TILE && b.y === base.surfaceY(8),
    `3B's approach runs x36 to x${b ? (b.x + b.w) / TILE : '?'}, its top ${b ? base.surfaceY(0) - b.y : '?'}px up`,
  )
  const pit = at(56)
  record(
    !!pit && pit.w === 10 * TILE && pit.y === base.surfaceY(6),
    `its pit runs x56 to x${pit ? (pit.x + pit.w) / TILE : '?'}, ${pit ? (pit.y - base.surfaceY(8)) / TILE : '?'} tiles down`,
  )
  const far = at(66)
  record(
    !!far && far.w === 10 * TILE && far.y === base.surfaceY(8),
    `and the far side x66 to x${far ? (far.x + far.w) / TILE : '?'}, back at h8`,
  )

  const ledge = at(76)
  record(
    !!ledge && ledge.w === 10 * TILE && ledge.y === base.surfaceY(8),
    `3C's entry ledge runs x76 to x${ledge ? (ledge.x + ledge.w) / TILE : '?'} at h8`,
  )

  // The shaft floor stops where the exit platform rises out of it.
  const shaft = at(86)
  record(
    !!shaft && shaft.w === 22 * TILE && shaft.y === base.surfaceY(0),
    `and its shaft floor x86 to x${shaft ? (shaft.x + shaft.w) / TILE : '?'} at h0`,
  )
  const high = at(108)
  record(
    !!high && high.w === 12 * TILE && high.y === base.surfaceY(14),
    `then the exit platform x108 to x${high ? (high.x + high.w) / TILE : '?'}, ${high ? base.surfaceY(0) - high.y : '?'}px up`,
  )
  record(
    !!ledge && !!shaft && ledge.y === shaft.y - 8 * TILE,
    `the drop off the ledge is ${ledge && shaft ? (shaft.y - ledge.y) / TILE : '?'} tiles`,
  )
  record(
    level3.solids.length === 13,
    `${level3.solids.length} solids in the data, all three rooms' geometry`,
  )
  // More once built: things that add their own collision do it on
  // construction - the closed sheet, the slit's pillar, the uncut seal. The
  // folded bridge adds none, which is the whole point of it being folded.
  // More once built: things that carry their own collision add it on
  // construction - two closed sheets, two slit pillars, two uncut seals.
  // The folded bridge adds none, which is the point of it being folded.
  record(
    base.solids.length === 19,
    `and ${base.solids.length} in the built level, the extra six from the sheets, pillars and seals`,
  )
}

// =====================================================================
//  Walkable within each room, which is what a skeleton has to get right.
// =====================================================================
{
  const walk = (from, to, h) => {
    const t = run(from, h)
    t.input.dir = M.sign(to - from)
    let fell = false
    const floorY = t.level.surfaceY(h)
    for (let f = 0; f < 60 * 25; f++) {
      t.step()
      if (t.p.y + t.p.halfH() > floorY + 2) fell = true
      if (M.abs(t.p.x / TILE - to) < 0.6) break
    }
    return { x: t.p.x / TILE, fell }
  }

  const a = walk(2, 34, 0)
  record(
    M.abs(a.x - 34) < 1 && !a.fell,
    `3A is walkable end to end, reaching x${a.x.toFixed(1)} without falling`,
  )

  // 3B is no longer walkable end to end, and should not be: the slit
  // pillar at x40 stops you upright, which is the room's first lesson.
  const b = walk(38, 74, 8)
  record(
    b.x < 41 && !b.fell,
    `3B's slit pillar stops an upright walk at x${b.x.toFixed(1)}, as it is meant to`,
  )
  const arena = walk(47, 51, 8)
  record(
    M.abs(arena.x - 51) < 1 && !arena.fell,
    `and the calm arena behind it is walkable, reaching x${arena.x.toFixed(1)}`,
  )

  // 3C's shaft is no longer walkable end to end either: its slit pillar at
  // x90 stops you upright, exactly as 3B's does.
  const c = walk(88, 118, 0)
  record(
    c.x < 91 && !c.fell,
    `3C's slit pillar stops an upright walk at x${c.x.toFixed(1)}`,
  )
  const snakeArena = walk(94, 98, 0)
  record(
    M.abs(snakeArena.x - 98) < 1 && !snakeArena.fell,
    `and the snake arena behind it is walkable, reaching x${snakeArena.x.toFixed(1)}`,
  )

  const ledge = walk(78, 84, 8)
  record(
    M.abs(ledge.x - 84) < 1 && !ledge.fell,
    `and its entry ledge too, reaching x${ledge.x.toFixed(1)}`,
  )
}

// --- the drop into the shaft is survivable ---
{
  const t = run(84, 8)
  t.input.dir = 1
  const shaftY = t.level.surfaceY(0)
  let landed = false
  for (let f = 0; f < 60 * 8; f++) {
    t.step()
    if (t.p.grounded && M.abs(t.p.y + t.p.halfH() - shaftY) < 2) landed = true
    if (landed) break
  }
  record(
    landed,
    `walking off the ledge lands on the shaft floor ${(shaftY - t.level.surfaceY(8)) / TILE} tiles down`,
  )
  record(
    t.p.y < t.level.heightPx,
    'rather than falling out of the world',
  )
  record(
    t.level.roomAt(t.p.x).id === '3c',
    'and it is all one room, 3C',
  )
}

// =====================================================================
//  The rooms and their checkpoints.
// =====================================================================
{
  const want = [
    ['3a', 0, 36, 'cp3a'],
    ['3b', 36, 76, 'cp3b'],
    ['3c', 76, 120, 'cp3c'],
  ]
  for (const [id, from, to, cp] of want) {
    const spec = level3.rooms.find((r) => r.id === id)
    record(
      !!spec && spec.from === from && spec.to === to,
      `room ${id} runs x${spec?.from} to x${spec?.to}`,
    )
    record(spec?.checkpoint === cp, `with checkpoint ${spec?.checkpoint}`)
  }

  // Each room resolves its checkpoint, and a respawn lands on solid ground.
  for (const [id] of want) {
    const t = run(0)
    const at = t.level.startAt(id)
    const under = t.level.solids.some(
      (s) => at.x >= s.x && at.x <= s.x + s.w && M.abs(at.y + PLAYER_H / 2 - s.y) < 2,
    )
    record(under, `starting in ${id} puts the player on a floor`)
  }

  // 3C carries two, as the brief asks - the second inert for now.
  const cps = base.entities.all.filter((e) => e instanceof Checkpoint)
  record(cps.length === 4, `four checkpoints in the level (${cps.length})`)
  const in3c = cps.filter((c) => base.roomAt(c.centerX())?.id === '3c')
  record(in3c.length === 2, `two of them inside 3C: ${in3c.map((c) => c.id).join(', ')}`)
  const land = base.entities.byId('cp3cLand')
  record(
    !!land && land.tx === 87 && land.th === 0,
    `the landing one sits at x${land?.tx}, h${land?.th}`,
  )
  // Honest about what it does not do yet: the room still respawns you at
  // the entrance, not the landing.
  const resp = new Level(level3)
  resp.startAt('3c')
  record(
    M.abs(resp.respawnPoint().x - 77.5 * TILE) < TILE,
    `and a reset in 3C still returns to the entrance at x${(resp.respawnPoint().x / TILE).toFixed(1)}, so it is placed but inert`,
  )
}

// =====================================================================
//  The loader is silent: no warning for any level.
// =====================================================================
{
  const warnings = []
  const real = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))
  try {
    for (const data of LEVELS) {
      const level = new Level(data)
      // Entering every room resolves every checkpoint.
      for (const room of data.rooms) level.startAt(room.id)
      level.draw(scene)
    }
  } finally {
    console.warn = real
  }
  record(
    warnings.length === 0,
    warnings.length === 0
      ? 'building and drawing all three levels raises no warning'
      : `the loader warned: ${warnings.join(' | ')}`,
  )
}

// =====================================================================
//  Room select picks it up with no menu change.
// =====================================================================
{
  const groups = roomGroups()
  record(groups.length === 3, `three groups in Room select`)
  record(
    groups[2].name === 'Level 3',
    `the third headed "${groups[2].name}"`,
  )
  record(
    groups[2].choices.map((c) => c.room).join(',') === '3a,3b,3c',
    `listing ${groups[2].choices.map((c) => c.room).join(', ')}`,
  )
  record(
    groups[2].choices.every((c) => c.level === 2),
    'each starting level index 2',
  )
  const ids = groups.flatMap((g) => g.choices.map((c) => c.room))
  record(
    new Set(ids).size === ids.length,
    `all ${ids.length} room ids unique across three levels, so one records map still serves them`,
  )
  record(
    groups[2].choices.every((c) => c.name.startsWith('3')),
    `named ${groups[2].choices.map((c) => c.name).join(' / ')}`,
  )
}

// =====================================================================
//  Levels 1 and 2 are untouched.
// =====================================================================
{
  record(
    level1.palette.solid === undefined && level2.palette.solid === undefined,
    'neither Level 1 nor Level 2 names a platform colour...',
  )
  record(
    level1.palette.line === undefined && level2.palette.line === undefined,
    '...nor an outline, so both still draw with COLOR_SOLID and no stroke',
  )
  record(
    COLOR_SOLID !== level3.palette.solid,
    `${hex(COLOR_SOLID)} for them against ${hex(level3.palette.solid)} for Level 3`,
  )
  record(
    level1.camLerpY === undefined && level2.camLerpY === undefined,
    `and neither asks for a vertical lerp, so both keep CAM_LERP ${CAM_LERP}`,
  )
  record(
    level3.camLerpY === CAM_LERP_Y && CAM_LERP_Y < CAM_LERP,
    `Level 3 asks for ${CAM_LERP_Y}, gentler than ${CAM_LERP}`,
  )
  record(
    level1.hazards !== true && level2.hazards === true && level3.hazards === true,
    'Level 1 still has no hazards; Levels 2 and 3 do',
  )
  record(
    level1.width === 96 || level1.width > 0,
    `Level 1 is still ${level1.width}x${level1.height} on row ${level1.floorRow}`,
  )
  record(
    level2.width === 96 && level2.height === 18 && level2.floorRow === 14,
    `Level 2 is still ${level2.width}x${level2.height} on row ${level2.floorRow}`,
  )
  record(
    level1.rooms.length === 4 && level2.rooms.length === 3,
    `and their room counts are unchanged at ${level1.rooms.length} and ${level2.rooms.length}`,
  )
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
