import { describe, it, expect } from 'vitest';
import { createVsState, resetActorsForRound } from '../vsSimulation';

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
