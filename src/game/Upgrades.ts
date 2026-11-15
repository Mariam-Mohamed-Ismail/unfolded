/**
 * The creases the player has chosen, and the questions the rest of the game
 * asks about them.
 *
 * Module-level state with one writer, the same shape as the live tunables in
 * constants.ts and for the same reason: it is read in five places that have
 * no connection to each other — the controller, the sword, the snake, the
 * figure and the HUD — and threading it through all of them would be worse
 * than one module that owns it.
 *
 * There are two choices, one before Level 2 and one before Level 3, and the
 * second is *added* to the first: this holds a list, not a value. The list is
 * in the order the creases were earned, which is the order the HUD draws them.
 *
 * "Kept for the session" means a page load. Quitting to the main menu keeps
 * the choices; reloading clears them. Nothing is written to storage.
 */

export type Crease = 'glider' | 'keen' | 'quick' | 'parry'

export type CreaseCard = { id: Crease; name: string; effect: string }

/**
 * What the cards offer, one round per choice, in the order they are shown.
 * The round a player is owed is simply the one at `rounds()`.
 */
export const CREASE_ROUNDS: CreaseCard[][] = [
  [
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
  ],
  [
    {
      id: 'quick',
      name: 'Quick fold',
      effect: 'fold flat in mid-air,\nand slide faster\nwhile flat',
    },
    {
      id: 'parry',
      name: 'Parry crease',
      effect: 'slash the venom to\nsend it back at\nthe snake',
    },
  ],
]

const held: Crease[] = []

/** Everything earned, in the order it was earned. What the HUD draws. */
export function creases(): readonly Crease[] {
  return held
}

/** How many choices have been made. What decides which round to show. */
export function rounds(): number {
  return held.length
}

/** The cards for the choice the player is owed, or null if there are none. */
export function nextRound(): CreaseCard[] | null {
  return CREASE_ROUNDS[held.length] ?? null
}

/** Add a crease. Picking one twice is a no-op rather than a duplicate. */
export function setCrease(next: Crease): void {
  if (!held.includes(next)) held.push(next)
}

/** A fresh session, and what the tests reset between cases. */
export function clearCreases(): void {
  held.length = 0
}

export function has(which: Crease): boolean {
  return held.includes(which)
}

export function hasGlider(): boolean {
  return has('glider')
}

export function hasKeen(): boolean {
  return has('keen')
}

export function hasQuick(): boolean {
  return has('quick')
}

export function hasParry(): boolean {
  return has('parry')
}

/** A crease's card name, for the screens that list them. */
export function creaseName(which: Crease): string {
  for (const round of CREASE_ROUNDS) {
    for (const card of round) if (card.id === which) return card.name
  }
  return which
}

/**
 * What the player passed over: from every round they chose in, the card
 * they did not pick. The Game complete screen's "try these next time".
 * A round they never reached offers nothing, since there was no choice.
 */
export function untaken(): CreaseCard[] {
  const out: CreaseCard[] = []
  for (const round of CREASE_ROUNDS) {
    if (!round.some((c) => held.includes(c.id))) continue
    for (const card of round) if (!held.includes(card.id)) out.push(card)
  }
  return out
}
