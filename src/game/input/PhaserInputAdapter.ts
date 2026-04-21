import type Phaser from 'phaser';
import type { InputState } from '../../simulation/types';
import { loadKeyBindings, type KeyBindings } from '../../input/keyBindings';

/**
 * Translates Phaser keyboard events into the simulation's InputState.
 * Behavioral parity with src/input/inputManager.ts: held set, justPressed set,
 * double-tap run detection within [30ms, 250ms), fullscreen toggle signal,
 * clearJustPressed() called after every tickSimulation, and a blur reset.
 *
 * Listens via scene.input.keyboard (Phaser's plugin) rather than raw window
 * events so the listeners auto-detach on scene shutdown.
 */
export class PhaserInputAdapter {
  private bindings: KeyBindings;

  private keys = new Set<string>();
  private justPressed = new Set<string>();

  private lastLeftPressMs = 0;
  private lastRightPressMs = 0;
  private runningLeft = false;
  private runningRight = false;

  private keyboard: Phaser.Input.Keyboard.KeyboardPlugin | undefined;
  private windowBlurHandler: (() => void) | undefined;

  constructor(scene: Phaser.Scene) {
    this.bindings = loadKeyBindings();

    this.keyboard = scene.input.keyboard ?? undefined;
    if (!this.keyboard) return;

    this.keyboard.on('keydown', this.onKeyDown);
    this.keyboard.on('keyup', this.onKeyUp);

    this.windowBlurHandler = () => this.reset();
    window.addEventListener('blur', this.windowBlurHandler);
  }

  updateBindings(bindings: KeyBindings): void {
    this.bindings = bindings;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key;
    const isBound = Object.values(this.bindings).includes(key);
    if (isBound) event.preventDefault();

    if (!this.keys.has(key)) {
      this.justPressed.add(key);
    }
    this.keys.add(key);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key;
    this.keys.delete(key);
    if (key === this.bindings.left) this.runningLeft = false;
    if (key === this.bindings.right) this.runningRight = false;
  };

  private reset(): void {
    this.keys.clear();
    this.justPressed.clear();
    this.runningLeft = false;
    this.runningRight = false;
  }

  getInputState(nowMs: number): InputState {
    const b = this.bindings;
    const leftKey = b.left;
    const rightKey = b.right;

    let testAbilitySlot: number | null = null;
    for (let slot = 1; slot <= 6; slot++) {
      if (this.justPressed.has(String(slot))) {
        testAbilitySlot = slot;
        break;
      }
    }

    const leftJustPressed = this.justPressed.has(leftKey);
    const rightJustPressed = this.justPressed.has(rightKey);

    if (leftJustPressed) {
      const dt = nowMs - this.lastLeftPressMs;
      this.runningLeft = dt < 250 && dt > 30;
      this.lastLeftPressMs = nowMs;
    }
    if (rightJustPressed) {
      const dt = nowMs - this.lastRightPressMs;
      this.runningRight = dt < 250 && dt > 30;
      this.lastRightPressMs = nowMs;
    }

    if (!this.keys.has(leftKey) && !this.keys.has(rightKey)) {
      this.runningLeft = false;
      this.runningRight = false;
    }

    return {
      left: this.keys.has(leftKey),
      right: this.keys.has(rightKey),
      up: this.keys.has(b.up),
      down: this.keys.has(b.down),
      jump: this.keys.has(b.jump),
      attack: this.keys.has(b.attack),
      block: this.keys.has(b.block),
      grab: this.keys.has(b.grab),
      pause: this.keys.has(b.pause),
      leftJustPressed,
      rightJustPressed,
      jumpJustPressed: this.justPressed.has(b.jump),
      attackJustPressed: this.justPressed.has(b.attack),
      blockJustPressed: this.justPressed.has(b.block),
      grabJustPressed: this.justPressed.has(b.grab),
      pauseJustPressed: this.justPressed.has(b.pause),
      fullscreenToggleJustPressed: this.justPressed.has(b.fullscreen),
      lastLeftPressMs: this.lastLeftPressMs,
      lastRightPressMs: this.lastRightPressMs,
      runningLeft: this.runningLeft,
      runningRight: this.runningRight,
      testAbilitySlot,
    };
  }

  clearJustPressed(): void {
    this.justPressed.clear();
  }

  dispose(): void {
    if (this.keyboard) {
      this.keyboard.off('keydown', this.onKeyDown);
      this.keyboard.off('keyup', this.onKeyUp);
      this.keyboard = undefined;
    }
    if (this.windowBlurHandler) {
      window.removeEventListener('blur', this.windowBlurHandler);
      this.windowBlurHandler = undefined;
    }
    this.reset();
  }
}
