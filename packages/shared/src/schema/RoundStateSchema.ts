import { Schema, type } from '@colyseus/schema';

export class RoundWinsSchema extends Schema {
  @type('number') p1!: number;
  @type('number') p2!: number;
}

export class RoundStateSchema extends Schema {
  @type('number') index!: 0 | 1 | 2;
  @type(RoundWinsSchema) wins: RoundWinsSchema = new RoundWinsSchema();
  @type('number') timeRemainingMs!: number;
  @type('string') phase!: 'intro' | 'fighting' | 'resolved' | 'matchOver';
  @type('number') phaseStartedAtMs!: number;
  @type('string') winnerOfRound!: 'p1' | 'p2' | 'draw' | null;
  @type('string') matchWinner!: 'p1' | 'p2' | 'draw' | null;
}
