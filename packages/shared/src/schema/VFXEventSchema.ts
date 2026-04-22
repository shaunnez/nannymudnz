import { Schema, type } from '@colyseus/schema';
import type { GuildId, VFXEventType } from '../simulation/types';

export class VFXEventSchema extends Schema {
  @type('string') type!: VFXEventType;
  @type('string') color!: string;
  @type('number') x!: number;
  @type('number') y!: number;
  @type('number') z?: number;
  @type('number') facing?: 1 | -1;
  @type('number') radius?: number;
  @type('number') vx?: number;
  @type('number') vy?: number;
  @type('number') x2?: number;
  @type('number') y2?: number;
  @type('number') value?: number;
  @type('string') text?: string;
  @type('boolean') isCrit?: boolean;
  @type('boolean') isHeal?: boolean;
  @type('string') guildId?: GuildId | null;
  @type('string') abilityId?: string;
  @type('string') ownerId?: string;
  @type('string') targetId?: string;
  @type('string') assetKey?: string;
}
