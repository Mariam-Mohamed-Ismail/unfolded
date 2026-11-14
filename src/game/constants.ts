// Every tuning number in the game lives here. Nothing else holds a literal.

// --- Step 1: screen and sizes ---
export const GAME_WIDTH = 960
export const GAME_HEIGHT = 540
export const TILE = 32

export const PLAYER_W = 20
export const PLAYER_H = 30

// --- Colours (all art is drawn in code, no image files) ---
// The spec's mint. Changed in step 16 from 0xb9dfc1 so the menu and the
// game are the same colour either side of a fade.
export const COLOR_BG = 0xc9e4d1
export const COLOR_SOLID = 0x1f8a4c
export const COLOR_PLAYER = 0x7fc49a

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
export let COYOTE_MS = 90
export let JUMP_BUFFER_MS = 110

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
export let DASH_TIME = 150
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
export const COLOR_PLAYER_LINE = 0x1e8a4c
export const PLAYER_OUTLINE = 2

// Squash and stretch scale the drawing only, never the hitbox.
export const LAND_SQUASH_X = 1.2
export const LAND_SQUASH_Y = 0.8
export const SQUASH_RECOVER = 90

// Rising and falling hold their stretch for as long as the state holds, so
// these are targets rather than pulses. Widths keep the figure's volume.
export const JUMP_STRETCH_X = 0.87
export const JUMP_STRETCH_Y = 1.15
export const FALL_STRETCH_X = 0.92
export const FALL_STRETCH_Y = 1.1
export const DASH_STRETCH_X = 1.4
export const DASH_STRETCH_Y = 0.71

// How fast the drawing settles onto whatever the current state wants.
export const SCALE_LERP = 18

// Shake is given in pixels here and converted where Phaser wants a
// fraction of the screen width.
export const SHAKE_LAND = 2
export const SHAKE_LAND_MS = 80
export const SHAKE_DASH = 2
export const SHAKE_DASH_MS = 80

// Only a real drop shakes: the fall has to be longer than this, measured
// from the highest point since leaving the ground. A full jump drops about
// 2.6 tiles back to where it started, so jumping never shakes.
export const SHAKE_LAND_TILES = 4

// --- Step 7b: camera ---
// Phaser applies its follow lerp once per frame rather than per second, so
// the look-ahead uses the same factor to move with it rather than against.
export const CAM_LERP = 0.12
export const CAM_LOOK_AHEAD = 80
export const CAM_DEADZONE_Y = 60
// A sliver of horizontal deadzone: zero would be ignored, and anything
// wider would make the look-ahead fight it.
export const CAM_DEADZONE_X = 1

export const PARTICLES_LAND = 8
export const PARTICLES_DASH = 10
export const PARTICLES_FOLD = 4
export const PARTICLE_SPEED = 170
export const PARTICLE_LIFE = 450
export const PARTICLE_SIZE = 4
export const PARTICLE_GRAVITY = 900

// --- Step 7a: procedural animation ---
// Idle: a slow breath and an occasional shrug, so standing still is alive.
export const IDLE_BREATH_HZ = 0.5
export const IDLE_BREATH = 1.03
export const IDLE_BOB_PX = 0.8
export const SHRUG_EVERY_MS = 4200
export const SHRUG_MS = 320
export const SHRUG_DEG = 14

// Run: the torso leans into it, legs swing, arms counter-swing. The cycle
// is driven by speed, so the legs keep up with how fast you are going.
export const RUN_LEAN_DEG = 8
export const RUN_SWING_DEG = 26
export const RUN_ARM_SWING_DEG = 18
export const RUN_CYCLE_PX = 46

// Falling lets the legs trail upward behind the body.
export const FALL_LEG_TRAIL_DEG = 22

// Dash leaves a trail of fading copies of the figure.
export const AFTERIMAGE_EVERY_MS = 25
export const AFTERIMAGE_FADE_MS = 180
export const AFTERIMAGE_ALPHA = 0.35

