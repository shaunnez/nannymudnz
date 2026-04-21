import type { InputState } from '../simulation/types';
import type { KeyBindings } from './keyBindings';

export class InputManager {
  private keys: Set<string> = new Set();
  private justPressed: Set<string> = new Set();
  private bindings: KeyBindings;

  private lastLeftPressMs = 0;
  private lastRightPressMs = 0;
  private runningLeft = false;
  private runningRight = false;

  constructor(bindings: KeyBindings) {
    this.bindings = bindings;
    this.attachListeners();
  }

  updateBindings(bindings: KeyBindings): void {
    this.bindings = bindings;
  }

  private attachListeners(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const key = e.key;

    const isGameKey = Object.values(this.bindings).includes(key);
    if (isGameKey) {
      e.preventDefault();
    }

    if (!this.keys.has(key)) {
      this.justPressed.add(key);
    }
    this.keys.add(key);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key);
    const lb = this.bindings.left;
    const rb = this.bindings.right;
    if (e.key === lb) this.runningLeft = false;
    if (e.key === rb) this.runningRight = false;
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.justPressed.clear();
    this.runningLeft = false;
    this.runningRight = false;
  };

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
      if (dt < 250 && dt > 30) this.runningLeft = true;
      else this.runningLeft = false;
      this.lastLeftPressMs = nowMs;
    }
    if (rightJustPressed) {
      const dt = nowMs - this.lastRightPressMs;
      if (dt < 250 && dt > 30) this.runningRight = true;
      else this.runningRight = false;
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
}
