import * as Phaser from 'phaser'
import {
  COLOR_PLAYER_LINE,
  PARTICLE_GRAVITY,
  PARTICLE_LIFE,
  PARTICLE_SIZE,
  PARTICLE_SPEED,
} from './constants.ts'

const LIFE = PARTICLE_LIFE / 1000

type Flake = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  rot: number
  spin: number
  size: number
  color: number
}

/**
 * Scraps of paper, drawn as little spinning triangles. One Graphics object
 * is cleared and redrawn each frame rather than one object per flake.
 */
export class Particles {
  private gfx: Phaser.GameObjects.Graphics
  private flakes: Flake[] = []

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics()
  }

  /**
   * `driftX` biases the spray, so a dash throws paper behind you. `color`
   * lets a purple thing shed purple paper; the default is the figure's ink.
   */
  burst(
    x: number,
    y: number,
    count: number,
    driftX = 0,
    color = COLOR_PLAYER_LINE,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = PARTICLE_SPEED * (0.4 + Math.random() * 0.6)
      const life = LIFE * (0.6 + Math.random() * 0.4)
      this.flakes.push({
        x,
        y,
        vx: Math.cos(angle) * speed + driftX,
        vy: Math.sin(angle) * speed - 40,
        life,
        max: life,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 12,
        size: PARTICLE_SIZE * (0.6 + Math.random() * 0.8),
        color,
      })
    }
  }

  update(dt: number): void {
    this.gfx.clear()

    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const f = this.flakes[i]
      f.life -= dt
      if (f.life <= 0) {
        this.flakes.splice(i, 1)
        continue
      }

      f.vy += PARTICLE_GRAVITY * dt
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.rot += f.spin * dt

      this.gfx.fillStyle(f.color, f.life / f.max)
      const a = f.rot
      const b = a + (Math.PI * 2) / 3
      const c = a + (Math.PI * 4) / 3
      this.gfx.fillTriangle(
        f.x + Math.cos(a) * f.size,
        f.y + Math.sin(a) * f.size,
        f.x + Math.cos(b) * f.size,
        f.y + Math.sin(b) * f.size,
        f.x + Math.cos(c) * f.size,
        f.y + Math.sin(c) * f.size,
      )
    }
  }
}
