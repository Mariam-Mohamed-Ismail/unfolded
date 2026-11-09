// Every tuning number in the game lives here. Nothing else holds a literal.

// --- Step 1: screen and sizes ---
export const GAME_WIDTH = 960
export const GAME_HEIGHT = 540
export const TILE = 32

export const PLAYER_W = 20
export const PLAYER_H = 30

// --- Colours (all art is drawn in code, no image files) ---
export const COLOR_BG = 0xb9dfc1
export const COLOR_SOLID = 0x1f8a4c
export const COLOR_PLAYER = 0x5fae7e

// --- Step 2: running (not used yet) ---
export let MAX_SPEED = 260
export let ACCEL = 2200
export let DECEL = 2600
export const AIR_ACCEL = 1600
export const AIR_DECEL = 1200

// --- Step 3: jumping (not used yet) ---
export let JUMP_VELOCITY = -560
export let GRAVITY = 1800
export let FALL_GRAVITY_MULT = 1.6
export const MAX_FALL_SPEED = 900
export let JUMP_CUT = 0.45
export const COYOTE_MS = 90
export const JUMP_BUFFER_MS = 110

// --- Step 5: flat form (numbers from Docs/level 1 spec) ---
// Folding keeps the feet planted: the box shrinks downward from the head.
export const PLAYER_FLAT_W = 28
export const PLAYER_FLAT_H = 10

// The fold is a real transition, not a swap. The hitbox interpolates over
// this long, so you have to finish folding before you fit through a slit.
export const FOLD_TIME_MS = 120

// A slit passes the flat form and stops the standing one, so it lives
// between PLAYER_FLAT_H and PLAYER_H.
export const SLIT_H = 14

// Folding out of a run keeps the momentum. Entry speed is capped here,
// then friction bleeds it down to the flat cruising speed.
export const FLAT_ENTRY_SPEED = 320
export const FLAT_FRICTION = 700
export const FLAT_MAX_SPEED = 200

// --- Step 4: dash (numbers from Docs/level 1 spec) ---
export let DASH_SPEED = 560
export const DASH_TIME = 150
export const DASH_COOLDOWN = 350
export const DASH_FREEZE = 40

// After the dash proper, speed snaps to this fraction of DASH_SPEED and is
// held there, ignoring input, for DASH_TAIL_MS. 0.4 x 560 = 224, which is
// below MAX_SPEED, so the tail settles out of the dash rather than boosting.
export const DASH_TAIL_MULT = 0.4
export const DASH_TAIL_MS = 80

// --- State machine ---
// |vy| under this counts as the apex of a jump. Observational for now: the
// spec also halves gravity inside the band, which would change jump feel.
export const APEX_BAND = 60

// Below this speed a grounded player reads as idle rather than running.
export const IDLE_SPEED = 8

// How long the land state holds after touchdown, matching the squash.
export const LAND_STATE_MS = 90

// --- Step 7: feel ---
export const COLOR_PLAYER_LINE = 0x1f8a4c

// Squash and stretch scale the drawing only, never the hitbox.
export const LAND_SQUASH_X = 1.3
export const LAND_SQUASH_Y = 0.7
export const JUMP_STRETCH_X = 0.8
export const JUMP_STRETCH_Y = 1.25
export const DASH_STRETCH_X = 1.45
export const DASH_STRETCH_Y = 0.7
export const SQUASH_RECOVER = 120

// Shake is given in pixels here and converted where Phaser wants a
// fraction of the screen width.
export const SHAKE_LAND = 4
export const SHAKE_LAND_MS = 120
export const SHAKE_DASH = 2
export const SHAKE_DASH_MS = 80

// Below this landing speed the touchdown is soft and does not shake.
// A full jump lands at about 710, a small hop at about 250.
export const LAND_HARD_SPEED = 500

export const PARTICLES_LAND = 8
export const PARTICLES_DASH = 10
export const PARTICLES_FOLD = 4
export const PARTICLE_SPEED = 170
export const PARTICLE_LIFE = 450
export const PARTICLE_SIZE = 4
export const PARTICLE_GRAVITY = 900

// --- Step 8: sound ---
// Everything is synthesised: a band of filtered noise per event, which
// reads as paper rather than as a console. Frequencies in Hz, lengths in ms.
export const SFX_VOLUME = 0.5

// Each burst opens over this long instead of starting at full level. A noise
// burst with no attack begins with a click that is louder than the burst.
export const SFX_ATTACK_MS = 3

// A bandpass on white noise throws most of the energy away, by roughly
// sqrt(bandwidth), so every sound needs makeup gain to land at a normal
// level. These were solved for about -22 dBFS RMS with peaks under -3.
// Re-solve them if you change a frequency, a length or a Q.

