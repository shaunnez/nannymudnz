import { describe, it, expect } from 'vitest';
import {
  initChampionship, advanceBracket, simulateCpuMatch,
  getPlayerMatch, getOpponent,
} from '../championship';

describe('initChampionship', () => {
  it('creates 8 participants including the player guild', () => {
    const s = initChampionship('adventurer', 42);
    expect(s.participants.length).toBe(8);
    expect(s.participants).toContain('adventurer');
  });

  it('creates QF round with 4 matches', () => {
    const s = initChampionship('adventurer', 42);
    expect(s.rounds.length).toBe(3);
    expect(s.rounds[0].matches.length).toBe(4);
  });

  it('player guild appears in exactly one QF match', () => {
    const s = initChampionship('adventurer', 42);
    const playerMatches = s.rounds[0].matches.filter(
      m => m.p1 === 'adventurer' || m.p2 === 'adventurer',
    );
    expect(playerMatches.length).toBe(1);
  });

  it('non-player QF matches have a winner set immediately', () => {
    const s = initChampionship('adventurer', 42);
    const nonPlayer = s.rounds[0].matches.filter(
      m => m.p1 !== 'adventurer' && m.p2 !== 'adventurer',
    );
    nonPlayer.forEach(m => expect(m.winner).not.toBeNull());
  });

  it('player match starts with winner null', () => {
    const s = initChampionship('adventurer', 42);
    const pm = getPlayerMatch(s);
    expect(pm.winner).toBeNull();
  });

  it('getOpponent returns the non-player guild in the player match', () => {
    const s = initChampionship('knight', 42);
    const opp = getOpponent(s);
    expect(opp).not.toBe('knight');
    expect(typeof opp).toBe('string');
  });
});

describe('simulateCpuMatch', () => {
  it('returns one of the two guild ids', () => {
    const rng = () => 0.3;
    const result = simulateCpuMatch('adventurer', 'knight', rng);
    expect(['adventurer', 'knight']).toContain(result);
  });

  it('is deterministic for the same rng output', () => {
    const rng = () => 0.5;
    const r1 = simulateCpuMatch('adventurer', 'knight', rng);
    const r2 = simulateCpuMatch('adventurer', 'knight', rng);
    expect(r1).toBe(r2);
  });
});

describe('advanceBracket', () => {
  it('sets player match winner on win', () => {
    let s = initChampionship('adventurer', 42);
    s = advanceBracket(s, true);
    const pm = getPlayerMatch(s);
    expect(pm.winner).toBe('adventurer');
  });

  it('increments currentRound after player win', () => {
    let s = initChampionship('adventurer', 42);
    s = advanceBracket(s, true);
    expect(s.currentRound).toBe(1);
  });

  it('sets playerEliminated on loss', () => {
    let s = initChampionship('adventurer', 42);
    s = advanceBracket(s, false);
    expect(s.playerEliminated).toBe(true);
  });

  it('builds SF round from QF winners after player win', () => {
    let s = initChampionship('adventurer', 42);
    s = advanceBracket(s, true);
    expect(s.rounds[1].matches.length).toBe(2);
    s.rounds[1].matches.forEach(m => {
      expect(m.p1).toBeDefined();
      expect(m.p2).toBeDefined();
    });
  });
});