// A footstep every this far travelled, matching the spec's 0.28s cadence
// at full run speed.
export const FOOTSTEP_MS = 280
export const PARTICLES_FOOTSTEP = 2

// --- Step 8: sound (voices from Docs/level 1 spec) ---
// Everything is synthesised: white noise through a bandpass, which reads as
// paper rather than as a console. Frequencies in Hz, lengths in ms.
// A bandpass throws most of the noise away, so each voice carries a makeup
// gain; re-solve them if you change a frequency, a length or a Q.
export const SFX_VOLUME = 0.5

// Each burst opens over this long instead of starting at full level. A noise
// burst with no attack begins with a click that is louder than the burst.
export const SFX_ATTACK_MS = 3

// Footstep: a 20ms tick. It repeats every 280ms while running, so it sits
// well below everything else on purpose.
export const SFX_STEP_HZ = 1600
export const SFX_STEP_MS = 20
export const SFX_STEP_Q = 1.5
export const SFX_STEP_GAIN = 1.09

// Jump: a rising whoosh, low to high.
export const SFX_JUMP_FROM_HZ = 300
export const SFX_JUMP_TO_HZ = 1800
export const SFX_JUMP_MS = 140
export const SFX_JUMP_Q = 1
export const SFX_JUMP_GAIN = 4.58

// Land: a low thud.
export const SFX_LAND_FROM_HZ = 220
export const SFX_LAND_TO_HZ = 90
export const SFX_LAND_MS = 90
export const SFX_LAND_Q = 1
export const SFX_LAND_GAIN = 5.11

// Dash: the spec's sweep, 800 to 3000 over 120ms.
export const SFX_DASH_FROM_HZ = 800
export const SFX_DASH_TO_HZ = 3000
export const SFX_DASH_MS = 120
export const SFX_DASH_Q = 1.5
export const SFX_DASH_GAIN = 3.75

// Fold and unfold: a crinkle, which is several gated bursts rather than one
// hit. Each burst picks a frequency somewhere in the band.
export const SFX_CRINKLE_BURSTS = 5
export const SFX_CRINKLE_BURST_MS = 12
export const SFX_CRINKLE_SPREAD_MS = 70
export const SFX_CRINKLE_Q = 3
export const SFX_FOLD_FROM_HZ = 1800
export const SFX_FOLD_TO_HZ = 3200
export const SFX_FOLD_GAIN = 2.16
export const SFX_UNFOLD_FROM_HZ = 1400
export const SFX_UNFOLD_TO_HZ = 2600
export const SFX_UNFOLD_GAIN = 2.51

// Respawn is not in the spec's list; kept so a reset is not silent.
export const SFX_RESPAWN_FROM_HZ = 1400
export const SFX_RESPAWN_TO_HZ = 300
export const SFX_RESPAWN_MS = 220
export const SFX_RESPAWN_Q = 1.2
export const SFX_RESPAWN_GAIN = 2.28

// --- Step 11: room 1A, fold switch and stairs ---
// The spec's colour language: purple is fold pieces and switches.
export const COLOR_FOLD = 0x8b7fd6
// The same purple in shadow. A folding piece lerps between the two by its
// angle, which is what makes a flat sheet read as a rotating one.
export const COLOR_FOLD_SHADE = 0x5f55a0
export const COLOR_FOLD_LINE = 0x2b2a33
export const FOLD_OUTLINE = 2

// Folded pieces are drawn as a dashed ghost of where they will be.
export const FOLD_GHOST_ALPHA = 0.55
export const FOLD_DASH_PX = 7
export const FOLD_DASH_GAP = 5

// Interactive things breathe until they have been used.
export const PULSE_HZ = 0.8
export const PULSE_DEPTH = 0.3

// The pressure plate. The trigger box is taller than the plate so stepping
// on it is forgiving, and dashing across it still counts.
export const SWITCH_W = 26
export const SWITCH_H = 7
export const SWITCH_TRIGGER_H = 12
export const SWITCH_PRESS_PX = 3

// The ripple that spreads from the plate when it is pressed.
export const RIPPLE_MS = 520
export const RIPPLE_RADIUS = 96
export const RIPPLE_WIDTH = 2

