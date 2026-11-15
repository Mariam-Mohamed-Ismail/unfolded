import type { Box } from './Entity.ts'
import type { Solid } from '../Player.ts'
import { COVER_PX } from '../constants.ts'

/**
 * "Is there something solid just overhead?" — one rule, two users.
 *
 * Every solid in this game runs from its top surface downward, so a floor's
 * underside is far below and only a slab — a slit's pillar, a seal's
 * ceiling block — can answer yes. That makes this the geometric reading of
 * "under a pillar", with no reference to Slit at all.
 *
 * The bat asks it about the player, to decide whether they are hiding. The
 * snake asks it about a patch of floor, to decide whether reappearing there
 * would put it inside a slit. Shared because it is exactly the sort of small
 * rule that drifts when it is copied.
 */
export function covered(box: Box, solids: readonly Solid[]): boolean {
  for (const s of solids) {
    if (s.x >= box.right || s.x + s.w <= box.left) continue
    const gap = box.top - (s.y + s.h)
    // Slightly negative counts: a player flat in a slit fills the gap exactly.
    if (gap >= -2 && gap <= COVER_PX) return true
  }
  return false
}

/**
 * Is the player tucked away where an enemy should leave them alone? Flat,
 * and with a ceiling close above — flat in the open is still fair game, and
 * that is the half of the rule worth remembering.
 */
export function hiding(
  box: Box,
  flat: boolean,
  solids: readonly Solid[],
): boolean {
  return flat && covered(box, solids)
}
