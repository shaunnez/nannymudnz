import { Schema, type, MapSchema } from '@colyseus/schema';
import { PlayerSlot } from './PlayerSlot';
import { SimStateSchema } from './SimStateSchema';

export type MatchPhase = 'lobby' | 'char_select' | 'stage_select' | 'loading' | 'in_game' | 'results';

export class MatchState extends Schema {
  @type('string') phase: MatchPhase = 'lobby';
  @type('string') code = '';
  @type('number') rounds: number = 3;
  @type('string') visibility: 'public' | 'private' = 'private';
  @type('string') name = '';
  @type('string') hostSessionId = '';
  @type({ map: PlayerSlot }) players = new MapSchema<PlayerSlot>();
  @type('string') stageId = '';
  @type('number') seed = 0;
  @type(SimStateSchema) sim?: SimStateSchema;
  @type('string') matchWinnerSessionId = '';
  @type('number') createdAtMs = 0;
}
