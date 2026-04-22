// mulberry32 — a 32-bit state, 2^32 period PRNG.
// Chosen over LCG because mulberry32 has better distribution for
// the small-sample rolls our sim makes (crit checks, variance).
// Not cryptographically secure — do not use for anything security-sensitive.
export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
