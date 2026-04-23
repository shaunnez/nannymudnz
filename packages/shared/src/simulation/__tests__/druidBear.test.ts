import { describe, it, expect } from 'vitest';
import { createPlayerActor, enterBearForm, revertBearForm } from '../simulation';

describe('druid bear form', () => {
  it('entering bear form increases hpMax and stores base values', () => {
    const druid = createPlayerActor('druid');
    const originalHpMax = druid.hpMax;
    const originalSpeed = druid.moveSpeed;
    enterBearForm(druid);
    expect(druid.hpMax).toBeGreaterThan(originalHpMax);
    expect(druid.baseHpMax).toBe(originalHpMax);
    expect(druid.baseMoveSpeed).toBe(originalSpeed);
    expect(druid.shapeshiftForm).toBe('bear');
    expect(druid.kind).toBe('bear_form');
  });

  it('reverting bear form restores exact original hpMax and speed', () => {
    const druid = createPlayerActor('druid');
    const originalHpMax = druid.hpMax;
    const originalSpeed = druid.moveSpeed;
    enterBearForm(druid);
    revertBearForm(druid);
    expect(druid.hpMax).toBe(originalHpMax);
    expect(druid.moveSpeed).toBe(originalSpeed);
    expect(druid.shapeshiftForm).toBe('none');
    expect(druid.kind).toBe('druid');
  });
});
