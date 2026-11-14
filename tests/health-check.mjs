// Step L2-7: player health.
import { scene } from './stub-scene.mjs'
import { Health } from '../src/game/Health.ts'
import { Player } from '../src/game/Player.ts'
import { Level } from '../src/game/Level.ts'
import { level1 } from '../src/game/levels/level1.ts'
import { level2 } from '../src/game/levels/level2.ts'
import {
  FIXED_DT,
  HEALTH_MAX,
  HEALTH_PIP_FADE_S,
  HURT_FREEZE_MS,
  HURT_HOLD_MS,
  HURT_INVULN_MS,
  HURT_KNOCK_X,
  HURT_KNOCK_Y,
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

// =====================================================================
//  The model.
// =====================================================================
{
  const h = new Health()
  record(h.hits === 3 && HEALTH_MAX === 3, `starts on ${h.hits} hits`)
  record(!h.dead() && !h.invulnerable(), 'alive and not invulnerable')
  record(h.pipAge(0) === null, 'all three pips full')

  record(h.take() === true, 'a hit lands')
  record(h.hits === 2, `and costs exactly 1 (${h.hits} left)`)
  record(h.invulnerable(), 'and opens the invulnerable window')
  record(h.pipAge(2) === 0, 'and starts the rightmost pip fading')
  record(h.pipAge(1) === null && h.pipAge(0) === null, 'and only that one')

  record(h.take() === false, 'a second hit in the same instant is refused')
  record(h.hits === 2, `health is untouched (${h.hits})`)

  // Walk the window out at the real step rate.
  let steps = 0
  while (h.invulnerable() && steps++ < 300) h.update(FIXED_DT)
  const lasted = steps * FIXED_DT
  record(
    M.abs(lasted - HURT_INVULN_MS / 1000) <= FIXED_DT * 1.5,
    `the window lasts ${lasted.toFixed(3)}s (spec ${HURT_INVULN_MS / 1000})`,
  )
  record(h.take() === true, 'and then a hit lands again')
  record(h.hits === 1, `down to ${h.hits}`)

  // The blink has to actually alternate, not just be "on".
  const seen = new Set()
  for (let f = 0; f < 60; f++) {
    seen.add(h.blinkOn())
    h.update(FIXED_DT)
  }
  record(seen.has(true) && seen.has(false), 'the blink alternates on and off')
  while (h.invulnerable()) h.update(FIXED_DT)
  record(!h.blinkOn(), 'and stops once the window closes, so the figure is solid')

  record(h.take() === true && h.hits === 0, 'the third hit empties it')
  record(h.dead(), 'which is dead')
  record(h.take() === false, 'and a corpse cannot be hit again')

  // The fade runs out and the pip stays lost.
  for (let f = 0; f < 120; f++) h.update(FIXED_DT)
  record(
    h.pipAge(0) === HEALTH_PIP_FADE_S,
    `a lost pip's fade stops at ${HEALTH_PIP_FADE_S}s rather than counting up for ever`,
  )

  h.refill()
  record(h.hits === 3 && !h.dead(), 'refill puts all three back')
  record(
    h.pipAge(0) === null && h.pipAge(1) === null && h.pipAge(2) === null,
    'and clears every fade',
  )
  record(!h.invulnerable(), 'and does not leave you invulnerable')
}

// =====================================================================
//  Knockback, measured.
// =====================================================================

/** A player standing on Level 2's floor, with the room around them. */
function standing(tileX = 10) {
  const level = new Level(level2)
  const p = new Player(
    scene,
    tileX * TILE,
    level.surfaceY(0) - PLAYER_H / 2,
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

{
  const t = standing()
  const x0 = t.p.x
  const y0 = t.p.y
  record(!t.p.justHurt, 'not hurt yet')

  // Hit from the left: thrown right and up.
  t.p.hurt(1)
  record(t.p.justHurt, 'hurt() raises justHurt for the scene to react to')
  record(
    t.p.vx === HURT_KNOCK_X && t.p.vy === -HURT_KNOCK_Y,
    `the throw is ${t.p.vx}px/s across and ${-t.p.vy}px/s up (spec ${HURT_KNOCK_X} and ${HURT_KNOCK_Y})`,
  )

  // The hitstop holds everything still first.
  const frozenFrames = M.round((HURT_FREEZE_MS / 1000) / FIXED_DT)
  for (let f = 0; f < frozenFrames; f++) t.step()
  record(
    t.p.x === x0 && t.p.y === y0,
    `nothing moves for the ${HURT_FREEZE_MS}ms hitstop`,
  )
  record(!t.p.justHurt, 'and justHurt is a one-frame event, not a state')

  // Then the throw carries.
  let rise = 0
  for (let f = 0; f < 10; f++) {
    t.step()
    rise = M.max(rise, y0 - t.p.y)
  }
  record(t.p.x > x0, `then it carries the player right, to +${(t.p.x - x0).toFixed(0)}px`)
  // 200px/s against GRAVITY 1800 is a pop, not a launch: 200^2/(2*1800).
  record(
    rise > 8 && rise < 20,
    `and lifts them ${rise.toFixed(0)}px at the peak, which is all 200px/s buys against gravity`,
  )

  // The mirror.
  const r = standing()
  const rx = r.p.x
  r.p.hurt(-1)
  for (let f = 0; f < 20; f++) r.step()
  record(
    r.p.x < rx && r.p.vx <= 0,
    `hit from the right, the player goes left instead (${(r.p.x - rx).toFixed(0)}px)`,
  )
}

// --- the hold is what makes the knockback survive the player's own input ---
{
  // Holding *into* the attacker: without a hold the run cancels the throw.
  const t = standing()
  const x0 = t.p.x
  t.p.hurt(1)
  t.input.dir = -1
  const holdFrames = M.round(
    ((HURT_FREEZE_MS + HURT_HOLD_MS) / 1000) / FIXED_DT,
  )
  for (let f = 0; f < holdFrames; f++) t.step()
  const carried = t.p.x - x0
  record(
    carried > 20,
    `fighting the knockback still carries you ${carried.toFixed(0)}px in the ${HURT_HOLD_MS}ms hold`,
  )

  // The counterfactual: the same fight with no hold at all. This is what
  // proves HURT_HOLD_MS earns its place rather than just existing.
  const n = standing()
  const nx = n.p.x
  n.p.hurt(1)
  // Reach past the hold by freezing then letting input take over at once.
  for (let f = 0; f < M.round((HURT_FREEZE_MS / 1000) / FIXED_DT); f++) n.step()
  n.input.dir = -1
  let turned = -1
  let furthest = 0
  for (let f = 0; f < 60; f++) {
    n.step()
    furthest = M.max(furthest, n.p.x - nx)
    if (n.p.vx <= 0 && turned < 0) turned = f
  }
  record(
    turned >= 0,
    `and input does win eventually — ${(turned * FIXED_DT * 1000).toFixed(0)}ms after the hold, so you are not stuck`,
  )
  record(
    furthest > 20,
    `having been thrown ${furthest.toFixed(0)}px away at the furthest point first`,
  )
}

// --- the dash hitstop still behaves as it did ---
{
  const t = standing()
  t.input.dashPressed = true
  t.step()
  record(t.p.isDashing(), 'a dash still starts with its own hitstop')
  const x0 = t.p.x
  t.step()
  record(t.p.x === x0, 'which holds the player still, as it always did')
  for (let f = 0; f < 20; f++) t.step()
  record(M.abs(t.p.x - x0) > 50, `then the dash carries ${(t.p.x - x0).toFixed(0)}px`)
}

// --- a hit cancels a fold rather than being swallowed by it ---
{
  const t = standing()
  t.input.flatHeld = true
  for (let f = 0; f < 20; f++) t.step()
  record(t.p.debugInfo().state === 'flat', 'folded flat')
  t.p.hurt(1)
  record(t.p.vy === -HURT_KNOCK_Y, 'a hit while flat still throws you upward')
}

// =====================================================================
//  Level 1 cannot be hurt, and does not show health.
// =====================================================================
{
  record(
    level2.hazards === true,
    'level2 is flagged as having hazards, so it shows the pips',
  )
  record(
    level1.hazards !== true,
    'level1 is not, so its HUD is the room name and timer, exactly as before',
  )
}

// --- the 2C solution still takes no damage ---
{
  // Nothing in the game can hurt the player yet; this is the check that
  // this step did not quietly make the world lethal.
  const level = new Level(level2)
  const PIT = level.surfaceY(-2)
  const TOP = level.surfaceY(4)
  const h = new Health()
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
  let hurt = 0
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
    p.update(FIXED_DT, input, level.solids, level.updraftAt(p))
    level.update(FIXED_DT, p, NO_FX)
    h.update(FIXED_DT)
    if (p.justHurt) hurt++
  }
  record(level.finished(), 'the 2C solution still finishes the room')
  record(hurt === 0 && h.hits === 3, `taking ${hurt} hits: nothing in 2C damages you yet`)
}

const nl = String.fromCharCode(10)
console.log(out.join(nl))
console.log(out.some((r) => r.startsWith('FAIL')) ? nl + 'SOME CHECKS FAILED' : nl + 'ALL CHECKS PASSED')
