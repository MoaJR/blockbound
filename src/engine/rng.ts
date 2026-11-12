/**
 * PRNG determinístico (mulberry32). O estado é serializável para que a run
 * possa ser salva/restaurada no localStorage sem perder a sequência.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }

  get state(): number {
    return this.s;
  }

  set state(value: number) {
    this.s = value >>> 0;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro em [0, maxExclusive). */
  int(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }

  /** Inteiro em [min, maxInclusive]. */
  range(min: number, maxInclusive: number): number {
    return min + this.int(maxInclusive - min + 1);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(list: readonly T[]): T {
    return list[this.int(list.length)] as T;
  }

  shuffle<T>(list: readonly T[]): T[] {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = this.int(i + 1);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  weighted<T>(entries: readonly { item: T; weight: number }[]): T | null {
    let total = 0;
    for (const entry of entries) total += Math.max(0, entry.weight);
    if (total <= 0) return null;
    let roll = this.next() * total;
    for (const entry of entries) {
      roll -= Math.max(0, entry.weight);
      if (roll <= 0) return entry.item;
    }
    return entries[entries.length - 1]?.item ?? null;
  }
}

let idCounter = 0;

export function nextId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}_${idCounter}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
