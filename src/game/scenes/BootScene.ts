import * as Phaser from 'phaser'
import { Audio } from '../Audio.ts'
import { Flow } from '../Flow.ts'

/**
 * Nothing to load — every pixel in this game is drawn in code — so Boot is
 * where the things that have to outlive a scene are made.
 *
 * Audio especially: it owns the AudioContext and the one-shot window
 * listeners that unlock it, so built per scene it would open a second
 * context on every menu-to-game transition and forget the mute setting.
 * It goes in the game registry, which is Phaser's own cross-scene store,
 * rather than a module singleton.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    const audio = new Audio()
    const flow = new Flow(this.game)
    this.registry.set('audio', audio)
    this.registry.set('flow', flow)
    // Straight through, with no fade: there is nothing to fade from.
    this.scene.start('MainMenu')
  }
}
