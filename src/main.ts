import * as Phaser from 'phaser'
import './style.css'
import { COLOR_BG, GAME_HEIGHT, GAME_WIDTH } from './game/constants.ts'
import { BootScene } from './game/scenes/BootScene.ts'
import { GameScene } from './game/scenes/GameScene.ts'
import { LevelCompleteScene } from './game/scenes/LevelCompleteScene.ts'
import { MainMenuScene } from './game/scenes/MainMenuScene.ts'
import { PauseScene } from './game/scenes/PauseScene.ts'

// No `physics` key: the player controller is hand-written, so Arcade never
// gets to own gravity, drag or collision separation.
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: COLOR_BG,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  // Boot runs first and hands off to the menu; after that, Flow decides.
  scene: [BootScene, MainMenuScene, GameScene, PauseScene, LevelCompleteScene],
  // All sound is hand-built Web Audio in Audio.ts, so Phaser's sound
  // manager would only be a second audio context doing nothing.
  audio: { noAudio: true },
}

/**
 * Show errors on the page instead of losing them.
 *
 * Phaser drives the game from a requestAnimationFrame callback, and an
 * exception thrown inside it means the next frame is never requested: the
 * loop stops for good and all you see is a blank canvas with no clue why.
 * This puts the message where it cannot be missed.
 */
function showError(what: string): void {
  const box = document.createElement('pre')
  box.textContent = `Unfolded crashed:\n\n${what}\n\nReload the page to restart.`
  box.style.cssText = [
    'position:fixed',
    'inset:0',
    'margin:0',
    'padding:24px',
    'z-index:9999',
    'background:#2b2a33',
    'color:#f7f2e8',
    'font:13px/1.5 monospace',
    'white-space:pre-wrap',
    'overflow:auto',
  ].join(';')
  document.body.appendChild(box)
}

window.addEventListener('error', (e) => {
  showError(e.error?.stack ?? e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  showError(`unhandled promise rejection: ${e.reason?.stack ?? e.reason}`)
})

new Phaser.Game(config)
