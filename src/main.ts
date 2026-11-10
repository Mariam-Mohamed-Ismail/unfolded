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

new Phaser.Game(config)
