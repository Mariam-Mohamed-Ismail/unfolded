// Step L2-4: room 2B. The slit passes you only flat, the seal only yields
// to the sword, and the room can be finished.
import { scene } from './stub-scene.mjs'
import { Player } from '../src/game/Player.ts'
import { Level } from '../src/game/Level.ts'
import { Sword } from '../src/game/Sword.ts'
import { Seal } from '../src/game/entities/Seal.ts'
import { Slit } from '../src/game/entities/Slit.ts'
import { level1 } from '../src/game/levels/level1.ts'
import { level2 } from '../src/game/levels/level2.ts'
import {
  BAT_H,
  FLAT_MAX_SPEED,
  PARTICLES_SEAL,
  PLAYER_FLAT_H,
  PLAYER_H,
  SEAL_REACH,
  SEAL_SHAKE,
  SEAL_SHAKE_MS,
  SLASH_HITSTOP_MS,
  SLIT_H,
  TILE,
} from '../src/game/constants.ts'

const M = globalThis.Math
const DT = 1 / 60
const out = []
const record = (ok, msg) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

function recorder() {
  const log = { dust: [], shakes: [], sounds: [], labels: [] }
  return {
    log,
    fx: {
      dust: (x, y, count, color) => log.dust.push({ x, y, count, color }),
      shake: (px, ms) => log.shakes.push({ px, ms }),
      zoom: () => {},
      sound: (n) => log.sounds.push(n),
      label: (id, x, y, text, size, alpha) =>
        log.labels.push({ id, x, y, text, size, alpha }),
      hum: () => {},
    },
  }
}

/** Level 2 with the player at `tileX`, and the blade out unless told not. */
function room(tileX, armed = true) {
  const level = new Level(level2)
  const r = recorder()
  const p = new Player(
    scene,
    tileX * TILE,
    level.surfaceY(0) - PLAYER_H / 2,
    level.solids,
  )
  const sword = new Sword()
  const input = {
    dir: 0, jumpPressed: false, jumpReleased: false, jumpHeld: false,
    dashPressed: false, flatHeld: false,
  }
  let slash = false
  // Level 2's sword is a temporary pickup at the spawn; these tests start
  // the player mid-room, so the blade's presence is faked at the one place
  // anything asks about it.
  level.swordOut = () => armed
  const step = () => {
    p.update(DT, input, level.solids, level.updraftAt(p), sword.speedScale())
    level.update(DT, p, r.fx)
    sword.update(DT, p, slash, level, r.fx)
    input.jumpPressed = false
    input.jumpReleased = false
    input.dashPressed = false
    slash = false
  }
  step()
  return {
    level, p, input, sword, step, log: r.log,
    swing: () => { slash = true },
  }
}

const base = new Level(level2)
const FLOOR = base.surfaceY(0)
const foot = (p) => p.y + p.halfH()

// =====================================================================
//  The room as data.
// =====================================================================
{
  const slit = base.entities.byId('slit2b')
  const seal = base.entities.byId('seal1')
  record(slit instanceof Slit, 'the slit pillar is in 2B')
  record(
    slit.tx === 36 && slit.w === 6 * TILE,
    `6 tiles long from x${slit.tx} (spec x 36-42)`,
  )
  record(
    slit.clearance() === SLIT_H && SLIT_H === 14,
    `with ${slit.clearance()}px of clearance, which passes a ${PLAYER_FLAT_H}px flat box and stops a ${PLAYER_H}px standing one`,
  )

  record(seal instanceof Seal, 'the seal is in 2B')
  record(seal.tx === 50, `at x${seal.tx}`)
  const box = seal.hurtBox()
  record(
    box && M.abs(box.bottom - FLOOR) < 1 && box.top === base.surfaceY(8),
    `reaching from the floor up to h=8 (${(box.bottom - box.top).toFixed(0)}px)`,
  )
  record(box.right - box.left === TILE, 'one tile wide')

  const ceiling = base.solids.find((s) => s.x === 50 * TILE && s.y === base.surfaceY(10))
  record(
    !!ceiling && M.abs(ceiling.y + ceiling.h - base.surfaceY(8)) < 1,
    'with a ceiling block above it, so there is nothing to jump onto',
  )
  record(base.roomAt(seal.centerX()).id === '2b', 'all of it inside room 2B')
}

