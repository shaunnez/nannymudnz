import type { Actor, Projectile, SimState } from './types';
import {
  GRAVITY, WORLD_WIDTH, GROUND_Y_MIN, GROUND_Y_MAX,
  KNOCKDOWN_FLY_MS, KNOCKDOWN_LIE_MS, GETUP_ANIM_MS,
} from './constants';
import { getSpeedMultiplier, isRooted, isStunned } from './combat';

export function tickPhysics(actor: Actor, dtSec: number): void {
  if (!actor.isAlive) return;

  const stunned = isStunned(actor);
  const rooted = isRooted(actor);

  if (!stunned && !rooted && actor.state !== 'knockdown') {
    actor.x += actor.vx * dtSec;
    actor.y += actor.vy * dtSec;
  } else if (actor.state === 'knockdown') {
    actor.x += actor.vx * dtSec;
    actor.vx *= Math.pow(0.85, dtSec * 60);
  }

  if (actor.z > 0 || actor.vz > 0) {
    actor.vz -= GRAVITY * dtSec;
    actor.z += actor.vz * dtSec;
    if (actor.z <= 0) {
      actor.z = 0;
      actor.vz = 0;
      if (actor.state === 'jumping' || actor.state === 'falling') {
        actor.state = 'landing';
        actor.animationId = 'land';
        actor.stateTimeMs = 0;
      }
    }
  }

  actor.x = Math.max(actor.width / 2, Math.min(WORLD_WIDTH - actor.width / 2, actor.x));
  actor.y = Math.max(GROUND_Y_MIN, Math.min(GROUND_Y_MAX, actor.y));

  actor.stateTimeMs += dtSec * 1000;
}

export function tickKnockdown(actor: Actor, dtSec: number): void {
  if (actor.state !== 'knockdown') return;

  actor.knockdownTimeMs += dtSec * 1000;

  const flyDone = actor.z <= 0 && actor.knockdownTimeMs > 100;

  if (flyDone && actor.knockdownTimeMs < KNOCKDOWN_FLY_MS + KNOCKDOWN_LIE_MS) {
    actor.animationId = 'knockdown';
  } else if (actor.knockdownTimeMs >= KNOCKDOWN_FLY_MS + KNOCKDOWN_LIE_MS) {
    actor.state = 'getup';
    actor.animationId = 'getup';
    actor.getupTimeMs = 0;
    actor.invulnerableMs = GETUP_ANIM_MS;
  }
}

export function tickGetup(actor: Actor, dtSec: number): void {
  if (actor.state !== 'getup') return;
  actor.getupTimeMs += dtSec * 1000;
  if (actor.getupTimeMs >= GETUP_ANIM_MS) {
    actor.state = 'idle';
    actor.animationId = 'idle';
    actor.knockdownTimeMs = 0;
  }
}

export function tickProjectile(proj: Projectile, dtSec: number): boolean {
  proj.x += proj.vx * dtSec;
  proj.y += proj.vy * dtSec;
  proj.z += proj.vz * dtSec;
  proj.vz -= GRAVITY * 0.1 * dtSec;

  const dist = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy) * dtSec;
  proj.traveled += dist;

  if (proj.traveled >= proj.range) return false;
  if (proj.x < 0 || proj.x > WORLD_WIDTH) return false;
  if (proj.z < -20) return false;

  return true;
}

export function updateCamera(state: SimState): void {
  if (state.cameraLocked) return;

  const targetCamX = state.player.x - 300;
  state.cameraX += (targetCamX - state.cameraX) * 0.08;
  state.cameraX = Math.max(0, Math.min(WORLD_WIDTH - 900, state.cameraX));
}

export function getEffectiveMoveSpeed(actor: Actor): number {
  return actor.moveSpeed * getSpeedMultiplier(actor);
}
