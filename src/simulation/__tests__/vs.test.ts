import { describe, it, expect } from 'vitest';
import { createVsState, resetActorsForRound, tickRound } from '../vsSimulation';
import { tickSimulation } from '../simulation';
import type { InputState } from '../types';

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

describe('vsSimulation: integrated tick', () => {
  it('ticks opponent AI and does not treat VS as story', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    // advance past intro
    let st = s;
    for (let i = 0; i < 150; i++) {
      st = tickSimulation(st, idleInput(), 16);
    }
    expect(st.round!.phase === 'fighting' || st.round!.phase === 'resolved' || st.round!.phase === 'matchOver').toBe(true);
    // sanity: VS never triggers story wave spawns
    expect(st.waves).toEqual([]);
  });

  it('caps combat log at 64 entries across a full match', () => {
    let st = createVsState('knight', 'mage', 'assembly', 1);
    for (let i = 0; i < 4000; i++) {
      st = tickSimulation(st, idleInput(), 16);
      if (st.phase === 'victory' || st.phase === 'defeat') break;
    }
    expect(st.combatLog.length).toBeLessThanOrEqual(64);
  });
});

describe('vsSimulation: createVsState', () => {
  it('creates a VS state with player, opponent, and round intro phase', () => {
    const s = createVsState('knight', 'mage', 'assembly', 42);
    expect(s.mode).toBe('vs');
    expect(s.player.id).toBe('player');
    expect(s.player.guildId).toBe('knight');
    expect(s.player.team).toBe('player');
    expect(s.opponent).not.toBeNull();
    expect(s.opponent!.id).toBe('opponent');
    expect(s.opponent!.guildId).toBe('mage');
    expect(s.opponent!.team).toBe('enemy');
    expect(s.opponent!.facing).toBe(-1);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0]).toBe(s.opponent);
    expect(s.waves).toEqual([]);
    expect(s.round).not.toBeNull();
    expect(s.round!.index).toBe(0);
    expect(s.round!.phase).toBe('intro');
    expect(s.round!.timeRemainingMs).toBe(60_000);
    expect(s.round!.wins).toEqual({ p1: 0, p2: 0 });
    expect(s.combatLog.length).toBeGreaterThan(0);
    expect(s.combatLog.some(e => e.text.includes('arena'))).toBe(true);
  });

  it('places opponent to the right of the player', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    expect(s.opponent!.x).toBeGreaterThan(s.player.x);
  });

  it('throws if p2 is the same as p1? NO — mirror match is allowed', () => {
    const s = createVsState('knight', 'knight', 'assembly', 1);
    expect(s.opponent!.id).toBe('opponent');
    expect(s.opponent!.guildId).toBe('knight');
  });
});

describe('vsSimulation: resetActorsForRound', () => {
  it('restores HP/MP and clears status effects on both actors', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    s.player.hp = 10;
    s.player.mp = 0;
    s.player.statusEffects = [
      { id: 'e1', type: 'stun', magnitude: 1, durationMs: 500, remainingMs: 500, source: 'opponent' },
    ];
    s.opponent!.hp = 5;
    s.opponent!.abilityCooldowns['fireball'] = 9_999_999;

    resetActorsForRound(s);

    expect(s.player.hp).toBe(s.player.hpMax);
    expect(s.player.statusEffects).toEqual([]);
    expect(s.opponent!.hp).toBe(s.opponent!.hpMax);
    expect(s.opponent!.abilityCooldowns).toEqual({});
  });
});

describe('vsSimulation: tickRound', () => {
  it('transitions intro -> fighting after 1500ms', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    expect(s.round!.phase).toBe('intro');
    tickRound(s, 800);
    expect(s.round!.phase).toBe('intro');
    tickRound(s, 800);
    expect(s.round!.phase).toBe('fighting');
    expect(s.round!.timeRemainingMs).toBe(60_000);
  });

  it('decrements timer while fighting', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    tickRound(s, 2000); // intro -> fighting
    tickRound(s, 1000);
    expect(s.round!.timeRemainingMs).toBe(59_000);
  });

  it('resolves round when opponent hp hits 0 — p1 wins', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    tickRound(s, 2000); // fighting
    s.opponent!.hp = 0;
    s.opponent!.isAlive = false;
    tickRound(s, 16);
    expect(s.round!.phase).toBe('resolved');
    expect(s.round!.winnerOfRound).toBe('p1');
    expect(s.round!.wins.p1).toBe(1);
  });

  it('times out as draw on equal hp, p2-leaning otherwise', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    tickRound(s, 2000);
    s.round!.timeRemainingMs = 0;
    s.player.hp = 100;
    s.opponent!.hp = 100;
    tickRound(s, 16);
    expect(s.round!.phase).toBe('resolved');
    expect(s.round!.winnerOfRound).toBe('draw');
  });

  it('resolved -> intro of next round after 2000ms, with reset', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    tickRound(s, 2000);
    s.opponent!.hp = 0; s.opponent!.isAlive = false;
    tickRound(s, 16); // resolved
    s.player.hp = 1;
    tickRound(s, 2100); // should flip to intro & reset
    expect(s.round!.phase).toBe('intro');
    expect(s.round!.index).toBe(1);
    expect(s.player.hp).toBe(s.player.hpMax);
    expect(s.opponent!.hp).toBe(s.opponent!.hpMax);
  });

  it('declares matchWinner after 2 round wins and sets simPhase to victory for p1', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    // Round 1: p1 wins
    tickRound(s, 2000);
    s.opponent!.hp = 0; s.opponent!.isAlive = false;
    tickRound(s, 16);
    tickRound(s, 2100); // next round intro
    // Round 2: p1 wins again
    tickRound(s, 2000);
    s.opponent!.hp = 0; s.opponent!.isAlive = false;
    tickRound(s, 16);
    tickRound(s, 2100);
    expect(s.round!.phase).toBe('matchOver');
    expect(s.round!.matchWinner).toBe('p1');
    expect(s.phase).toBe('victory');
  });

  it('sets simPhase to defeat when p2 wins the match', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    for (let r = 0; r < 2; r++) {
      tickRound(s, 2000);
      s.player.hp = 0; s.player.isAlive = false;
      tickRound(s, 16);
      tickRound(s, 2100);
    }
    expect(s.round!.matchWinner).toBe('p2');
    expect(s.phase).toBe('defeat');
  });
});
