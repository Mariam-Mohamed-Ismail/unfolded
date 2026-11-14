/**
 * The crease the player chose between Level 1 and Level 2, and the two
 * questions the rest of the game asks about it.
 *
 * Module-level state with one writer, the same shape as the live tunables in
 * constants.ts and for the same reason: it is read in four places that have
 * no connection to each other — the controller, the sword, the figure and
 * the HUD — and threading it through all of them would be worse than one
 * module that owns it.
 *
 * "Kept for the session" means a page load. Quitting to the main menu keeps
 * the choice; reloading clears it. Nothing is written to storage.
 */

export type Crease = 'none' | 'glider' | 'keen'

/** What the cards offer, in the order they are shown. */
export const CREASES: { id: Crease; name: string; effect: string }[] = [
  {
    id: 'glider',
    name: 'Glider fold',
    effect: 'hold Space as you\nfall to drift down\nslowly',
  },
  {
    id: 'keen',
    name: 'Keen edge',
    effect: 'a longer blade that\ncuts from further\naway',
  },
]

let chosen: Crease = 'none'

export function crease(): Crease {
  return chosen
}

/** Has a crease been picked yet? What decides whether to show the cards. */
export function chosenYet(): boolean {
  return chosen !== 'none'
}

export function setCrease(next: Crease): void {
  chosen = next
}

/** A fresh session, and what the tests reset between cases. */
export function clearCrease(): void {
  chosen = 'none'
}

export function hasGlider(): boolean {
  return chosen === 'glider'
}

export function hasKeen(): boolean {
  return chosen === 'keen'
}
