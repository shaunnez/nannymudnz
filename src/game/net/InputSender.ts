import type { Room } from 'colyseus.js';
import type { InputState } from '@nannymud/shared/simulation/types';
import type { InputEvent, InputMsg, MatchState } from '@nannymud/shared';

export class InputSender {
  private sequenceId = 0;
  private prev: InputState | null = null;
  private events: InputEvent[] = [];

  constructor(private room: Room<MatchState>) {}

  /**
   * Called once per sim tick. Diffs vs prev to detect justPressed edges.
   * InputState does not have per-ability justPressed booleans — it uses
   * `testAbilitySlot: number | null`. We detect a slot activation when the
   * slot is non-null and differs from the previous frame's slot (or prev was null).
   */
  update(current: InputState, tMs: number): void {
    if (this.prev) {
      if (!this.prev.attackJustPressed && current.attackJustPressed) {
        this.events.push({ type: 'attackDown', tMs });
      }
      if (this.prev.attackJustPressed && !current.attackJustPressed) {
        this.events.push({ type: 'attackUp', tMs });
      }
      if (!this.prev.jumpJustPressed && current.jumpJustPressed) {
        this.events.push({ type: 'jumpDown', tMs });
      }
      if (!this.prev.blockJustPressed && current.blockJustPressed) {
        this.events.push({ type: 'blockDown', tMs });
      }
      if (!this.prev.grabJustPressed && current.grabJustPressed) {
        this.events.push({ type: 'grabDown', tMs });
      }
      // Ability slot activation: emit when slot becomes non-null (rising edge)
      if (current.testAbilitySlot !== null && this.prev.testAbilitySlot !== current.testAbilitySlot) {
        this.events.push({ type: 'abilityDown', key: String(current.testAbilitySlot), tMs });
      }
    }
    // Store a shallow snapshot so next tick's diff is stable.
    this.prev = { ...current };
  }

  /** Ships the buffered events + current state over the wire, clears events. */
  send(state: InputState): void {
    const msg: InputMsg = { sequenceId: ++this.sequenceId, state, events: this.events };
    this.room.send('input', msg);
    this.events = [];
  }

  /** For tests/debug */
  getBufferedEvents(): readonly InputEvent[] {
    return this.events;
  }
}
