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
export const MAX_SPEED = 260
export const ACCEL = 2200
export const DECEL = 2600
export const AIR_ACCEL = 1600
export const AIR_DECEL = 1200

// --- Step 3: jumping (not used yet) ---
export const JUMP_VELOCITY = -560
export const GRAVITY = 1800
export const FALL_GRAVITY_MULT = 1.6
export const MAX_FALL_SPEED = 900
export const JUMP_CUT = 0.45
export const COYOTE_MS = 90
export const JUMP_BUFFER_MS = 110

// --- Step 5: flat form ---
// Folding keeps the feet planted: the box shrinks downward from the head.
export const PLAYER_FLAT_W = 30
export const PLAYER_FLAT_H = 12

// A slit must pass the flat form and stop the standing one, so it lives
// between PLAYER_FLAT_H and PLAYER_H. Half a tile, for the grid.
export const SLIT_H = 16

// --- Step 4: dash ---
export const DASH_SPEED = 560
export const DASH_TIME = 140
export const DASH_COOLDOWN = 400
export const DASH_FREEZE = 50

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
export const SFX_VOLUME = 0.35

export const SFX_JUMP_HZ = 1100
export const SFX_JUMP_TONE_HZ = 320
export const SFX_JUMP_MS = 90

export const SFX_LAND_HZ = 900
export const SFX_LAND_MS = 70

export const SFX_DASH_FROM_HZ = 600
export const SFX_DASH_TO_HZ = 2400
export const SFX_DASH_MS = 130

export const SFX_FOLD_HZ = 1800
export const SFX_FOLD_MS = 45

export const SFX_UNFOLD_FROM_HZ = 1200
export const SFX_UNFOLD_TO_HZ = 2200
export const SFX_UNFOLD_MS = 70

export const SFX_RESPAWN_FROM_HZ = 1400
export const SFX_RESPAWN_TO_HZ = 300
export const SFX_RESPAWN_MS = 220

// Safety clamp, not a feel knob: `delta` spikes to hundreds of ms after a tab
// switch or a breakpoint, which would teleport the player through the floor in
// a single frame.
export const MAX_DT_MS = 1000 / 30