// --- the bat is on the spec's anchor, hanging from its strip ---
//
// These three checks used to assert this space was EMPTY, which is what
// L2-4 left it. L2-8a filled it, so they now assert what is there instead.
{
  const ax = 45.5 * TILE
  const ay = base.surfaceY(7.5)
  const bat = base.entities.byId('bat1')
  record(!!bat, 'the bat is built')
  const box = bat.hurtBox()
  record(
    !!box && M.abs((box.left + box.right) / 2 - ax) < TILE,
    `hanging on the spec's anchor, x${((box.left + box.right) / 2 / TILE).toFixed(1)}`,
  )
  record(
    !!box && M.abs((box.top + box.bottom) / 2 - ay) <= BAT_H,
    `at h7.5, within its own height of the strip`,
  )

  // The strip it hangs from is a thin slab, not a floor to stand on.
  const strip = base.solids.find((s) => s.x === 44 * TILE)
  record(!!strip, 'the ceiling strip at x44-47 exists')
  record(
    !!strip && strip.h < TILE / 2,
    `and is ${strip ? strip.h.toFixed(0) : '?'}px thin, so it roofs the arena rather than flooring it`,
  )

  // The floor of the arena is still open: the strip is up at h8, nothing
  // else roofs the space the fight happens in.
  let roofed = 0
  for (let x = 42.5; x < 50; x += 0.5) {
    const px = x * TILE
    if (base.solids.some((s) => px >= s.x && px < s.x + s.w && s.y < base.surfaceY(2) && s.y > base.surfaceY(7))) {
      roofed++
    }
  }
  record(roofed === 0, `and the arena from x42 to x50 is clear below it (${roofed} roofed)`)
}

// =====================================================================
//  The slit: flat only.
// =====================================================================
{
  const ways = []
  let worst = 0
  for (const plan of ['run', 'dash', 'jump']) {
    const t = room(33)
    t.input.dir = 1
    let dashed = false
    for (let f = 0; f < 400; f++) {
      if (plan === 'dash' && !dashed && f > 30) { t.input.dashPressed = true; dashed = true }
      if (plan === 'jump' && t.p.grounded && f > 30 && f % 40 === 0) {
        t.input.jumpPressed = true
        t.input.jumpHeld = true
      }
      t.step()
    }
    worst = M.max(worst, t.p.x)
    ways.push(`${plan} stopped at x${(t.p.x / TILE).toFixed(2)}`)
  }
  record(
    worst < 36 * TILE,
    `standing, nothing gets through the slit: ${ways.join(', ')}`,
  )
}
{
  const t = room(33)
  t.input.dir = 1
  t.input.flatHeld = true
  let enter = -1
  let exit = -1
  for (let f = 0; f < 600; f++) {
    t.step()
    if (enter < 0 && t.p.x > 36 * TILE) enter = f
    if (enter >= 0 && exit < 0 && t.p.x > 42 * TILE) { exit = f; break }
  }
  record(enter >= 0 && exit >= 0, `folded, the player crawls under it to x${(t.p.x / TILE).toFixed(2)}`)
  const ms = ((exit - enter) / 60) * 1000
  record(
    ms > 700 && ms < 1400,
    `the 6-tile crawl takes ${ms.toFixed(0)}ms (192px at ${FLAT_MAX_SPEED}px/s is about a second)`,
  )
}

