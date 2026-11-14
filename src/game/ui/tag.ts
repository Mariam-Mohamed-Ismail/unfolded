import type * as Phaser from 'phaser'
import type { Fx } from '../entities/Entity.ts'
import {
  COLOR_INK,
  COLOR_PAPER,
  FOLD_OUTLINE,
  PROMPT_CAP_PX,
  PROMPT_FOLD_PX,
  PROMPT_FONT_PX,
  PROMPT_PAD,
} from '../constants.ts'

/** Monospace, so a character is a reliable fraction of the font size. */
const CHAR = 0.6
const CAP_GAP = 5

export type TagBox = { x: number; y: number; w: number; h: number }

/**
 * The paper prompt tag: a cream quad with its top-right corner turned down,
 * a key cap or two, and a few words.
 *
 * Shared because two things draw one now — the zone-based PromptTag and the
 * Seal, whose text depends on whether the blade is out. Two copies would
 * drift the first time one of them was adjusted.
 */
export function capWidth(key: string): number {
  return key.length * PROMPT_CAP_PX * CHAR + 8
}

/** How big a tag with these contents is, centred on (cx, cy). */
export function tagBox(cx: number, cy: number, words: string, keys: string[]): TagBox {
  let w = PROMPT_PAD * 2
  for (const key of keys) w += capWidth(key) + CAP_GAP
  if (words) w += words.length * PROMPT_FONT_PX * CHAR
  const h = PROMPT_CAP_PX + 6 + PROMPT_PAD * 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

/** The paper and the key outlines. The words go through drawTagText. */
export function drawTag(
  g: Phaser.GameObjects.Graphics,
  box: TagBox,
  keys: string[],
  alpha: number,
): void {
  const { x, y, w, h } = box
  const fold = PROMPT_FOLD_PX
  const body = [
    { x, y },
    { x: x + w - fold, y },
    { x: x + w, y: y + fold },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ]
  g.fillStyle(COLOR_PAPER, alpha)
  g.fillPoints(body, true)
  g.lineStyle(FOLD_OUTLINE, COLOR_INK, alpha)
  g.strokePoints(body, true)
  // The crease of the turned corner.
  g.lineBetween(x + w - fold, y, x + w, y + fold)

  let at = x + PROMPT_PAD
  const capH = PROMPT_CAP_PX + 6
  for (const key of keys) {
    const capW = capWidth(key)
    g.lineStyle(FOLD_OUTLINE, COLOR_INK, alpha)
    g.strokeRect(at, y + (h - capH) / 2, capW, capH)
    at += capW + CAP_GAP
  }
}

/**
 * The key letters and the words, through the scene's label pool. `id` is
 * the prefix each label is stored under.
 */
export function drawTagText(
  fx: Fx,
  id: string,
  box: TagBox,
  words: string,
  keys: string[],
  alpha: number,
): void {
  const mid = box.y + box.h / 2
  let at = box.x + PROMPT_PAD
  for (let i = 0; i < keys.length; i++) {
    const capW = capWidth(keys[i])
    fx.label(`${id}:k${i}`, at + capW / 2, mid, keys[i], PROMPT_CAP_PX, alpha)
    at += capW + CAP_GAP
  }
  if (words) {
    fx.label(
      id,
      at + (box.x + box.w - PROMPT_PAD - at) / 2,
      mid,
      words,
      PROMPT_FONT_PX,
      alpha,
    )
  }
}
