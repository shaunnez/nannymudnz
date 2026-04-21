import type Phaser from 'phaser';
import type { InputState } from '../../simulation/types';

/**
 * Translates Phaser keyboard events into the simulation's InputState struct.
 * Task 3 ships a stub that returns an all-false state; Task 4 fills it in with
 * held/justPressed tracking and double-tap run detection that mirror
 * src/input/inputManager.ts.
 */
export class PhaserInputAdapter {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Reference to keep the field live until Task 4 wires keyboard listeners.
    void this.scene;
  }

  getInputState(nowMs: number): InputState {
    void nowMs;
    return neutralInputState();
  }

  clearJustPressed(): void {
    // no-op until Task 4
  }

  dispose(): void {
    // no-op until Task 4
  }
}

function neutralInputState(): InputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    attack: false,
    block: false,
    grab: false,
    pause: false,
    leftJustPressed: false,
    rightJustPressed: false,
    jumpJustPressed: false,
    attackJustPressed: false,
    blockJustPressed: false,
    grabJustPressed: false,
    pauseJustPressed: false,
    fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0,
    lastRightPressMs: 0,
    runningLeft: false,
    runningRight: false,
    testAbilitySlot: null,
  };
}
