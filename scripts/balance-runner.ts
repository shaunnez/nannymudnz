/**
 * Headless balance runner.
 * Run: npx tsx scripts/balance-runner.ts
 *
 * Both sides use max-difficulty CPU AI (difficulty 5).
 * Runs MATCHES_PER_PAIR matches per guild pairing, alternating sides to cancel spawn bias.
 * Outputs: win-rate matrix to stdout + balance-output.csv alongside this file.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createVsState } from '../packages/shared/src/simulation/vsSimulation.js';
import { tickSimulation } from '../packages/shared/src/simulation/simulation.js';
import { synthesizeVsCpuInput, createEmptyCpuInput } from '../packages/shared/src/simulation/vsAI.js';
import type { GuildId, SimState } from '../packages/shared/src/simulation/types.js';

const GUILDS: GuildId[] = [
  'adventurer', 'knight', 'mage', 'druid', 'hunter', 'monk',
  'viking', 'prophet', 'vampire', 'cultist', 'champion', 'darkmage',
  'chef', 'leper', 'master',
];

const MATCHES_PER_PAIR = 20;
const MAX_DIFFICULTY = 5;
const TICK_DT = 16;
const MATCH_TIMEOUT_MS = 120_000;

interface MatchResult {
  winner: 'p1' | 'p2' | 'draw';
  durationMs: number;
}

function runMatch(guildA: GuildId, guildB: GuildId, seed: number, swapped: boolean): MatchResult {
  const p1 = swapped ? guildB : guildA;
  const p2 = swapped ? guildA : guildB;

  let state: SimState = createVsState(p1, p2, 'assembly', seed);
  state.difficulty = MAX_DIFFICULTY;

  const p1Input = createEmptyCpuInput();

  let timeMs = 0;

  while (timeMs < MATCH_TIMEOUT_MS) {
    synthesizeVsCpuInput(state, state.player, p1Input, TICK_DT, MAX_DIFFICULTY, state.opponent!);
    state = tickSimulation(state, p1Input, TICK_DT);
    timeMs += TICK_DT;

    if (state.phase === 'victory' || state.phase === 'defeat') {
      const p1Wins = state.phase === 'victory';
      const winner = p1Wins ? (swapped ? 'p2' : 'p1') : (swapped ? 'p1' : 'p2');
      return { winner: winner as 'p1' | 'p2', durationMs: timeMs };
    }
  }
  return { winner: 'draw', durationMs: timeMs };
}

function runPair(guildA: GuildId, guildB: GuildId): { p1Wins: number; p2Wins: number; draws: number } {
  let p1Wins = 0, p2Wins = 0, draws = 0;
  for (let seed = 0; seed < MATCHES_PER_PAIR; seed++) {
    const swapped = seed % 2 === 1;
    const result = runMatch(guildA, guildB, seed, swapped);
    if (result.winner === 'p1') p1Wins++;
    else if (result.winner === 'p2') p2Wins++;
    else draws++;
  }
  return { p1Wins, p2Wins, draws };
}

console.log(`Running ${GUILDS.length}×${GUILDS.length} balance matrix (${MATCHES_PER_PAIR} matches/pair)…\n`);

const winRates: number[][] = GUILDS.map(() => new Array(GUILDS.length).fill(0));
const totalWins: number[] = new Array(GUILDS.length).fill(0);
const totalMatches: number[] = new Array(GUILDS.length).fill(0);

for (let i = 0; i < GUILDS.length; i++) {
  for (let j = 0; j < GUILDS.length; j++) {
    if (i === j) {
      winRates[i][j] = 0.5;
      continue;
    }
    const { p1Wins, p2Wins, draws } = runPair(GUILDS[i], GUILDS[j]);
    const total = p1Wins + p2Wins + draws;
    winRates[i][j] = total > 0 ? (p1Wins + draws * 0.5) / total : 0.5;
    totalWins[i] += p1Wins + draws * 0.5;
    totalMatches[i] += total;
    process.stdout.write('.');
  }
  process.stdout.write('\n');
}

const COL_W = 13;
const pad = (s: string, w = COL_W) => s.substring(0, w).padEnd(w);
const pct = (n: number) => `${Math.round(n * 100)}%`.padStart(4);

console.log('\n' + pad('') + GUILDS.map(g => pad(g)).join(''));
for (let i = 0; i < GUILDS.length; i++) {
  const row = GUILDS.map((_, j) => pad(pct(winRates[i][j]))).join('');
  console.log(pad(GUILDS[i]) + row);
}

const overallWinRate = GUILDS.map((g, i) => ({
  guild: g,
  winRate: totalMatches[i] > 0 ? totalWins[i] / totalMatches[i] : 0.5,
})).sort((a, b) => b.winRate - a.winRate);

console.log('\n── Overall ranking ──');
overallWinRate.forEach(({ guild, winRate }, rank) => {
  console.log(`${String(rank + 1).padStart(2)}. ${guild.padEnd(12)} ${Math.round(winRate * 100)}%`);
});

const csvRows = [
  ['', ...GUILDS].join(','),
  ...GUILDS.map((g, i) => [g, ...winRates[i].map(v => Math.round(v * 100))].join(',')),
];
const csvPath = join(dirname(fileURLToPath(import.meta.url)), 'balance-output.csv');
writeFileSync(csvPath, csvRows.join('\n'));
console.log(`\nCSV written to ${csvPath}`);
