import type * as Phaser from 'phaser'
import {
  COLOR_INK,
  GAME_WIDTH,
  MAX_DT_MS,
  RECORD_MAX_S,
  STEP_HZ,
  STEP_MS,
  TUNABLES,
  getTuning,
} from './constants.ts'

/**
 * The dev solution recorder: F2 records a room's input, F3 plays it back.
 *
 * Two things make this honest rather than approximate. The simulation runs at
 * a fixed rate (see FixedClock), and everything here is indexed by *step*
 * rather than by frame or by wall-clock time — so a dropped frame pauses a
 * replay instead of desyncing it.
 */

/**
 * What the game actually consumes, named by intent rather than by key. A
 * mouse slash and J record identically, and rebinding never invalidates a
 * recorded file.
 */
export type Action =
  | 'left'
  | 'right'
  | 'jump'
  | 'dash'
  | 'flat'
  | 'sword'
  | 'slash'
  | 'reset'

export const ACTIONS: Action[] = [
  'left',
  'right',
  'jump',
  'dash',
  'flat',
  'sword',
  'slash',
  'reset',
]

/** Which actions are down on one step. */
export type Held = Record<Action, boolean>

/** `[step, action, 1 down | 0 up]`. */
export type InputEvent = [number, Action, 0 | 1]

export type Solution = {
  /** Index into LEVELS, so a file cannot be replayed against the wrong level. */
  level: number
  room: string
  hz: number
  steps: number
  /**
   * The eleven live-tunable numbers as they were. A recording made at a
   * different JUMP_VELOCITY is not a solution, it is noise.
   */
  tuning: Record<string, number>
  /**
   * Whether the sword was drawn when the recording started. A room reset puts
   * that room's entities back, but the sword is picked up in 2A and drawn
   * with R, so it is a starting condition the room cannot restore — it can
   * only be checked.
   */
  swordOut?: boolean
  events: InputEvent[]
}

export function noneHeld(): Held {
  return {
    left: false,
    right: false,
    jump: false,
    dash: false,
    flat: false,
    sword: false,
    slash: false,
    reset: false,
  }
}

/**
 * The subset of `Input` that is recorded. `Input` satisfies this; a plain
 * object does too, which is what lets the tests drive it.
 *
 * Only four actions have a held state the game reads (direction, jump and
 * fold); dash, sword, slash and reset are consumed as edges only, so their
 * "held" is simply the step they fired on.
 */
export type Sampled = {
  dir: number
  jumpHeld: boolean
  flatHeld: boolean
  dashPressed: boolean
  swordPressed: boolean
  slashPressed: boolean
  resetPressed: boolean
}

/** Everything playback writes. `Input`'s fields, all public. */
export type Driven = Sampled & {
  jumpPressed: boolean
  jumpReleased: boolean
}

export function heldOf(input: Sampled): Held {
  return {
    left: input.dir < 0,
    right: input.dir > 0,
    jump: input.jumpHeld,
    flat: input.flatHeld,
    dash: input.dashPressed,
    sword: input.swordPressed,
    slash: input.slashPressed,
    reset: input.resetPressed,
  }
}

/** The eleven tunables as they are right now. */
export function tuningNow(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of TUNABLES) out[t.key] = getTuning(t.key)
  return out
}

/** Which of a solution's tunables no longer match the live ones. */
export function tuningDrift(sol: Solution): string[] {
  const now = tuningNow()
  const drift: string[] = []
  for (const key of Object.keys(sol.tuning)) {
    if (now[key] !== sol.tuning[key]) drift.push(key)
  }
  return drift
}

/**
 * Turns a frame delta into a whole number of fixed steps.
 *
 * Strictly: leftover time stays in the accumulator and is spent next frame,
 * so the simulation runs at exactly STEP_HZ however fast the display is. On a
 * 60Hz screen that is one step a frame; on a 144Hz screen most frames take no
 * step at all; after a stall the clamp throws the lost time away rather than
 * simulating minutes of it at once.
 *
 * The clamp also bounds this: at most one clamped frame plus one leftover
 * step, so two steps a frame, with no runaway to guard against.
 */
export class FixedClock {
  private acc = 0

  advance(deltaMs: number): number {
    this.acc += Math.min(deltaMs, MAX_DT_MS)
    let steps = 0
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS
      steps++
    }
    return steps
  }

  /** After a pause or a scene change, so held-over time is not spent. */
  reset(): void {
    this.acc = 0
  }
}

/** Accumulates the down and up events of a run, one sample per step. */
export class Recorder {
  readonly level: number
  readonly room: string

  private events: InputEvent[] = []
  private prev: Held = noneHeld()
  private count = 0

  constructor(level: number, room: string) {
    this.level = level
    this.room = room
  }

