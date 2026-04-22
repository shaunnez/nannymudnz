/** A single actor's tweenable fields at a specific server timestamp. */
export interface ActorSnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  facing: -1 | 1;
  // Non-transform fields (hp, mp, status, animationId, state) use latest-snapshot values
  // — callers merge them separately from the corresponding SimStateSchema read.
}

export interface Snapshot {
  tMs: number;
  actors: ActorSnapshot[];
}

/**
 * Keeps the last two snapshots and samples an interpolated position at any
 * time. Caller should sample at `now - 50ms` (client-side render delay).
 */
export class StateSync {
  private a: Snapshot | null = null;
  private b: Snapshot | null = null;

  onSnapshot(s: Snapshot): void {
    this.a = this.b;
    this.b = s;
  }

  /** Returns actor snapshots interpolated at `tMs`. */
  sample(tMs: number): ActorSnapshot[] {
    if (!this.b) return [];
    if (!this.a) return this.b.actors;
    if (this.b.tMs === this.a.tMs) return this.b.actors;
    const clamped = Math.max(this.a.tMs, Math.min(this.b.tMs, tMs));
    const t = (clamped - this.a.tMs) / (this.b.tMs - this.a.tMs);
    const out: ActorSnapshot[] = [];
    for (const bActor of this.b.actors) {
      const aActor = this.a.actors.find(x => x.id === bActor.id);
      if (!aActor) { out.push(bActor); continue; }
      out.push({
        id: bActor.id,
        x: lerp(aActor.x, bActor.x, t),
        y: lerp(aActor.y, bActor.y, t),
        z: lerp(aActor.z, bActor.z, t),
        facing: bActor.facing, // facing snaps; don't interpolate
      });
    }
    return out;
  }
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