// =====================================================================
//  The seal blocks the way, and only the sword opens it.
// =====================================================================
{
  const ways = []
  let worst = 0
  let overIt = null
  for (const plan of ['run', 'dash', 'jump', 'jumpDash']) {
    const t = room(45)
    t.input.dir = 1
    let dashed = false
    let jumped = false
    for (let f = 0; f < 400; f++) {
      if ((plan === 'dash' || plan === 'jumpDash') && !dashed && f > 60 && !t.p.grounded) {
        t.input.dashPressed = true
        dashed = true
      }
      if ((plan === 'jump' || plan === 'jumpDash') && t.p.grounded && f > 40 && f % 40 === 0) {
        t.input.jumpPressed = true
        t.input.jumpHeld = true
        jumped = true
      }
      t.step()
      if (t.p.x > 51 * TILE) overIt = plan
    }
    worst = M.max(worst, t.p.x)
    ways.push(`${plan} at x${(t.p.x / TILE).toFixed(2)}`)
    void jumped
  }
  record(
    overIt === null && worst < 50 * TILE,
    `nothing without the sword gets past the seal: ${ways.join(', ')}`,
  )

  const seal = room(45).level.entities.byId('seal1')
  record(!seal.isCut(), 'and it is still intact')
}

// --- one slash cuts it ---
{
  const t = room(48)
  const seal = t.level.entities.byId('seal1')
  // Walk up to it, then swing.
  t.input.dir = 1
  for (let f = 0; f < 60; f++) t.step()
  t.input.dir = 0
  record(!seal.isCut(), `standing at x${(t.p.x / TILE).toFixed(2)}, the seal is intact`)
  const solidsBefore = t.level.solids.length
  t.log.dust.length = 0
  t.log.shakes.length = 0
  t.log.sounds.length = 0

  t.swing()
  let frames = 0
  while (!seal.isCut() && frames++ < 60) t.step()
  record(seal.isCut(), `one slash cuts it (frame ${frames})`)
  record(
    t.level.solids.length === solidsBefore - 1,
    'and its collision is gone the same frame',
  )
  record(seal.hurtBox() === null, 'so the sword cannot find it again')

  // The feedback.
  t.step()
  record(
    t.log.shakes.some((s) => s.px === SEAL_SHAKE && s.ms === SEAL_SHAKE_MS),
    `a ${SEAL_SHAKE}px shake for ${SEAL_SHAKE_MS}ms`,
  )
  record(
    t.log.dust.some((d) => d.count === PARTICLES_SEAL),
    `${PARTICLES_SEAL} shards where it tore`,
  )
  record(t.log.sounds.includes('tear'), 'and the tearing sound')

  // Hit-stop comes from the sword, as it does for any hit.
  const h = room(48)
  const s2 = h.level.entities.byId('seal1')
  h.input.dir = 1
  for (let f = 0; f < 60; f++) h.step()
  h.input.dir = 0
  h.swing()
  while (!s2.isCut()) h.step()
  record(h.p.frozen(), `the cut freezes the player for its ${SLASH_HITSTOP_MS}ms hit-stop`)
}

// --- a cut seal takes no knockback, because it did not survive ---
{
  const t = room(48)
  const seal = t.level.entities.byId('seal1')
  record(seal.hurt(1) === false, 'hurt() reports it did not survive')
  record(seal.isCut(), 'because one hit is all it takes')
  t.level.resetRoom()
  record(!seal.isCut() && seal.hurtBox() !== null, 'and a room reset puts it back')
}