// The dotted line from a switch to each thing it drives. It draws on the
// press, holds while they move, then fades: the room explains itself once
// rather than carrying the explanation forever.
export const LINK_DOT_PX = 3
export const LINK_DOT_GAP = 10
export const LINK_HOLD_MS = 700
export const LINK_FADE_MS = 500

// One step of the stairs: waits its turn, then rotates up about its crease.
// The spec gives the 0.12s stagger; the rotation length is mine.
export const FOLD_STAGGER_MS = 120
export const FOLD_OPEN_MS = 180

// "3 px for 100 ms when a fold platform slams open."
export const SHAKE_FOLD = 3
export const SHAKE_FOLD_MS = 100
export const PARTICLES_FOLD_OPEN = 6

// --- Step 12: tutorial prompts ---
// The spec's paper palette, used here first: cream paper, dark ink.
export const COLOR_PAPER = 0xf7f2e8
export const COLOR_INK = 0x2b2a33

// A tag fades rather than blinks, and floats clear of the ground.
export const PROMPT_FADE_MS = 220
export const PROMPT_LIFT = 58
export const PROMPT_PAD = 7
export const PROMPT_FONT_PX = 13
export const PROMPT_CAP_PX = 11
// The corner that marks it as folded paper.
export const PROMPT_FOLD_PX = 8

// Moving faster than this counts as having worked out how to run.
export const PROMPT_RUN_SPEED = 120
// A held jump clears two tiles; a tap does not, which is the lesson.
export const PROMPT_HIGH_RISE = 64

// "If the player fails the same spot 3 times, that spot's prompt returns."
export const PROMPT_FAILS_FOR_HINT = 3
export const PROMPT_PULSE_DEPTH = 0.45

// --- Step 13: room 1B, the flat-form slit ---
// The spec's colour for form pieces: slits and pickups.
export const COLOR_FORM = 0x2fa58a
export const SLIT_GLOW_WIDTH = 2

// How tall a slit pillar is when the data does not say. Seven tiles is far
// over the 82px jump, which is what stops you going round the lesson.
export const SLIT_PILLAR_H = 7

// The marker on the opening: a small chevron pointing through it.
export const CHEVRON_W = 7
export const CHEVRON_H = 9
export const CHEVRON_INSET = 6

// --- Step 14: room 1C, the wind ---
// The spec's colour for wind.
export const COLOR_WIND = 0xf0a93b

// Inside a draught, gravity is ignored and vertical speed is driven toward
// this instead. Both numbers come from the spec.
export const DRAUGHT_VY = -320
export const DRAUGHT_ACCEL = 2400

// The fan itself: triangle blades, turning.
export const FAN_SPIN = 6
export const FAN_BLADES = 3
export const FAN_BLADE_PX = 18
export const FAN_BODY_H = 10
// How tall the draught reaches when the data does not say, in tiles.
export const FAN_COLUMN_H = 8

// The column is drawn as amber triangles rising through it, 14 a second per
// the spec. At this speed a 256px column holds about 22 at a time.
export const FAN_MOTES_PER_S = 14
export const FAN_MOTE_SPEED = 160
export const FAN_MOTE_PX = 5

// Streaks swirl around the player while they are inside the column.
export const FAN_STREAKS = 3
export const FAN_STREAK_PX = 16
export const FAN_STREAK_R = 22
export const FAN_SWIRL = 7

// The hum: a low filtered loop whose level follows distance. Silent beyond
// this far away. The gain is solved numerically, like the one-shot voices:
// a bandpass throws most of the noise energy away.
export const FAN_HEAR_PX = 420
export const FAN_HUM_HZ = 120
export const FAN_HUM_Q = 1.2
// Solved for -38 dBFS RMS at full closeness, which sits under the
// footstep's -34 because the hum never stops. A guess of 4 would have run
// at -20 dBFS, continuously.
export const FAN_HUM_GAIN = 0.54

