/**
 * A small seeded PRNG.
 *
 * Every stochastic decision in the engine draws from here so that a given
 * (project, seed) pair always produces byte-identical reports. That matters
 * more than it sounds: a report that shifts between runs cannot be used to
 * tell whether a code change helped.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Avoid the zero fixed point of xorshift.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Uniform in [0, 1). */
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;
    x >>>= 0;
    this.state = x;
    return x / 0x100000000;
  }

  /** Uniform in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  /** Uniform in the given range tuple. */
  range([min, max]: [number, number]): number {
    return this.float(min, max);
  }

  /** Uniform integer in the given range tuple. */
  intRange([min, max]: [number, number]): number {
    return this.int(Math.round(min), Math.round(max));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick called with an empty list");
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Pick by relative weight. Weights need not sum to 1. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    if (items.length === 0) throw new Error("Rng.weighted called with an empty list");
    let total = 0;
    for (const item of items) total += Math.max(0, weightOf(item));
    if (total <= 0) return this.pick(items);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= Math.max(0, weightOf(item));
      if (roll <= 0) return item;
    }
    return items[items.length - 1]!;
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Fisher-Yates, returning a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const a = out[i]!;
      const b = out[j]!;
      out[i] = b;
      out[j] = a;
    }
    return out;
  }
}

/** Stable 32-bit hash, used to derive per-persona seeds from string ids. */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
