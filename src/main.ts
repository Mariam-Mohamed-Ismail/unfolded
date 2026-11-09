import * as Phaser from 'phaser'
import './style.css'
import { COLOR_BG, GAME_HEIGHT, GAME_WIDTH } from './game/constants.ts'
import { GameScene } from './game/scenes/GameScene.ts'

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
  scene: [GameScene],
}

new Phaser.Game(config)
