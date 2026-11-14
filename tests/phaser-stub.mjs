// A stand-in for Phaser, so game code can be imported and driven in Node.
// Only the handful of things the non-scene code actually touches.
export const Math = {
  Clamp: (v, min, max) => (v < min ? min : v > max ? max : v),
}
export class Scene {
  constructor(key) {
    this.sceneKey = key
  }
}
export const GameObjects = {}
export const Cameras = {
  Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } },
}
