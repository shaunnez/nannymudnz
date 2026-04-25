import { Schema, type } from '@colyseus/schema';

export class BattleSlotSchema extends Schema {
  @type('string') slotType: 'human' | 'cpu' | 'off' = 'off';
  @type('string') guildId = '';
  @type('string') team = '';           // 'A' | 'B' | 'C' | 'D' | ''
  @type('string') ownerSessionId = ''; // set for human slots
}
