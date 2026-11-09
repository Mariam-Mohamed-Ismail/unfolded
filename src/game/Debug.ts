import * as Phaser from 'phaser'
import type { Audio } from './Audio.ts'
import type { Input } from './Input.ts'
import type { Player, Solid } from './Player.ts'
import { DASH_SPEED, DASH_TIME, TUNABLES, getTuning, setTuning } from './constants.ts'

/**
 * F1 overlay: a state readout, the hitboxes the controller actually uses,
 * and a list of values you can change while the game runs.
 */
export class Debug {
  visible = false

  private index = 0
  private text: Phaser.GameObjects.Text
  private gfx: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics()
    this.gfx.setDepth(1000)

    this.text = scene.add.text(8, 8, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#0d1a12',
      backgroundColor: 'rgba(255, 255, 255, 0.78)',
      padding: { x: 6, y: 5 },
    })
    this.text.setDepth(1001).setScrollFactor(0)

    this.apply()
  }

  toggle(): void {
    this.visible = !this.visible
    this.apply()
  }

  /** Cursor and value edits. Ignored while the overlay is hidden. */
  handle(input: Input): void {
    if (!this.visible) return

    const n = TUNABLES.length
    if (input.panelPrev) this.index = (this.index + n - 1) % n
    if (input.panelNext) this.index = (this.index + 1) % n

    let steps = 0
    if (input.panelDown) steps -= 1
    if (input.panelUp) steps += 1
    if (input.panelDownBig) steps -= 10
    if (input.panelUpBig) steps += 10
    if (steps === 0) return

    const t = TUNABLES[this.index]
    const raw = getTuning(t.key) + t.step * steps
    // Repeated float steps drift (0.45 + 0.05 is not 0.5), so snap to the
    // precision the field is displayed at.
    const snapped = Number(
      Phaser.Math.Clamp(raw, t.min, t.max).toFixed(t.decimals),
    )
    setTuning(t.key, snapped)
  }

  update(player: Player, solids: Solid[], fps: number, audio: Audio): void {
    if (!this.visible) return
    this.drawBoxes(player, solids)
    this.text.setText(this.lines(player, fps, audio))
  }

  private apply(): void {
    this.text.setVisible(this.visible)
    this.gfx.setVisible(this.visible)
    if (!this.visible) this.gfx.clear()
  }

  private drawBoxes(player: Player, solids: Solid[]): void {
    this.gfx.clear()

    this.gfx.lineStyle(1, 0xffffff, 0.35)
    for (const s of solids) this.gfx.strokeRect(s.x, s.y, s.w, s.h)

    // The box the controller collides with, which is not the drawn figure:
    // squash and stretch never touch this.
    const hw = player.halfW()
    const hh = player.halfH()
    this.gfx.lineStyle(1, 0xff3b6b, 1)
    this.gfx.strokeRect(player.x - hw, player.y - hh, hw * 2, hh * 2)
  }

  private lines(player: Player, fps: number, audio: Audio): string {
    const d = player.debugInfo()
    const a = audio.state()
    const n2 = (v: number) => v.toFixed(1).padStart(7)
    const rows = [
      `x${n2(player.x)}  y${n2(player.y)}  vx${n2(player.vx)}  vy${n2(player.vy)}`,
      `${d.state.padEnd(7)} ${player.grounded ? 'grounded' : 'airborne'}  face ${player.facing > 0 ? '+' : '-'}  ${Math.round(fps)}fps`,
      `coyote ${d.coyote.toFixed(2)}  buffer ${d.buffer.toFixed(2)}`,
      // Availability, not just the cooldown: the cooldown cannot see a
      // spent air dash or a fold.
      `dash ${d.dashReady ? 'READY' : 'no   '}  cd ${d.dashWait.toFixed(2)}  air ${d.airDashUsed ? 'spent' : 'ok'}  t ${d.dashing.toFixed(2)}`,
      `dash reach ${Math.round((DASH_SPEED * DASH_TIME) / 1000)}px`,
      `audio ${a.context}  ${a.muted ? 'MUTED' : 'on'}  played ${a.played}`,
      '',
    ]

    for (let i = 0; i < TUNABLES.length; i++) {
      const t = TUNABLES[i]
      const value = getTuning(t.key).toFixed(t.decimals).padStart(8)
      rows.push(`${i === this.index ? '>' : ' '} ${t.key.padEnd(18)}${value}`)
    }

    rows.push('')
    rows.push(', . pick   [ ] step   - = x10')
    rows.push('backspace respawn   M mute   F1 close')
    return rows.join('\n')
  }
}