// =====================================================================
//  The prompt changes with the blade.
// =====================================================================
{
  const armed = room(48)
  const seal = armed.level.entities.byId('seal1')
  armed.log.labels.length = 0
  armed.step()
  const words = armed.log.labels.filter((l) => l.id === 'seal1').map((l) => l.text)
  record(words.includes('cut it'), `with the blade out and close by it reads "${words[0]}"`)
  record(seal.isGlowing(), 'and the seal glows')

  const bare = room(48, false)
  const bareSeal = bare.level.entities.byId('seal1')
  bare.log.labels.length = 0
  bare.step()
  const bareWords = bare.log.labels.filter((l) => l.id === 'seal1').map((l) => l.text)
  record(
    bareWords.includes('draw the sword'),
    `with no blade it reads "${bareWords[0]}" instead`,
  )
  record(!bareSeal.isGlowing(), 'and it does not glow')

  // Out of reach, nothing at all.
  const far = room(44)
  far.log.labels.length = 0
  far.step()
  const dist = (50.5 * TILE - far.p.x) / TILE
  record(
    far.log.labels.filter((l) => l.id === 'seal1').length === 0,
    `${dist.toFixed(1)} tiles away, past the ${SEAL_REACH}-tile reach, it says nothing`,
  )
}

// =====================================================================
//  The two zone tags sequence.
// =====================================================================
{
  const t = room(33)
  const draw = t.level.entities.byId('tipDraw')
  const slash = t.level.entities.byId('tipSlash')
  for (let f = 0; f < 40; f++) t.step()
  record(draw.alpha() > 0, `"draw the sword" is up (alpha ${draw.alpha().toFixed(2)})`)
  record(slash.alpha() === 0, 'and "click or J to slash" is gated behind it')

  // Press R: the first clears, which opens the gate for the second.
  t.level.pressed({ sword: true, slash: false })
  t.step()
  record(draw.done(), 'pressing R clears the first')
  for (let f = 0; f < 40; f++) t.step()
  record(slash.alpha() > 0, `and the second appears (alpha ${slash.alpha().toFixed(2)})`)

  t.level.pressed({ sword: false, slash: true })
  t.step()
  record(slash.done(), 'slashing clears that one too')
}
{
  // Never both at once, anywhere in their shared zone.
  const t = room(31)
  let both = 0
  t.input.dir = 1
  const draw = t.level.entities.byId('tipDraw')
  const slash = t.level.entities.byId('tipSlash')
  for (let f = 0; f < 200; f++) {
    t.step()
    if (draw.alpha() > 0.01 && slash.alpha() > 0.01) both++
  }
  record(
    both === 0,
    'they share a zone but are never both visible, because the gate sequences them',
  )
}

// =====================================================================
//  The room can be finished.
// =====================================================================
{
  const t = room(33)
  const seal = t.level.entities.byId('seal1')

  // Slide through the slit.
  t.input.dir = 1
  t.input.flatHeld = true
  for (let f = 0; f < 600; f++) {
    t.step()
    if (t.p.x > 43 * TILE) break
  }
  record(t.p.x > 42 * TILE, `crawled through to x${(t.p.x / TILE).toFixed(1)}`)

  // Unfold and cross the arena.
  t.input.flatHeld = false
  for (let f = 0; f < 200; f++) {
    t.step()
    if (!t.p.flat && t.p.x > 48.5 * TILE) break
  }
  record(!t.p.flat, 'stood back up in the arena')

  // Cut the seal.
  t.input.dir = 0
  t.swing()
  let frames = 0
  while (!seal.isCut() && frames++ < 90) t.step()
  record(seal.isCut(), 'cut the seal')

  // Walk on to the room's exit.
  t.input.dir = 1
  for (let f = 0; f < 400; f++) t.step()
  record(
    t.p.x > 60 * TILE,
    `and walked on to x${(t.p.x / TILE).toFixed(1)}, past the seal to the room's exit`,
  )
}

// =====================================================================
//  Level 1 is untouched.
// =====================================================================
{
  const l1 = new Level(level1)
  record(
    l1.entities.byType('Seal').length === 0,
    'Level 1 has no seal',
  )
  const slits = l1.entities.all.filter((e) => e instanceof Slit)
  record(slits.length === 2, `and still its own two slit pillars`)
  record(
    slits.every((s) => s.clearance() === SLIT_H),
    'with the same clearance they always had',
  )
  record(
    l1.entities.byId('tipFlat') !== undefined,
    'and its prompt tags are all still there',
  )
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
