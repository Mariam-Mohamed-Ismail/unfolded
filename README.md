# UNFOLDED
### A 2D Origami Puzzle-Platformer

*A world of paper. A journey of transformation. One shape waiting to be found.*

Unfolded is a 2D origami-inspired puzzle-platformer developed for the **DU Studios Game Developer / Designer Practical Assignment**.

Play as a paper figure searching for its true shape. Explore a handcrafted paper world where every surface, enemy, obstacle, and ability is built around the art of origami.

Fold, flatten, cut, dash, and ride the wind to overcome challenges across **3 levels and 9 puzzle rooms**. Every mechanic is designed to make paper transformation an essential part of both movement and puzzle-solving.

All visuals, effects, and sound are procedurally generated in code, with no external image or audio assets required.

---

## Gameplay

Your shape is your greatest ability.

Unfolded combines precision platforming with environmental puzzles, encouraging players to experiment with different paper forms and use the world around them to progress.

### Core Mechanics

- **Fold & Unfold** — Activate switches to transform platforms, bridges, stairs, and walls.
- **Flatten** — Change into a flat paper form to slide through narrow openings and avoid obstacles.
- **Sword Combat** — Draw your sword to slash through special paper seals and face enemies.
- **Dash & Jump** — Combine movement abilities to navigate challenging platforming sections.
- **Ride the Wind** — Use fans and air currents to reach otherwise inaccessible areas.
- **Environmental Puzzles** — Observe, experiment, and discover how different objects interact.

### Enemies

Every enemy has its own behaviour and attack patterns:

- **Bats** — Dive toward your previous position, rewarding well-timed movement.
- **Snakes** — Disappear and reappear at glowing creases before launching an attack.

Every attack includes a visual warning, giving players an opportunity to react.

### Progression & Upgrades

After completing Level 1 and Level 2, choose between two different crease upgrades.

Each upgrade introduces a different playstyle and opens alternative approaches to gameplay. No upgrade is mandatory to complete the rooms.

### Room Ranking

Each room features a three-star scoring system:

- Complete the room.
- Beat the room's par time.
- Finish without taking damage or resetting.

---

## Controls

| Input | Action |
|---|---|
| A / D or Arrow Keys | Move |
| Space / W / Up | Jump |
| Shift | Air Dash |
| S / Down (Hold) | Flatten |
| R | Draw / Put Away Sword |
| Left Click / J | Sword Slash |
| Backspace | Reset Current Room |
| Esc | Pause Menu |
| M | Toggle Sound |
| F1 | Debug Overlay & Live Tuning |

*The sword becomes available after Level 1.*

---

## Getting Started

### Requirements

- Node.js 18 or newer
- npm
- A modern desktop browser (Chrome, Edge, Firefox, or Safari)

Check your Node.js installation:

```bash
node -v
```

If you don't have Node.js installed, download it from [nodejs.org](https://nodejs.org/).

### Run Locally

Install the project dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local address displayed in your terminal, usually:

```text
http://localhost:5173/
```

Click anywhere on the game page once to enable browser audio.

---

## Production Build

To create and preview the final production build:

```bash
npm install
npm run build
npm run preview
```

The production build will be generated inside the `dist/` directory.

The preview server will usually be available at:

```text
http://localhost:4173/
```

### Running Without Node.js

If the repository includes the pre-built `dist/` folder, you can run the game using Python:

```bash
cd dist
python -m http.server 8080
```

Then visit:

```text
http://localhost:8080/
```

On Windows, you can also use:

```bash
py -m http.server 8080
```

**Note:** Do not open `dist/index.html` directly by double-clicking it. Browsers may block the scripts when using the `file://` protocol. Always use a local HTTP server.

---

## Project Structure

```text
src/
├── main.ts
└── game/
    ├── constants.ts
    ├── Input.ts
    ├── Player.ts
    ├── Camera.ts
    ├── Particles.ts
    ├── Audio.ts
    ├── Debug.ts
    │
    ├── entities/
    │   └── Reusable puzzle objects and enemies
    │
    ├── levels/
    │   └── Level and room data
    │
    └── scenes/
        └── Menu, gameplay, pause, completion and ending

docs/
└── Design documents and development plans

dist/
└── Production build (if included)
```

### Architecture

The game uses a modular, data-driven structure.

- **Reusable Entities:** Puzzle objects, platforms, environmental interactions, and enemies are implemented as reusable components.
- **Data-Driven Levels:** Each level is defined through data files containing rooms, entities, and their connections.
- **Centralised Configuration:** Gameplay tuning values are organised in `constants.ts`.
- **Procedural Audio & Visuals:** Sound effects, particles, and game visuals are generated programmatically.

This approach makes it easier to expand the game by creating new room configurations and reusing existing mechanics rather than writing entirely new systems.

---

## Built With

| Technology | Purpose |
|---|---|
| [Phaser](https://phaser.io/) | 2D game framework |
| [TypeScript](https://www.typescriptlang.org/) | Game logic and development |
| [Vite](https://vite.dev/) | Development server and build tooling |
| Web Audio API | Procedurally generated sound |

All visuals and audio are generated in code. No external art or audio files are required.

---

## Useful Development Commands

| Command | Description |
|---|---|
| `npm install` | Install project dependencies |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and generate the production build |
| `npm run preview` | Preview the production build |
| `npx tsc --noEmit` | Run TypeScript type-checking |

---

## Troubleshooting

**The game displays a blank page**
- Make sure you are accessing the game through a local server rather than opening the HTML file directly.
- Open the browser console with F12 and check for errors.

**There is no sound**
- Click anywhere on the game page to allow the browser to initialise audio.
- Press M to check whether the game is muted.

**The development server cannot start**
- Another application may already be using the default port.
- Stop the other server with Ctrl+C or use the alternative address provided by Vite.

**npm install fails**
- Check your Node.js version using `node -v`.
- Make sure you are running Node.js 18 or newer.

---

## AI-Assisted Development

AI was used as a development assistant throughout the creation of Unfolded, in accordance with the assignment's guidelines.

The project was developed through an iterative process involving implementation, testing, refinement, and gameplay iteration.

The submission includes supporting development materials:

- AI conversation logs.
- Daily development screenshots.
- Game design documents.
- Development and build plans.
- Playtesting notes.

---

