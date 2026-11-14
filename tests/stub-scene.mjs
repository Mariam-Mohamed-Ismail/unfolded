// Enough of a Phaser scene for the controller and the entities to run
// headless. Drawing calls are swallowed; only geometry and state are under
// test here.
const noop = () => gfx
const gfx = {
  clear: noop, fillStyle: noop, lineStyle: noop,
  fillTriangle: noop, strokeTriangle: noop,
  setPosition: noop, setScale: noop, setSize: noop, setOrigin: noop,
  setDepth: noop, setVisible: noop, strokeRect: noop, fillRect: noop,
  // Entity drawing: quads, dashes, rings.
  fillPoints: noop, strokePoints: noop, lineBetween: noop, strokeCircle: noop,
  destroy: noop,
}
const txt = {
  setText(v) { txt.value = v; return txt },
  setDepth: () => txt, setScrollFactor: () => txt, setVisible: () => txt,
  setPosition: () => txt, setOrigin: () => txt, setAlpha: () => txt,
  setColor: () => txt, destroy: () => txt,
  value: '',
}
export const text = txt
export const scene = {
  add: {
    graphics: () => gfx,
    rectangle: () => gfx,
    text: () => txt,
  },
}
