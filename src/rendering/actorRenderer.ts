import type { AnimationId } from '../simulation/types';

export interface ActorRenderHandle {
  actorKind: string;
  animationId: AnimationId;
  direction: -1 | 1;
  frameIndex: number;
  x: number;
  y: number;
  z: number;
}

export interface ActorRendererImpl {
  renderActor(
    ctx: CanvasRenderingContext2D,
    handle: ActorRenderHandle,
    color: string,
    initial: string,
    screenX: number,
    screenY: number,
    width: number,
    height: number,
    isAlive: boolean,
    hp: number,
    hpMax: number,
  ): void;
}
