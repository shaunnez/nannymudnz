import { describe, it, expect } from 'vitest';
import { createBattleState } from '../battleSimulation';
import { tickSimulation } from '../simulation';
import type { BattleSlot, InputState } from '../types';

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

const slots: BattleSlot[] = [
  { guildId: 'adventurer', type: 'human', team: null },
  { guildId: 'knight',     type: 'cpu',   team: null },
  { guildId: 'mage',       type: 'cpu',   team: null },
];

describe('createBattleState', () => {
  it('spawns enemies for each cpu slot', () => {
    const s = createBattleState('adventurer', slots, 'assembly', 1);
    expect(s.enemies.length).toBe(2);
  });

  it('sets battleMode true', () => {
    const s = createBattleState('adventurer', slots, 'assembly', 1);
    expect(s.battleMode).toBe(true);
  });

  it('starts with battleTimer at 180000ms', () => {
    const s = createBattleState('adventurer', slots, 'assembly', 1);
    expect(s.battleTimer).toBe(180_000);
  });

  it('does not have any waves', () => {
    const s = createBattleState('adventurer', slots, 'assembly', 1);
    expect(s.waves.length).toBe(0);
  });

  it('initialises battStats for player and each CPU enemy', () => {
    const s = createBattleState('adventurer', slots, 'assembly', 1);
    expect(s.battStats).not.toBeNull();
    expect(s.battStats!['player']).toBeDefined();
    expect(Object.keys(s.battStats!)).toHaveLength(3); // player + 2 cpu
  });

  it('enemies are isPlayer=true with team=enemy', () => {
    const s = createBattleState('adventurer', slots, 'assembly', 1);
    for (const e of s.enemies) {
      expect(e.isPlayer).toBe(true);
      expect(e.team).toBe('enemy');
    }
  });
});

describe('tickSimulation: battle mode', () => {
  it('decrements battleTimer each tick', () => {
    let s = createBattleState('adventurer', slots, 'assembly', 1);
    s = tickSimulation(s, idleInput(), 16);
    expect(s.battleTimer).toBe(180_000 - 16);
  });

  it('sets phase to victory when all enemies KO', () => {
    let s = createBattleState('adventurer', slots, 'assembly', 1);
    s.enemies.forEach((e) => { e.hp = 0; e.isAlive = false; });
    s = tickSimulation(s, idleInput(), 16);
    expect(s.phase).toBe('victory');
  });

  it('sets phase to defeat when player KO', () => {
    let s = createBattleState('adventurer', slots, 'assembly', 1);
    s.player.hp = 0;
    s.player.isAlive = false;
    s = tickSimulation(s, idleInput(), 16);
    expect(s.phase).toBe('defeat');
  });

  it('resolves by HP when timer expires — player wins with higher HP', () => {
    let s = createBattleState('adventurer', slots, 'assembly', 1);
    s.battleTimer = 1;
    s.player.hp = 9999;
    s.enemies.forEach((e) => { e.hp = 1; });
    s = tickSimulation(s, idleInput(), 50);
    expect(s.phase).toBe('victory');
  });

  it('resolves by HP when timer expires — defeat if enemy has more HP', () => {
    let s = createBattleState('adventurer', slots, 'assembly', 1);
    s.battleTimer = 1;
    s.player.hp = 1;
    s.enemies.forEach((e) => { e.hp = 9999; });
    s = tickSimulation(s, idleInput(), 50);
    expect(s.phase).toBe('defeat');
  });
});

describe('battleTeam assignment', () => {
  it('sets battleTeam on player from human slot', () => {
    const s = createBattleState('adventurer', [
      { guildId: 'adventurer', type: 'human', team: 'A' },
      { guildId: 'knight',     type: 'cpu',   team: 'B' },
    ], 'assembly', 1);
    expect(s.player.battleTeam).toBe('A');
    expect(s.enemies[0].battleTeam).toBe('B');
  });

  it('battleTeam undefined when slot team is null', () => {
    const s = createBattleState('adventurer', [
      { guildId: 'adventurer', type: 'human', team: null },
      { guildId: 'knight',     type: 'cpu',   team: null },
    ], 'assembly', 1);
    expect(s.player.battleTeam).toBeUndefined();
    expect(s.enemies[0].battleTeam).toBeUndefined();
  });
});

describe('team-aware victory condition', () => {
  const teamSlots: BattleSlot[] = [
    { guildId: 'adventurer', type: 'human', team: 'A' },
    { guildId: 'knight',     type: 'cpu',   team: 'A' }, // teammate → enemies[0]
    { guildId: 'mage',       type: 'cpu',   team: 'B' }, // foe      → enemies[1]
  ];

  it('killing only a teammate does not trigger victory', () => {
    let s = createBattleState('adventurer', teamSlots, 'assembly', 1);
    s.enemies[0].hp = 0;
    s.enemies[0].isAlive = false;
    s = tickSimulation(s, idleInput(), 16);
    expect(s.phase).not.toBe('victory');
  });

  it('killing all foes triggers victory even when teammate still alive', () => {
    let s = createBattleState('adventurer', teamSlots, 'assembly', 1);
    // Kill only the foe (team B mage, enemies[1])
    s.enemies[1].hp = 0;
    s.enemies[1].isAlive = false;
    s = tickSimulation(s, idleInput(), 16);
    expect(s.phase).toBe('victory');
  });

  it('timer resolution: player wins vs foes when player HP > max foe HP', () => {
    let s = createBattleState('adventurer', teamSlots, 'assembly', 1);
    s.battleTimer = 1;
    s.player.hp = 9999;
    s.enemies[1].hp = 1; // foe
    s = tickSimulation(s, idleInput(), 50);
    expect(s.phase).toBe('victory');
  });
});
