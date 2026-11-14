# Recorded solutions

One JSON file per room, named by room id (`1a.json`, `2c.json`), written here
by **F2** in the dev build and read back by **F3**.

They are *not* imported by the game. The dev server in
[vite.config.ts](../../../vite.config.ts) serves them over `/__solutions/<room>`,
which keeps them out of the module graph — so recording one cannot trigger an
HMR reload in the middle of a session.

Each file holds the room, the level it belongs to, the step rate, the number of
steps, the eleven live-tunable numbers as they were, and the input as
`[step, action, down]` triples. A recording is only valid against the tuning it
was made with, which is why those numbers travel with it: F3 refuses a file
whose tuning has drifted and names the values that moved.
