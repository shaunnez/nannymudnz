import { Schema, type } from '@colyseus/schema';
import type { LogTag, LogTone } from '../simulation/types';

export class LogEntrySchema extends Schema {
  @type('number') id!: number;
  @type('number') tickId!: number;
  @type('string') tag!: LogTag;
  @type('string') tone!: LogTone;
  @type('string') text!: string;
}
