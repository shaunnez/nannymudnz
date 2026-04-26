import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation, createEnemyActor } from '../simulation';
import type { InputState, Pickup } from '../types';

function idleInput(): InputState {
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
  };
}

function attackInput(): InputState {
  return { ...idleInput(), attack: true, attackJustPressed: true };
}

function grabInput(): InputState {
  return { ...idleInput(), grab: true, grabJustPressed: true };
}

function makePickup(type: Pickup['type'], heldBy: string): Pickup {
  return { id: 'w_1', type, x: 0, y: 0, z: 0, hitsLeft: 999, heldBy };
}

describe('weapon attack override', () => {
  it('bat extends attack range — hits enemy at 58u that default range 55 would miss', () => {
    const state = createInitialState('adventurer', 'assembly', 1);
    state.timeMs = 1000; // advance past attack cooldown
    state.player.facing = 1;

    // enemy at x + 58, exactly within bat range (60) but outside default (55)
    const enemy = createEnemyActor('plains_bandit', state.player.x + 58, state.player.y, state);
    enemy.hp = 500; enemy.hpMax = 500; enemy.armor = 0; enemy.magicResist = 0;

    // Without weapon — enemy at 58 should NOT be hit (55 range)
    const noWeaponState = tickSimulation(
      { ...state, controllers: {}, enemies: [{ ...enemy }] },
      attackInput(),
      16,
    );
    expect(noWeaponState.enemies[0].hp).toBe(500);

    // With bat (range 60) — enemy at 58 SHOULD be hit
    const batState = tickSimulation(
      { ...state, controllers: {}, enemies: [{ ...enemy }], player: { ...state.player, heldPickup: makePickup('bat', state.player.id) } },
      attackInput(),
      16,
    );
    expect(batState.enemies[0].hp).toBeLessThan(500);
  });

  it('axe applies stun hitEffect on melee hit', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.timeMs = 1000;
    state.player.facing = 1;
    state.player.heldPickup = makePickup('axe', state.player.id);

    const enemy = createEnemyActor('plains_bandit', state.player.x + 40, state.player.y, state);
    enemy.hp = 500; enemy.hpMax = 500; enemy.armor = 0; enemy.magicResist = 0;
    state.enemies = [enemy];

    state = tickSimulation(state, attackInput(), 16);
    const stunEffect = state.enemies[0].statusEffects.find(e => e.type === 'stun');
    expect(stunEffect).toBeDefined();
  });

  it('throwing_star fires a projectile on attack press instead of melee swing', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.timeMs = 1000;
    state.player.facing = 1;
    state.player.heldPickup = makePickup('throwing_star', state.player.id);

    const projCountBefore = state.projectiles.length;
    state = tickSimulation(state, attackInput(), 16);

    expect(state.projectiles.length).toBe(projCountBefore + 1);
    expect(state.projectiles[state.projectiles.length - 1].type).toBe('thrown_throwing_star');
    expect(state.player.heldPickup).toBeNull();
  });

  it('chain cannot be thrown — pressing grab drops it to ground', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    const chain: Pickup = { id: 'chain_1', type: 'chain', x: 0, y: 0, z: 0, hitsLeft: 999, heldBy: state.player.id };
    state.player.heldPickup = chain;

    const projCountBefore = state.projectiles.length;
    state = tickSimulation(state, grabInput(), 16);

    expect(state.projectiles.length).toBe(projCountBefore);
    expect(state.player.heldPickup).toBeNull();
    expect(state.pickups.some(p => p.type === 'chain')).toBe(true);
  });
});
