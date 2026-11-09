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

// Safety clamp, not a feel knob: `delta` spikes to hundreds of ms after a tab
// switch or a breakpoint, which would teleport the player through the floor in
// a single frame.
export const MAX_DT_MS = 1000 / 30
