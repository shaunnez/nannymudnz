import { describe, it, expect } from 'vitest';
import { createPlayerActor, enterWolfForm, revertWolfForm } from '../simulation';

describe('druid wolf form', () => {
  it('entering wolf form increases hpMax and stores base values', () => {
    const druid = createPlayerActor('druid');
    const originalHpMax = druid.hpMax;
    const originalSpeed = druid.moveSpeed;
    enterWolfForm(druid);
    expect(druid.hpMax).toBeGreaterThan(originalHpMax);
    expect(druid.baseHpMax).toBe(originalHpMax);
    expect(druid.baseMoveSpeed).toBe(originalSpeed);
    expect(druid.shapeshiftForm).toBe('wolf');
    expect(druid.kind).toBe('wolf_form');
  });

  it('reverting wolf form restores exact original hpMax and speed', () => {
    const druid = createPlayerActor('druid');
    const originalHpMax = druid.hpMax;
    const originalSpeed = druid.moveSpeed;
    enterWolfForm(druid);
    revertWolfForm(druid);
    expect(druid.hpMax).toBe(originalHpMax);
    expect(druid.moveSpeed).toBe(originalSpeed);
    expect(druid.shapeshiftForm).toBe('none');
    expect(druid.kind).toBe('druid');
  });
});