export const SFX_JUMP_HZ = 1100
export const SFX_JUMP_TONE_HZ = 320
export const SFX_JUMP_MS = 90
export const SFX_JUMP_Q = 1.2
export const SFX_JUMP_GAIN = 2.73
export const SFX_JUMP_TONE_GAIN = 0.25

export const SFX_LAND_HZ = 900
export const SFX_LAND_MS = 70
export const SFX_LAND_Q = 1
export const SFX_LAND_GAIN = 2.92

export const SFX_DASH_FROM_HZ = 600
export const SFX_DASH_TO_HZ = 2400
export const SFX_DASH_MS = 130
export const SFX_DASH_Q = 1.5
export const SFX_DASH_GAIN = 4.27

export const SFX_FOLD_HZ = 1800
export const SFX_FOLD_MS = 45
export const SFX_FOLD_Q = 2
export const SFX_FOLD_GAIN = 2.92

export const SFX_UNFOLD_FROM_HZ = 1200
export const SFX_UNFOLD_TO_HZ = 2200
export const SFX_UNFOLD_MS = 70
export const SFX_UNFOLD_Q = 2
export const SFX_UNFOLD_GAIN = 3.42

export const SFX_RESPAWN_FROM_HZ = 1400
export const SFX_RESPAWN_TO_HZ = 300
export const SFX_RESPAWN_MS = 220
export const SFX_RESPAWN_Q = 1.2
export const SFX_RESPAWN_GAIN = 2.44

// Safety clamp, not a feel knob: `delta` spikes to hundreds of ms after a tab
// switch or a breakpoint, which would teleport the player through the floor in
// a single frame.
export const MAX_DT_MS = 1000 / 30

// --- Step 9: live tuning ---
// The eight values above are declared with `let` rather than `const` so the
// F1 panel can change them while the game runs. ESM exports are live
// bindings, so reassigning one here is seen by every module that imported
// it. Only this module can write them, hence setTuning.
//
// Anything cached at import time would go stale, which is why the
// millisecond timers are not in this list: Player converts those to seconds
// where they are used, not once at module load.

export type TuningKey =
  | 'JUMP_VELOCITY'
  | 'GRAVITY'
  | 'FALL_GRAVITY_MULT'
  | 'JUMP_CUT'
  | 'MAX_SPEED'
  | 'ACCEL'
  | 'DECEL'
  | 'DASH_SPEED'

export type Tunable = {
  key: TuningKey
  step: number
  min: number
  max: number
  decimals: number
}

export const TUNABLES: Tunable[] = [
  { key: 'JUMP_VELOCITY', step: 10, min: -1200, max: -100, decimals: 0 },
  { key: 'GRAVITY', step: 50, min: 200, max: 6000, decimals: 0 },
  { key: 'FALL_GRAVITY_MULT', step: 0.05, min: 1, max: 4, decimals: 2 },
  { key: 'JUMP_CUT', step: 0.05, min: 0, max: 1, decimals: 2 },
  { key: 'MAX_SPEED', step: 10, min: 40, max: 900, decimals: 0 },
  { key: 'ACCEL', step: 100, min: 200, max: 12000, decimals: 0 },
  { key: 'DECEL', step: 100, min: 200, max: 12000, decimals: 0 },
  { key: 'DASH_SPEED', step: 20, min: 100, max: 2000, decimals: 0 },
]

export function getTuning(key: TuningKey): number {
  switch (key) {
    case 'JUMP_VELOCITY': return JUMP_VELOCITY
    case 'GRAVITY': return GRAVITY
    case 'FALL_GRAVITY_MULT': return FALL_GRAVITY_MULT
    case 'JUMP_CUT': return JUMP_CUT
    case 'MAX_SPEED': return MAX_SPEED
    case 'ACCEL': return ACCEL
    case 'DECEL': return DECEL
    case 'DASH_SPEED': return DASH_SPEED
  }
}

export function setTuning(key: TuningKey, value: number): void {
  switch (key) {
    case 'JUMP_VELOCITY': JUMP_VELOCITY = value; break
    case 'GRAVITY': GRAVITY = value; break
    case 'FALL_GRAVITY_MULT': FALL_GRAVITY_MULT = value; break
    case 'JUMP_CUT': JUMP_CUT = value; break
    case 'MAX_SPEED': MAX_SPEED = value; break
    case 'ACCEL': ACCEL = value; break
    case 'DECEL': DECEL = value; break
    case 'DASH_SPEED': DASH_SPEED = value; break
  }
}
