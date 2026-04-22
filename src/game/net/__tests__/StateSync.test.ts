import { describe, it, expect } from 'vitest';
import { StateSync } from '../StateSync';
import type { ActorSnapshot, Snapshot } from '../StateSync';

function makeActor(id: string, x: number, y = 0, z = 0, facing: -1 | 1 = 1): ActorSnapshot {
  return { id, x, y, z, facing };
}

function makeSnapshot(tMs: number, actors: ActorSnapshot[]): Snapshot {
  return { tMs, actors };
}

describe('StateSync', () => {
  it('empty — sample returns []', () => {
    const sync = new StateSync();
    expect(sync.sample(0)).toEqual([]);
  });

  it('single snapshot — sample returns actors verbatim', () => {
    const sync = new StateSync();
    const actors = [makeActor('p1', 100)];
    sync.onSnapshot(makeSnapshot(0, actors));
    expect(sync.sample(50)).toEqual(actors);
    expect(sync.sample(0)).toEqual(actors);
  });

  it('two snapshots — sample at midpoint interpolates x', () => {
    const sync = new StateSync();
    sync.onSnapshot(makeSnapshot(0, [makeActor('p1', 0)]));
    sync.onSnapshot(makeSnapshot(50, [makeActor('p1', 100)]));
    const result = sync.sample(25);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBeCloseTo(50);
  });

  it('sample at a.tMs → x equals a value', () => {
    const sync = new StateSync();
    sync.onSnapshot(makeSnapshot(0, [makeActor('p1', 0)]));
    sync.onSnapshot(makeSnapshot(50, [makeActor('p1', 100)]));
    expect(sync.sample(0)[0].x).toBeCloseTo(0);
  });

  it('sample at b.tMs → x equals b value', () => {
    const sync = new StateSync();
    sync.onSnapshot(makeSnapshot(0, [makeActor('p1', 0)]));
    sync.onSnapshot(makeSnapshot(50, [makeActor('p1', 100)]));
    expect(sync.sample(50)[0].x).toBeCloseTo(100);
  });

  it('sample past b.tMs is clamped to b value', () => {
    const sync = new StateSync();
    sync.onSnapshot(makeSnapshot(0, [makeActor('p1', 0)]));
    sync.onSnapshot(makeSnapshot(50, [makeActor('p1', 100)]));
    expect(sync.sample(60)[0].x).toBeCloseTo(100);
  });

  it('multiple actors all survive interpolation', () => {
    const sync = new StateSync();
    sync.onSnapshot(makeSnapshot(0, [makeActor('p1', 0), makeActor('p2', 200)]));
    sync.onSnapshot(makeSnapshot(100, [makeActor('p1', 100), makeActor('p2', 400)]));
    const result = sync.sample(50);
    expect(result).toHaveLength(2);
    const p1 = result.find(a => a.id === 'p1')!;
    const p2 = result.find(a => a.id === 'p2')!;
    expect(p1.x).toBeCloseTo(50);
    expect(p2.x).toBeCloseTo(300);
  });

  it('actor in b but not in a uses b values verbatim', () => {
    const sync = new StateSync();
    sync.onSnapshot(makeSnapshot(0, []));
    sync.onSnapshot(makeSnapshot(50, [makeActor('newActor', 77)]));
    const result = sync.sample(25);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('newActor');
    expect(result[0].x).toBe(77);
  });

  it('facing does not interpolate — always uses b value', () => {
    const sync = new StateSync();
    sync.onSnapshot(makeSnapshot(0, [makeActor('p1', 0, 0, 0, -1)]));
    sync.onSnapshot(makeSnapshot(50, [makeActor('p1', 100, 0, 0, 1)]));
    const result = sync.sample(25);
    expect(result[0].facing).toBe(1);
  });

  it('y and z are also interpolated', () => {
    const sync = new StateSync();
    sync.onSnapshot(makeSnapshot(0, [makeActor('p1', 0, 0, 0)]));
    sync.onSnapshot(makeSnapshot(100, [makeActor('p1', 0, 200, 100)]));
    const result = sync.sample(50);
    expect(result[0].y).toBeCloseTo(100);
    expect(result[0].z).toBeCloseTo(50);
  });

  it('duplicate a.tMs === b.tMs returns b actors without division by zero', () => {
    const sync = new StateSync();
    sync.onSnapshot(makeSnapshot(10, [makeActor('p1', 0)]));
    sync.onSnapshot(makeSnapshot(10, [makeActor('p1', 100)]));
    const result = sync.sample(10);
    expect(result[0].x).toBe(100);
  });
});