// --- Step 15: the end of the level ---
// The sword pieces: three teal triangles, orbiting.
export const PICKUP_PIECES = 3
export const PICKUP_PIECE_PX = 6
export const PICKUP_ORBIT_R = 16
export const PICKUP_ORBIT_HZ = 0.35
// Reach from the anchor to the nearest point of the player's box. Standing
// under them is 18px, so walking up to them is enough: the payoff should
// not be a second dexterity test after riding the fan.
export const PICKUP_REACH = 26
export const PICKUP_SWIRL_MS = 260
export const PICKUP_CARRY_R = 24
// "Slight zoom pulse 1.0 to 1.03 for 120ms on pickup."
export const PICKUP_ZOOM = 0.03
export const PICKUP_ZOOM_MS = 120

// Folded together, the three pieces make one long thin blade.
export const SWORD_LEN = 34
export const SWORD_W = 7
export const SLASH_ARC = 2.4

// The exit door: folded paper that opens as you approach.
export const DOOR_W = 26
export const DOOR_H = 46
export const DOOR_NEAR_PX = 110
export const DOOR_OPEN_MS = 320

// Pickup: a triangle-wave arpeggio, the spec's three notes.
//
// A bare triangle's RMS is its peak over root 3, which is -4.8 dB, and that
// is as far as arithmetic gets you: the decay envelope takes off another
// 12 dB over a 150ms note, so the measured unit level is -17 dB. Solving
// for it gives 0.71 where the waveform maths alone said 0.17 - quiet enough
// to be inaudible under the rest of the mix.
export const SFX_PICKUP_NOTES = [523, 659, 784]
export const SFX_PICKUP_NOTE_MS = 150
export const SFX_PICKUP_STEP_MS = 80
export const SFX_PICKUP_GAIN = 0.71

// The sword folding: a bright upward sweep. Noise, so the gain is solved.
export const SFX_WHOOSH_FROM_HZ = 600
export const SFX_WHOOSH_TO_HZ = 4000
export const SFX_WHOOSH_MS = 160
export const SFX_WHOOSH_Q = 1.5
export const SFX_WHOOSH_GAIN = 3.9

// --- Level 2, room 2A: the fold wall ---
// A tall wall that tips over around its base crease when a switch folds it.
export const FOLDWALL_H = 9
export const FOLDWALL_MS = 400
// Laid flat it is drawn as a thin strip. It carries no collision: the floor
// it lies on is already solid, and a 4px solid would be a 4px wall, since
// the controller has no step-up.
export const FOLDWALL_THIN_PX = 4
export const PARTICLES_FOLDWALL = 10
export const SHAKE_FOLDWALL = 3
export const SHAKE_FOLDWALL_MS = 100

// A switch flashes its link lines when pressed, so cause and effect read.
export const LINK_FLASH_MS = 220
export const LINK_FLASH_WIDTH = 3

// --- Level 2: a cooler palette ---
// The level data picks which palette it uses; the values live here, like
// every other number.
export const COLOR_L2_BG = 0xd4dee8
// Deeper than Level 1's purple so it still reads on the cooler background.
export const COLOR_L2_FOLD = 0x6b5fc4

// --- Step 16: scenes, menus and the HUD ---
export const FADE_MS = 220

// Buttons: cream paper with a dark outline, the selected one purple.
export const MENU_W = 300
export const MENU_H = 44
export const MENU_GAP = 12
export const MENU_FONT_PX = 17
export const MENU_FOLD_PX = 10
export const MENU_TOP = 250
// Where the buttons sit on a page that has a list above them.
export const MENU_TOP_LIST = 352

// A long page — room select, with every level's rooms under a heading —
// needs shorter rows to fit on a 540px screen.
export const MENU_H_SMALL = 32
export const MENU_GAP_SMALL = 7
export const MENU_HEAD_H = 26
export const MENU_TOP_ROOMS = 74
export const PAUSE_TOP_ROOMS = 120
export const TITLE_FONT_PX = 58
export const TITLE_Y = 130
export const SUBTITLE_FONT_PX = 15

