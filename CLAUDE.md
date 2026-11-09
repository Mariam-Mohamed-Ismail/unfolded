# CLAUDE.md
   ## About this project
   Unfolded: a 2D origami puzzle action platformer (HTML5, 7 days).
   All art is drawn in code with Phaser Graphics, no image or audio files. All
   sound is Web Audio. Every tuning number lives in src/game/constants.ts.
   Keep files small (Player, Input, Camera, Audio, Particles). After each task,
   explain what you changed. Don't add features I didn't ask for.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server with HMR
npm run build    # tsc type-check (noEmit) then vite build -> dist/
npm run preview  # serve the built dist/ locally
npx tsc --noEmit # type-check only, without building
```

No test runner, linter, or formatter is configured — `npm run build` is the only correctness gate, and it fails on type errors before Vite ever runs.

## State of the project

`src/main.ts` boots a `Phaser.Game` into `#app`. Day 1 is the movement lane of level 1 (see `docs/day1-plan.md`); game code lives under `src/game/`, with scenes in `src/game/scenes/`.

**Phaser is 3.90.0** — use Phaser 3 APIs only. Two things about it constrain the code:

- **Import it as `import * as Phaser from 'phaser'`.** The ESM build Vite resolves (`dist/phaser.esm.js`) has named exports and *no default export*, so `import Phaser from 'phaser'` compiles but is `undefined` at runtime.
- **No physics system is enabled.** The game config has no `physics` key on purpose. The player controller is hand-written — it integrates its own velocity and resolves its own AABB collisions — so coyote time, jump buffering and variable jump height stay frame-exact. Do not reach for Arcade.

There is no `vite.config.ts`, so Vite defaults apply: project root is the repo root, `public/` is served at `/`, and `index.html` is the single entry point.

## Tuning values are live

Most of `constants.ts` is `export const`. The eight values the F1 panel
edits (`JUMP_VELOCITY`, `GRAVITY`, `FALL_GRAVITY_MULT`, `JUMP_CUT`,
`MAX_SPEED`, `ACCEL`, `DECEL`, `DASH_SPEED`) are `export let`, written
only through `setTuning()`. ESM exports are live bindings, so reassigning
one is seen by every importer, including in the production bundle.

The rule that follows: **never cache a tunable at module load.** A
`const X = SOME_TUNABLE * 2` at the top of a file freezes the value at
import and the panel stops working for it. This is why `Player.ts` converts
the millisecond timers to seconds where they are used rather than once at
the top, and why those timers are not on the tunable list.

## TypeScript configuration constraints

`tsconfig.json` is bundler-mode and stricter than default in ways that change how code must be written:

- **`allowImportingTsExtensions`** — relative imports of local modules include the extension (`./game/constants.ts`), as `src/main.ts` does. Keep that convention.
- **`verbatimModuleSyntax`** — type-only imports must be written `import type { ... }`; a plain `import` of a type will not be elided and breaks at runtime.
- **`erasableSyntaxOnly`** — no enums, namespaces, parameter properties (`constructor(private x: T)`), or other syntax that emits runtime code. Relevant when writing Phaser scene classes: declare and assign fields explicitly in the constructor or `create()`.
- **`noUnusedLocals` / `noUnusedParameters`** — unused bindings are build failures, not warnings.
- **`noEmit`** — `tsc` only checks; Vite/esbuild does the transpiling. `include` is `["src"]`, so files outside `src/` are never type-checked.

## Assets

Two distinct asset paths, and the choice matters for Phaser:

- `src/assets/*` — imported in code (`import heroImg from './assets/hero.png'`), hashed and bundled by Vite.
- `public/*` — copied verbatim, referenced by absolute URL (`/icons.svg`), no hashing.

Phaser loaders (`this.load.image(...)`) take runtime URL strings, so game assets generally belong in `public/` unless the URL comes from a Vite import.
