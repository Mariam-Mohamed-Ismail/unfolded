import {
  CAM_LERP_Y,
  COLOR_FORM,
  COLOR_L2_FOLD,
  COLOR_L3_BG,
  COLOR_L3_LINE,
  COLOR_L3_SOLID,
  COLOR_WIND,
} from '../constants.ts'
import type { LevelData } from './types.ts'

/**
 * Level 3, "True Shape": the hard tier, where the mechanics interact.
 *
 * The skeleton only — floors, checkpoints, the palette. What each room will
 * hold, from the spec:
 *   3A  a timed switch far from the fan it frees, under an overhang
 *   3B  a slit, a seal holding a fold bridge over a gap, and the snake
 *   3C  a shaft with both enemies, a sealed sheet over a tall fan column
 *
 * The first level taller than the screen: 24 tiles is 768px against a 540px
 * viewport, which is why it is also the first to ask for a gentle vertical
 * follow.
 */
export const level3: LevelData = {
  name: 'Level 3',
  width: 120,
  height: 24,
  // The main floor surface lands at y = 640px, as the spec states.
  floorRow: 20,

  // The spec's warm dusk. The first palette to name its own platforms:
  // cream with a dark outline instead of the mint every earlier level is
  // drawn with.
  palette: {
    bg: COLOR_L3_BG,
    solid: COLOR_L3_SOLID,
    line: COLOR_L3_LINE,
    fold: COLOR_L2_FOLD,
    wind: COLOR_WIND,
    form: COLOR_FORM,
  },

  // Both enemies live here, so the health pips show.
  hazards: true,
  // 228px of vertical scroll to play with, so the view eases rather than
  // chasing every jump.
  camLerpY: CAM_LERP_Y,

  spawn: { x: 2, h: 0 },

  // One floor per room, as in Level 2: each is the single line that gets cut
  // up when that room's geometry arrives.
  //
  // 3A and 3B are not joined yet. 3A's floor is at h0 and 3B's block at h8,
  // and what bridges them is 3A's overhang ledge (x 12-36, top h8), which
  // belongs to that room's step. Until then each room is walkable on its
  // own and the border at x36 is a 256px wall.
  solids: [
    { x: 0, w: 36, h: 0 },
    // Room 3A, closed on the left so there is no walking out of the world.
    // From the spec's room description rather than the step's list: one
    // line to remove.
    { x: 0, w: 1, h: 12 },
    // The overhang: a 1-tile-thick slab with the floor open underneath, so
    // the timed switch sits in its shade and the ledge above is the way on.
    // 256px up against an 82.5px jump, so only the draught reaches it.
    { x: 12, w: 24, h: 8, bottomH: 7 },
    // 3A's bat strip, tiles 8 to 11, over the landing area.
    //
    // It begins exactly where the fan's column ends - the column is x6-8 -
    // so it does not cap the draught. That is luck, not design: move this
    // one tile left and 3A stops working. room3a-check pins it.
    { x: 8, w: 3, h: 12.25, bottomH: 12 },
    // Room 3B is a raised block rather than a floor with steps, cut by the
    // gap the bridge spans: approach, pit, far side.
    { x: 36, w: 20, h: 8 },
    // The pit, 2 tiles down and safe. See room3b-check: both its walls are
    // 64px against an 82.5px jump, which is measured rather than assumed.
    { x: 56, w: 10, h: 6 },
    { x: 66, w: 10, h: 8 },
    // The block over 3B's seal, so the seal cannot be jumped over. A slab,
    // like 2B's, hanging over the passage.
    { x: 52, w: 1, h: 18, bottomH: 16 },
    // Room 3C: the entry ledge, then an 8-tile drop into the shaft. The
    // drop is one way - 256px is well past a jump - so the landing is
    // committed.
    { x: 76, w: 10, h: 8 },
    { x: 86, w: 22, h: 0 },
    // The exit platform, 448px up. Only the fan reaches it.
    { x: 108, w: 12, h: 14 },
    // The block over 3C's seal, so six tiles of tape cannot be jumped.
    { x: 99, w: 1, h: 8, bottomH: 6 },
    // 3C's bat strip, tiles 104 to 107, over the platform's edge. Same
    // lucky adjacency as 3A's: the fan's column is x102-104, so this
    // begins where the column ends and does not cap it.
    { x: 104, w: 3, h: 18.25, bottomH: 18 },
  ],

  entities: [
    { id: 'cp3a', type: 'Checkpoint', x: 1, h: 0 },

    // Room 3A: a timed action a long way from where it pays off.
    //
    // The plate at x22 folds the sheet aside for 7s. The fan is 15 tiles
    // back the other way, so the run is the puzzle. While the sheet is shut
    // the column stops just under it; folded aside, it reaches h10 and the
    // drift right carries you onto the ledge at h8.
    //
    // The bat's place is deliberately empty: its strip is x 8-11 with the
    // anchor at x 9.5, h 12, over the landing area, and it arrives in a
    // later step. Nothing is placed there.
    // The blade. Level 3 assumes you carry it from Level 2, but nothing
    // carries it yet, so without this the seals in 3B and 3C cannot be cut
    // and both rooms are unfinishable - including from Room select. Same
    // temporary Pickup Level 2 uses; the real carry-over is still open.
    { id: 'l3sword', type: 'Pickup', x: 3, h: 0, carried: true },
    { id: 'fan3a', type: 'Fan', x: 6, w: 2, floorH: 0, columnH: 10 },
    { id: 'sheet3a', type: 'FoldSheet', x: 4, w: 6, h: 5 },
    { id: 'tsw3a', type: 'TimedSwitch', x: 22, h: 0,
      targets: ['sheet3a'], duration: 7 },
    // The bat, on its strip over the landing area. It alerts as the
    // player rises in the freed draught, and its dive bends in the
    // column - which is the whole reason 3A has one.
    { id: 'bat3a', type: 'Bat', x: 9, w: 1, h: 12 },

    { id: 'cp3b', type: 'Checkpoint', x: 37, h: 8 },

    // Room 3B: squeeze through, unfold in the calm, cut the seal that is
    // holding the bridge shut, then cross.
    //
    // The slit and the seal both stand on the h8 block, and Slit and Seal
    // both measure topH from the floor row - so a 7-tile pillar on h8 tops
    // out at h15, not h7.
    //
    // The snake's place is deliberately empty: home x70, patrol x67-75, on
    // the far side of the gap. It arrives in a later step.
    { id: 'slit3b', type: 'Slit', x: 40, w: 6, h: 8, topH: 15, clearancePx: 14 },
    { id: 'seal3b', type: 'Seal', x: 52, floorH: 8, topH: 16 },
    { id: 'bridge3b', type: 'FoldBridge', x: 56, w: 10, topH: 8,
      segments: 5, heldBy: 'seal3b' },
    // The test snake, in the place 3B has been holding for it. It
    // telegraphs and teleports but cannot hurt you yet: contact damage,
    // venom and the first-hit stagger are the second half.
    { id: 'snake3b', type: 'Snake', x: 70, h: 8, homeX: 70,
      patrolFrom: 67, patrolTo: 75, floorH: 8 },
    // 3C has two: one at the room's entrance on the ledge, and one on the
    // landing at the bottom of the drop so a reset does not send the player
    // back through 3B.
    //
    // The landing one is INERT for now. A Room resolves a single checkpoint
    // by id, and Checkpoint is a passive position with no notion of having
    // been reached, so the room points at the entrance. Making the last one
    // touched take over is a change to Level.respawnPoint() and a later
    // step; the data is here so that step is only the behaviour.
    { id: 'cp3c', type: 'Checkpoint', x: 77, h: 8 },
    { id: 'cp3cLand', type: 'Checkpoint', x: 87, h: 0 },

    // Room 3C: the finale. Drop in, squeeze through, cut the seal, and the
    // seal was holding the sheet that was capping the fan that is the only
    // way onto the exit platform.
    //
    // This slit stands on the shaft floor at h0, so topH is 7 - unlike
    // 3B's, which needed 15 because that pillar stands on a raised block.
    //
    // Both enemies' places are deliberately empty: the snake's home is x96
    // with its patrol x94-98, and the bat's anchor is x105.5 at h18 over a
    // ceiling strip at x104-107. Worth knowing when that strip arrives:
    // the fan's column is x102-104, so the strip begins exactly where the
    // column ends and will not cap it. That is luck, not design.
    { id: 'slit3c', type: 'Slit', x: 90, w: 3, topH: 7, clearancePx: 14 },
    { id: 'seal3c', type: 'Seal', x: 99, floorH: 0, topH: 6 },
    { id: 'sheet3c', type: 'FoldSheet', x: 100, w: 6, h: 9, heldBy: 'seal3c' },
    { id: 'fan3c', type: 'Fan', x: 102, w: 2, floorH: 0, columnH: 16 },
    // The snake in the arena past the slit: it ignores a player who is
    // flat inside the pillar and rears as they come out.
    { id: 'snake3c', type: 'Snake', x: 96, h: 0, homeX: 96,
      patrolFrom: 94, patrolTo: 98, floorH: 0 },
    // The bat over the platform edge, which the ride up the 16-tile
    // column passes on the way.
    { id: 'bat3c', type: 'Bat', x: 105, w: 1, h: 18 },
    { id: 'exit3', type: 'ExitDoor', x: 118, h: 14 },
  ],

  rooms: [
    { id: '3a', name: '3A · Timing', from: 0, to: 36, checkpoint: 'cp3a' },
    { id: '3b', name: '3B · Bridge', from: 36, to: 76, checkpoint: 'cp3b' },
    { id: '3c', name: '3C · Shaft', from: 76, to: 120, checkpoint: 'cp3c' },
  ],
}
