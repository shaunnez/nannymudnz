import type Phaser from 'phaser';
import type { InputState } from '@nannymud/shared/simulation/types';
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
const TOUCH_ABILITY_EVENT = 'nannymud:touch-ability';
const TOUCH_PAUSE_EVENT = 'nannymud:touch-pause';
const TOUCH_JOYSTICK_EVENT = 'nannymud:touch-joystick';

export interface TouchJoystickState {
  left: boolean; right: boolean; up: boolean; down: boolean;
  runningLeft: boolean; runningRight: boolean;
}

/** Fire from React to trigger an ability slot tap (1–6). */
export function dispatchTouchAbility(slot: number): void {
  window.dispatchEvent(new CustomEvent(TOUCH_ABILITY_EVENT, { detail: slot }));
}

/** Fire from React to trigger the pause action. */
export function dispatchTouchPause(): void {
  window.dispatchEvent(new CustomEvent(TOUCH_PAUSE_EVENT));
}

/** Fire from the virtual joystick with current directional state. */
export function dispatchTouchJoystick(state: TouchJoystickState): void {
  window.dispatchEvent(new CustomEvent(TOUCH_JOYSTICK_EVENT, { detail: state }));
}

const TOUCH_BUTTON_EVENT = 'nannymud:touch-button';

export function dispatchTouchButton(action: 'attack' | 'block', pressed: boolean): void {
  window.dispatchEvent(new CustomEvent(TOUCH_BUTTON_EVENT, { detail: { action, pressed } }));
}

export class PhaserInputAdapter {
  private bindings: KeyBindings;

  private keys = new Set<string>();
  private justPressed = new Set<string>();

  private lastLeftPressMs = 0;
  private lastRightPressMs = 0;
  private runningLeft = false;
  private runningRight = false;

  private joystick: TouchJoystickState = {
    left: false, right: false, up: false, down: false,
    runningLeft: false, runningRight: false,
  };

  private touchAttack = false;
  private touchBlock = false;

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
    window.addEventListener(TOUCH_ABILITY_EVENT, this.onTouchAbility);
    window.addEventListener(TOUCH_PAUSE_EVENT, this.onTouchPause);
    window.addEventListener(TOUCH_JOYSTICK_EVENT, this.onTouchJoystick);
    window.addEventListener(TOUCH_BUTTON_EVENT, this.onTouchButton);
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

  private onTouchAbility = (e: Event): void => {
    const slot = (e as CustomEvent<number>).detail;
    this.justPressed.add(String(slot));
  };

  private onTouchPause = (): void => {
    this.justPressed.add(this.bindings.pause);
  };

  private onTouchJoystick = (e: Event): void => {
    this.joystick = (e as CustomEvent<TouchJoystickState>).detail;
  };

  private onTouchButton = (e: Event): void => {
    const { action, pressed } = (e as CustomEvent<{ action: 'attack' | 'block'; pressed: boolean }>).detail;
    const key = action === 'attack' ? this.bindings.attack : this.bindings.block;
    if (pressed) {
      this.justPressed.add(key);
      if (action === 'attack') this.touchAttack = true;
      else this.touchBlock = true;
    } else {
      if (action === 'attack') this.touchAttack = false;
      else this.touchBlock = false;
    }
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

    const j = this.joystick;
    return {
      left: this.keys.has(leftKey) || j.left,
      right: this.keys.has(rightKey) || j.right,
      up: this.keys.has(b.up) || j.up,
      down: this.keys.has(b.down) || j.down,
      jump: this.keys.has(b.jump),
      attack: this.keys.has(b.attack) || this.touchAttack,
      block: this.keys.has(b.block) || this.touchBlock,
      grab: this.keys.has(b.grab),
      pause: this.keys.has(b.pause),
      leftJustPressed,
      rightJustPressed,
      jumpJustPressed: this.justPressed.has(b.jump),
      attackJustPressed: this.justPressed.has(b.attack),
      blockJustPressed: this.justPressed.has(b.block),
      grabJustPressed: this.justPressed.has(b.grab),
      pauseJustPressed: this.justPressed.has(b.pause) || this.justPressed.has('Escape'),
      fullscreenToggleJustPressed: this.justPressed.has(b.fullscreen),
      lastLeftPressMs: this.lastLeftPressMs,
      lastRightPressMs: this.lastRightPressMs,
      runningLeft: this.runningLeft || j.runningLeft,
      runningRight: this.runningRight || j.runningRight,
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
    window.removeEventListener(TOUCH_ABILITY_EVENT, this.onTouchAbility);
    window.removeEventListener(TOUCH_PAUSE_EVENT, this.onTouchPause);
    window.removeEventListener(TOUCH_JOYSTICK_EVENT, this.onTouchJoystick);
    window.removeEventListener(TOUCH_BUTTON_EVENT, this.onTouchButton);
    this.reset();
  }
}