  /** Call once per step, with the input the step is about to run on. */
  sample(held: Held): void {
    for (const a of ACTIONS) {
      if (held[a] !== this.prev[a]) {
        this.events.push([this.count, a, held[a] ? 1 : 0])
      }
    }
    this.prev = { ...held }
    this.count++
  }

  get steps(): number {
    return this.count
  }

  get seconds(): number {
    return this.count / STEP_HZ
  }

  /** True once the recording has run long enough to stop itself. */
  get full(): boolean {
    return this.seconds >= RECORD_MAX_S
  }

  toSolution(): Solution {
    return {
      level: this.level,
      room: this.room,
      hz: STEP_HZ,
      steps: this.count,
      tuning: tuningNow(),
      events: this.events,
    }
  }
}

/**
 * Replays a solution's events into the live Input, deriving the edges exactly
 * the way Input does from held state — so the player cannot tell the
 * difference between this and a keyboard.
 */
export class Playback {
  readonly sol: Solution

  private held: Held = noneHeld()
  private prev: Held = noneHeld()
  private cursor = 0
  private step = 0

  constructor(sol: Solution) {
    this.sol = sol
  }

  get at(): number {
    return this.step
  }

  get done(): boolean {
    return this.step >= this.sol.steps && this.cursor >= this.sol.events.length
  }

  /** The held state of the next step, advancing the cursor past it. */
  next(): Held {
    this.prev = this.held
    const h = { ...this.held }
    const events = this.sol.events
    while (this.cursor < events.length && events[this.cursor][0] === this.step) {
      const e = events[this.cursor]
      h[e[1]] = e[2] === 1
      this.cursor++
    }
    this.held = h
    this.step++
    return h
  }

  /** Writes one step of the recording over whatever the keyboard said. */
  apply(input: Driven): void {
    const h = this.next()
    const p = this.prev
    input.dir = (h.right ? 1 : 0) - (h.left ? 1 : 0)
    input.jumpPressed = h.jump && !p.jump
    input.jumpReleased = !h.jump && p.jump
    input.jumpHeld = h.jump
    input.dashPressed = h.dash && !p.dash
    input.flatHeld = h.flat
    input.swordPressed = h.sword && !p.sword
    input.slashPressed = h.slash && !p.slash
    input.resetPressed = h.reset && !p.reset
  }
}

/**
 * Where the files live. The dev server writes and serves them; they are
 * fetched rather than imported on purpose, so writing one never puts a JSON
 * file in the module graph and never triggers a reload mid-session.
 */
const ENDPOINT = '/__solutions'

export async function saveSolution(sol: Solution): Promise<string> {
  const res = await fetch(`${ENDPOINT}/${sol.room}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sol),
  })
  if (!res.ok) throw new Error(`save failed: ${res.status}`)
  const body = (await res.json()) as { path?: string }
  return body.path ?? sol.room
}

export async function loadSolution(
  level: number,
  room: string,
): Promise<Solution> {
  const res = await fetch(`${ENDPOINT}/${room}`)
  if (!res.ok) throw new Error(res.status === 404 ? 'no recording' : 'load failed')
  // A built copy has no endpoint, so the request falls through to index.html
  // with a perfectly good 200. Say what is actually wrong.
  if (!(res.headers.get('content-type') ?? '').includes('json')) {
    throw new Error('no dev server')
  }
  const sol = (await res.json()) as Solution
  if (sol.room !== room) throw new Error(`file is for room ${sol.room}`)
  if (sol.level !== level) throw new Error(`file is for level ${sol.level + 1}`)
  if (sol.hz !== STEP_HZ) throw new Error(`file is ${sol.hz}Hz`)
  return sol
}

/**
 * The fallback when there is no dev server, as in a production build: hand
 * the file to the browser and let it be dropped into the folder by hand.
 */
export function downloadSolution(sol: Solution): void {
  const blob = new Blob([JSON.stringify(sol, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sol.room}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * One line at the top of the screen while a tool is running. Its own text
 * object rather than part of the Hud: the spec's HUD is the room name and the
 * timer "and nothing else", and this is not part of the game.
 */
export class ToolBadge {
  private text: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.text = scene.add.text(GAME_WIDTH / 2, 6, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#' + COLOR_INK.toString(16).padStart(6, '0'),
      backgroundColor: 'rgba(255, 255, 255, 0.78)',
      padding: { x: 6, y: 3 },
    })
    this.text.setOrigin(0.5, 0).setDepth(1002).setScrollFactor(0)
    this.text.setVisible(false)
  }

  show(message: string): void {
    if (this.text.text !== message) this.text.setText(message)
    this.text.setVisible(true)
  }

  clear(): void {
    this.text.setVisible(false)
  }
}