// The origami shape drifting behind the title: a few big triangles turning
// slowly, well behind the text.
export const DRIFT_TRIS = 4
export const DRIFT_R = 108
export const DRIFT_SPIN = 0.09
export const DRIFT_HZ = 0.05
export const DRIFT_PX = 26
export const DRIFT_ALPHA = 0.3

// The HUD: room name one side, timer and resets the other. Nothing else.
export const HUD_FONT_PX = 13
export const HUD_PAD = 10

// --- Step 17: the pause overlay ---
// The game stays on screen underneath, washed over rather than hidden.
export const PAUSE_DIM = 0.55
export const PAUSE_PANEL_W = 400
export const PAUSE_PANEL_PAD = 26
export const PAUSE_TITLE_Y = 92
export const PAUSE_TOP = 138
export const PAUSE_TOP_LIST = 300

// --- Level 2: the sword swing ---
// The spec's three phases. They sum to 370ms, while the same sentence calls
// the cooldown 350ms - 20ms apart. The phases are kept as written and the
// swing itself is the gate, so a slash lands every 370ms.
export const SLASH_WINDUP_MS = 120
export const SLASH_ACTIVE_MS = 100
export const SLASH_RECOVER_MS = 150
export const SLASH_COOLDOWN_MS = 350

// The hit area: a rectangle in front of the player, flipped by facing.
export const SLASH_BOX_W = 56
export const SLASH_BOX_H = 36

// Swinging commits you: during the active window you move at 60%.
export const SLASH_SPEED_SCALE = 0.6

// What a connecting hit feels like.
export const SLASH_HITSTOP_MS = 60
export const SLASH_SHAKE = 2
export const SLASH_SHAKE_MS = 80
export const PARTICLES_HIT = 5
export const KNOCKBACK = 160
export const HIT_FLASH_MS = 90

// Three triangles trailing the sweep, each fading out behind it.
export const TRAIL_TRIS = 3
export const TRAIL_FADE_MS = 120

// The training dummy: a temporary target, removable in one line of
// level2.ts. Three hits to break.
export const DUMMY_W = 22
export const DUMMY_H = 44
export const DUMMY_HEALTH = 3
export const DUMMY_FRICTION = 900

// Swoosh: the spec's descending sweep. Hit: a short low crunch. Both are
// noise, so both gains are solved numerically rather than guessed.
export const SFX_SWOOSH_FROM_HZ = 1500
export const SFX_SWOOSH_TO_HZ = 400
export const SFX_SWOOSH_MS = 90
export const SFX_SWOOSH_Q = 1.4
// Solved: a guess of 4 ran 4.5dB hot and would have clipped.
export const SFX_SWOOSH_GAIN = 2.4

export const SFX_HIT_FROM_HZ = 260
export const SFX_HIT_TO_HZ = 110
export const SFX_HIT_MS = 70
export const SFX_HIT_Q = 1.1
// Solved at the -3dBFS peak ceiling rather than the -26 RMS target: a
// short low burst has a high crest factor, so the peak binds first and it
// lands at -30.9 dBFS. Louder would clip.
export const SFX_HIT_GAIN = 5.11

// --- Level 2, room 2B: the seal ---
// A strip of teal tape across a passage, floor to a ceiling block, that
// only the sword cuts.
export const SEAL_TOP_H = 8
export const SEAL_TAPE_PX = 2
export const SEAL_CROSS_GAP = 18
// How close the prompt and the glow come on, in tiles.
export const SEAL_REACH = 3
export const SEAL_SHAKE = 3
export const SEAL_SHAKE_MS = 100
export const PARTICLES_SEAL = 8

// Cutting it: the spec's tear, a noise burst with a descending pitch.
export const SFX_TEAR_FROM_HZ = 2200
export const SFX_TEAR_TO_HZ = 500
export const SFX_TEAR_MS = 140
export const SFX_TEAR_Q = 2
// Solved, like every noise voice: a guess of 3 ran a little hot.
export const SFX_TEAR_GAIN = 2.69

