import { Schema, type } from '@colyseus/schema';

export class PlayerSlot extends Schema {
  @type('string') sessionId = '';
  @type('string') name = '';
  @type('string') guildId = '';
  @type('boolean') ready = false;
  @type('boolean') locked = false;
  @type('boolean') connected = true;
  @type('number') ping = 0;
}
