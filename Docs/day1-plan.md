Day 1 plan: movement lane of Level 1

Files to end up with (all under src/game/): constants.ts, Input.ts, Player.ts, Camera.ts, Particles.ts, Audio.ts, Debug.ts, scenes/GameScene.ts, levels/level1.ts.

Step	What gets built	How you test it
1	Phaser mounts, 960x540 fit to window, a test scene with a floor and a rectangle player	Rectangle sits on the floor, window resize doesn’t break it
2	Input class and running (accel, decel, skid)	It speeds up and slows down smoothly, left and right
3	Jump: variable height, coyote time, jump buffer	A tap gives a short hop, a hold gives a full jump, a jump pressed just before landing still works
4	Dash (ground and air, cooldown, short freeze)	One air dash per jump, refreshes on landing
5	Flat form and the slit, with the 30 px headroom rule	You can’t get stuck under the pillar, and you can’t go through it standing
6	Movement lane built from level1.ts data (step, 2-tile block, 6-tile gap, slit pillar)	The gap needs a dash, a jump alone fails
7	Feel pass: triangle player, squash and stretch, particles, camera, shake	Landing and dashing feel punchy
8	Sound with Web Audio	Each sound plays once, M mutes
9	F1 debug overlay, live tuning panel, Backspace reset	You can change jump height while playing

Commit after every step. If step 6 shows the gap is too easy or too hard, fix the number and write down why. Days 2 and 3 are the three puzzle rooms (1A fold, 1B slit puzzle, 1C wind), so don’t start those today.