// --- Level 2, room 2C: fans on timers ---
// The last stretch before a fan turns off, so the player can read it: the
// blades slow, the motes flicker and the hum drops.
export const FAN_WARN_MS = 400
export const FAN_WARN_SPIN = 0.3
export const FAN_FLICKER_HZ = 9
export const FAN_HUM_WARN = 0.35
// Turning on: the blades wind back up, and a batch of motes shoots up.
export const FAN_SPINUP_MS = 250
export const FAN_BURST = 10
// The column's outline, dashed while it is off.
export const FAN_DASH_PX = 8
export const FAN_DASH_GAP = 6

// Safety clamp, not a feel knob: `delta` spikes to hundreds of ms after a tab
// switch or a breakpoint, which would teleport the player through the floor in
// a single frame.
export const MAX_DT_MS = 1000 / 30

// --- Step L2-6: the fixed simulation step ---
// The simulation runs at a constant rate regardless of the display, so the
// same inputs always produce the same result and a recording can be replayed.
// Rendering still happens once per frame; only the physics is quantised.
export const STEP_HZ = 60
export const STEP_MS = 1000 / STEP_HZ
export const FIXED_DT = 1 / STEP_HZ
// A recording stops itself after this long, so one left running cannot grow
// without bound.
export const RECORD_MAX_S = 60
// How long the tool's one-line message stays up.
export const TOOL_NOTE_S = 3

// --- Step L2-7: player health ---
// From the spec: three hits, and what one costs.
export const HEALTH_MAX = 3
export const HURT_KNOCK_X = 240
export const HURT_KNOCK_Y = 200
export const HURT_INVULN_MS = 1000
export const HURT_SHAKE = 3
export const HURT_SHAKE_MS = 100
export const HURT_FREEZE_MS = 100
// Not from the spec. It gives a knockback speed but no duration, and input
// steers 240px/s away in about 90ms at DECEL, so without a window where the
// run does not fight it the knockback cannot be felt at all.
export const HURT_HOLD_MS = 140
// "A blink", with no rate given. Fast enough to read as flashing, slow
// enough not to strobe.
export const HURT_BLINK_HZ = 8
export const HURT_BLINK_ALPHA = 0.3
// "A brief red-pink tint at the screen edges": how long, how strong, and how
// far in from the edge it reaches.
export const HURT_TINT_MS = 220
export const HURT_TINT_ALPHA = 0.5
export const HURT_TINT_PX = 56
export const HURT_TINT_BANDS = 6
// The spec names no hex for "red-pink". This sits between its bat pink
// (#E88A8A) and red.
export const COLOR_HURT = 0xe8697f
// "Bursts into triangles" with no count. The other bursts are 2 to 10, and a
// death should be the largest of them.
export const DEATH_PARTICLES = 18

// The three pips under the room name. Triangles, like everything else.
export const HEALTH_PIP_PX = 7
export const HEALTH_PIP_GAP = 6
export const HEALTH_PIP_DY = 18
export const HEALTH_PIP_FADE_S = 0.45
export const HEALTH_PIP_LINE = 1.5

// --- Step L2-8a: the bat ---
// From the spec: the hitbox, one health, the range box in tiles, and every
// state's length in seconds.
export const BAT_W = 28
export const BAT_H = 20
export const BAT_HEALTH = 1
export const BAT_RANGE_X = 7
export const BAT_RANGE_Y = 6
export const BAT_ALERT_S = 0.5
export const BAT_DIVE_SPEED = 380
export const BAT_STUN_S = 0.8
export const BAT_RETURN_S = 0.8
export const BAT_COOLDOWN_S = 1.5
// A bat in a draught is pushed up, so the dive bends.
export const BAT_WIND_ACCEL = 1200
// Not from the spec: how fast the wind it picked up bleeds off once it is
// out of the column again, so a bent dive straightens rather than sailing.
export const BAT_WIND_DAMP = 900
// Not from the spec: how close a ceiling has to be overhead to count as
// hiding under it. A little over half the player's standing height, so a
// slit's gap counts and open ground does not.
export const BAT_COVER_PX = 40
// Hanging: a slow, small sway, so it reads as alive but not as moving.
export const BAT_SWAY_PX = 3
export const BAT_SWAY_HZ = 0.5
// Flapping: how fast and how far the wing facets swing.
export const BAT_FLAP_HZ = 6
export const BAT_FLAP_DEG = 26
// How finely the dive curve is sampled. 48 keeps the arc-length error well
// under a pixel over a dive of a few hundred.
export const BAT_DIVE_SAMPLES = 48
// The death burst. Bigger than a sword hit's 5, smaller than a player's 18.
export const PARTICLES_BAT = 12
// How far above the bat the "!" telegraph floats. Its size and paper come
// from the shared prompt tag, so it matches every other tag in the game.
export const BAT_TAG_DY = 26

