import { describe, it, expectTypeOf } from 'vitest';
import type {
  SimState,
  Actor,
  Projectile,
  Pickup,
  VFXEvent,
  LogEntry,
  RoundState,
} from '../../simulation/types';
import {
  SimStateSchema,
  ActorSchema,
  ProjectileSchema,
  PickupSchema,
  VFXEventSchema,
  LogEntrySchema,
  RoundStateSchema,
} from '../index';

describe('Schema structurally satisfies SimState', () => {
  it('SimStateSchema is assignable to SimState', () => {
    expectTypeOf<SimStateSchema>().toMatchTypeOf<SimState>();
  });
  it('ActorSchema is assignable to Actor', () => {
    expectTypeOf<ActorSchema>().toMatchTypeOf<Actor>();
  });
  it('ProjectileSchema is assignable to Projectile', () => {
    expectTypeOf<ProjectileSchema>().toMatchTypeOf<Projectile>();
  });
  it('PickupSchema is assignable to Pickup', () => {
    expectTypeOf<PickupSchema>().toMatchTypeOf<Pickup>();
  });
  it('VFXEventSchema is assignable to VFXEvent', () => {
    expectTypeOf<VFXEventSchema>().toMatchTypeOf<VFXEvent>();
  });
  it('LogEntrySchema is assignable to LogEntry', () => {
    expectTypeOf<LogEntrySchema>().toMatchTypeOf<LogEntry>();
  });
  it('RoundStateSchema is assignable to RoundState', () => {
    expectTypeOf<RoundStateSchema>().toMatchTypeOf<RoundState>();
  });
});
