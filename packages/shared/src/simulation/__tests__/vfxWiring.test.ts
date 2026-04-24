import { describe, it, expect } from 'vitest';
import { tickSimulation } from '../simulation';
import { createVsState } from '../vsSimulation';
import type { InputState } from '../types';

function idleInput(): InputState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, attack: false, block: false, grab: false, pause: false,
    leftJustPressed: false, rightJustPressed: false, jumpJustPressed: false,
    attackJustPressed: false, blockJustPressed: false, grabJustPressed: false,
    pauseJustPressed: false, fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0, lastRightPressMs: 0,
    runningLeft: false, runningRight: false,
    testAbilitySlot: null,
  };
}

describe('projectile hit_spark carries guildId and assetKey', () => {
  it('frostbolt hit_spark has guildId=mage and assetKey=frostbolt_impact', () => {
    let state = createVsState('mage', 'knight', 'assembly', 1);

    // Advance past intro phase (1500ms) so handlePlayerInput is active
    for (let i = 0; i < 120; i++) state = tickSimulation(state, idleInput(), 16);

    state.player.mp = state.player.mpMax;

    // frostbolt is mage ability index 1 → slot 2
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 2 };
    state = tickSimulation(state, fireInput, 16);

    expect(state.projectiles.length).toBeGreaterThan(0);
    expect(state.projectiles[0].guildId).toBe('mage');

    // Tick until the projectile hits (≤400u range, speed 450/s ≈ 56 ticks @ 16ms)
    for (let i = 0; i < 60; i++) {
      state = tickSimulation(state, idleInput(), 16);
      const hit = state.vfxEvents.filter(
        e => e.type === 'hit_spark' && e.guildId === 'mage' && e.assetKey === 'frostbolt_impact',
      );
      if (hit.length > 0) return;
    }
    throw new Error('No enriched hit_spark found after 60 ticks');
  });
});

describe('blink fires aoe_pop flash at destination', () => {
  it('blink aoe_pop has guildId=mage and assetKey=blink_flash', () => {
    let state = createVsState('mage', 'knight', 'assembly', 1);
    state.player.mp = state.player.mpMax;

    // advance past VS intro (150 ticks)
    for (let i = 0; i < 150; i++) {
      state = tickSimulation(state, idleInput(), 16);
    }

    // blink is mage ability index 2 → slot 3
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 3 };
    state = tickSimulation(state, fireInput, 16);

    const flash = state.vfxEvents.filter(
      e => e.type === 'aoe_pop' && e.guildId === 'mage' && e.assetKey === 'blink_flash',
    );
    expect(flash.length).toBeGreaterThan(0);
  });
});

describe('class_swap fires aoe_pop burst', () => {
  it('class_swap aoe_pop has assetKey=class_swap_burst', () => {
    let state = createVsState('master', 'knight', 'assembly', 1);
    state.player.mp = state.player.mpMax;

    // advance past VS intro
    for (let i = 0; i < 150; i++) {
      state = tickSimulation(state, idleInput(), 16);
    }

    // class_swap is master rmb → slot > 5 (e.g., 6)
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 6 };
    state = tickSimulation(state, fireInput, 16);

    const burst = state.vfxEvents.filter(
      e => e.type === 'aoe_pop' && e.guildId === 'master' && e.assetKey === 'class_swap_burst',
    );
    expect(burst.length).toBeGreaterThan(0);
  });
});

describe('ground-target detonation', () => {
  it('meteor enters casting state on fire', () => {
    let state = createVsState('mage', 'knight', 'assembly', 1);
    state.player.mp = 100;

    // advance past VS intro
    for (let i = 0; i < 150; i++) {
      state = tickSimulation(state, idleInput(), 16);
    }

    // meteor is mage ability index 4 → slot 5
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 5 };
    state = tickSimulation(state, fireInput, 16);

    expect(state.player.state).toBe('casting');
  });

  it('meteor detonates with aoe_pop after 1200ms', () => {
    let state = createVsState('mage', 'knight', 'assembly', 1);
    state.player.mp = 100;

    for (let i = 0; i < 150; i++) {
      state = tickSimulation(state, idleInput(), 16);
    }

    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 5 };
    state = tickSimulation(state, fireInput, 16);

    // Tick 1200ms + buffer (80 ticks × 16ms = 1280ms); accumulate events per-tick
    const allEvents: typeof state.vfxEvents = [];
    for (let i = 0; i < 80; i++) {
      state = tickSimulation(state, idleInput(), 16);
      allEvents.push(...state.vfxEvents);
    }

    const impact = allEvents.filter(
      e => e.type === 'aoe_pop' && e.guildId === 'mage' && e.assetKey === 'meteor_impact',
    );
    expect(impact.length).toBeGreaterThan(0);
    expect(state.player.state).not.toBe('casting');
  });

  it('bear_trap (castTimeMs=0) detonates immediately with aoe_pop', () => {
    let state = createVsState('hunter', 'knight', 'assembly', 1);
    state.player.mp = 50;

    for (let i = 0; i < 150; i++) {
      state = tickSimulation(state, idleInput(), 16);
    }

    // bear_trap is hunter ability index 3 → slot 4
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 4 };
    state = tickSimulation(state, fireInput, 16);

    const snap = state.vfxEvents.filter(
      e => e.type === 'aoe_pop' && e.guildId === 'hunter' && e.assetKey === 'bear_trap_snap',
    );
    expect(snap.length).toBeGreaterThan(0);
    expect(state.player.state).not.toBe('casting');
  });
});

describe('misplaced-PNG abilities fire correct sprites', () => {
  it('vampire hemorrhage hit_spark has assetKey=hemorrhage_burst', () => {
    let state = createVsState('vampire', 'knight', 'assembly', 1);
    state.player.mp = state.player.mpMax;

    for (let i = 0; i < 150; i++) {
      state = tickSimulation(state, idleInput(), 16);
    }

    // hemorrhage is vampire ability index 0 → slot 1
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 1 };
    state = tickSimulation(state, fireInput, 16);

    expect(state.projectiles.length).toBeGreaterThan(0);

    for (let i = 0; i < 60; i++) {
      state = tickSimulation(state, idleInput(), 16);
      const hit = state.vfxEvents.filter(
        e => e.type === 'hit_spark' && e.guildId === 'vampire' && e.assetKey === 'hemorrhage_burst',
      );
      if (hit.length > 0) return;
    }
    throw new Error('No hemorrhage hit_spark found');
  });

  it('cultist whispers hit_spark has assetKey=whispers_aura', () => {
    let state = createVsState('cultist', 'knight', 'assembly', 1);

    for (let i = 0; i < 150; i++) {
      state = tickSimulation(state, idleInput(), 16);
    }

    // whispers is cultist ability index 1 → slot 2
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 2 };
    state = tickSimulation(state, fireInput, 16);

    expect(state.projectiles.length).toBeGreaterThan(0);

    for (let i = 0; i < 60; i++) {
      state = tickSimulation(state, idleInput(), 16);
      const hit = state.vfxEvents.filter(
        e => e.type === 'hit_spark' && e.guildId === 'cultist' && e.assetKey === 'whispers_aura',
      );
      if (hit.length > 0) return;
    }
    throw new Error('No whispers hit_spark found');
  });
});