// The spec's bat palette: slate body, darker wing facets, pink ears.
export const COLOR_BAT_BODY = 0x5f7f8c
export const COLOR_BAT_WING = 0x3f5865
export const COLOR_BAT_EAR = 0xe88a8a

// The alert sting: two sine notes, as the spec writes them. The gain is
// solved by tests/calibrate.mjs.
export const SFX_STING_NOTES = [880, 660]
export const SFX_STING_NOTE_MS = 110
export const SFX_STING_STEP_MS = 120
export const SFX_STING_GAIN = 1

// The thud: one oscillator dropping in pitch, the shape the pickup arpeggio
// uses. The gain is solved by tests/calibrate.mjs, not chosen.
export const SFX_THUD_FROM_HZ = 180
export const SFX_THUD_TO_HZ = 55
export const SFX_THUD_MS = 190
// Solved by tests/calibrate.mjs to -26 dBFS: a placeholder 1 was 2.9dB hot.
export const SFX_THUD_GAIN = 0.72

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
  | 'MAX_SPEED'
  | 'GRAVITY'
  | 'JUMP_VELOCITY'
  | 'DASH_SPEED'
  | 'DASH_TIME'
  | 'COYOTE_MS'
  | 'JUMP_BUFFER_MS'
  | 'FALL_GRAVITY_MULT'
  | 'JUMP_CUT'
  | 'ACCEL'
  | 'DECEL'

export type Tunable = {
  key: TuningKey
  step: number
  min: number
  max: number
  decimals: number
}

// The six the spec names come first; the rest are extras kept from before.
// Dash distance is two knobs, speed and time, so the panel shows the
// product as a read-out.
export const TUNABLES: Tunable[] = [
  { key: 'MAX_SPEED', step: 10, min: 40, max: 900, decimals: 0 },
  { key: 'GRAVITY', step: 50, min: 200, max: 6000, decimals: 0 },
  { key: 'JUMP_VELOCITY', step: 10, min: -1200, max: -100, decimals: 0 },
  { key: 'DASH_SPEED', step: 20, min: 100, max: 2000, decimals: 0 },
  { key: 'DASH_TIME', step: 10, min: 40, max: 600, decimals: 0 },
  { key: 'COYOTE_MS', step: 10, min: 0, max: 400, decimals: 0 },
  { key: 'JUMP_BUFFER_MS', step: 10, min: 0, max: 400, decimals: 0 },
  { key: 'FALL_GRAVITY_MULT', step: 0.05, min: 1, max: 4, decimals: 2 },
  { key: 'JUMP_CUT', step: 0.05, min: 0, max: 1, decimals: 2 },
  { key: 'ACCEL', step: 100, min: 200, max: 12000, decimals: 0 },
  { key: 'DECEL', step: 100, min: 200, max: 12000, decimals: 0 },
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
    case 'DASH_TIME': return DASH_TIME
    case 'COYOTE_MS': return COYOTE_MS
    case 'JUMP_BUFFER_MS': return JUMP_BUFFER_MS
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
    case 'DASH_TIME': DASH_TIME = value; break
    case 'COYOTE_MS': COYOTE_MS = value; break
    case 'JUMP_BUFFER_MS': JUMP_BUFFER_MS = value; break
  }
}
