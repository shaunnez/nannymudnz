import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputSender } from '../InputSender';
import type { InputState } from '@nannymud/shared/simulation/types';
import type { Room } from '@colyseus/sdk';
import type { MatchState } from '@nannymud/shared';

function makeInput(overrides: Partial<InputState> = {}): InputState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, attack: false, block: false, grab: false, pause: false,
    leftJustPressed: false, rightJustPressed: false,
    jumpJustPressed: false, attackJustPressed: false, blockJustPressed: false,
    grabJustPressed: false, pauseJustPressed: false,
    fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0, lastRightPressMs: 0,
    runningLeft: false, runningRight: false,
    testAbilitySlot: null,
    ...overrides,
  };
}

describe('InputSender', () => {
  const mockSend = vi.fn();
  const mockRoom = { send: mockSend } as unknown as Room<MatchState>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('first update (no prev frame) produces no events', () => {
    const sender = new InputSender(mockRoom);
    sender.update(makeInput({ attackJustPressed: true, attack: true }), 100);
    expect(sender.getBufferedEvents()).toHaveLength(0);
  });

  it('attack false → true across two updates produces one attackDown event', () => {
    const sender = new InputSender(mockRoom);
    sender.update(makeInput({ attackJustPressed: false }), 100);
    sender.update(makeInput({ attackJustPressed: true, attack: true }), 116);
    const events = sender.getBufferedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'attackDown', tMs: 116 });
  });

  it('attack held (true → true) produces no duplicate event', () => {
    const sender = new InputSender(mockRoom);
    sender.update(makeInput({ attackJustPressed: true, attack: true }), 100);
    sender.update(makeInput({ attackJustPressed: true, attack: true }), 116);
    expect(sender.getBufferedEvents()).toHaveLength(0);
  });

  it('attack up (true → false) produces attackUp event', () => {
    const sender = new InputSender(mockRoom);
    sender.update(makeInput({ attackJustPressed: true, attack: true }), 100);
    sender.update(makeInput({ attackJustPressed: false, attack: false }), 116);
    const events = sender.getBufferedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'attackUp', tMs: 116 });
  });

  it('jump, block, grab edges are detected', () => {
    const sender = new InputSender(mockRoom);
    sender.update(makeInput(), 0);
    sender.update(makeInput({ jumpJustPressed: true, blockJustPressed: true, grabJustPressed: true }), 16);
    const types = sender.getBufferedEvents().map(e => e.type);
    expect(types).toContain('jumpDown');
    expect(types).toContain('blockDown');
    expect(types).toContain('grabDown');
  });

  it('ability slot activation emits abilityDown with correct key', () => {
    const sender = new InputSender(mockRoom);
    sender.update(makeInput({ testAbilitySlot: null }), 0);
    sender.update(makeInput({ testAbilitySlot: 2 }), 16);
    const events = sender.getBufferedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'abilityDown', key: '2', tMs: 16 });
  });

  it('send() calls room.send with incrementing sequenceId and clears events', () => {
    const sender = new InputSender(mockRoom);
    const state = makeInput();
    sender.update(makeInput(), 0);
    sender.update(makeInput({ attackJustPressed: true }), 16);

    sender.send(state);
    expect(mockSend).toHaveBeenCalledOnce();
    const firstCall = mockSend.mock.calls[0];
    expect(firstCall[0]).toBe('input');
    expect(firstCall[1].sequenceId).toBe(1);
    expect(firstCall[1].events).toHaveLength(1);

    sender.send(state);
    const secondCall = mockSend.mock.calls[1];
    expect(secondCall[1].sequenceId).toBe(2);
    expect(secondCall[1].events).toHaveLength(0);
  });

  it('send() sequenceId increments on each call', () => {
    const sender = new InputSender(mockRoom);
    const state = makeInput();
    sender.send(state);
    sender.send(state);
    sender.send(state);
    expect(mockSend.mock.calls[0][1].sequenceId).toBe(1);
    expect(mockSend.mock.calls[1][1].sequenceId).toBe(2);
    expect(mockSend.mock.calls[2][1].sequenceId).toBe(3);
  });
});
