/** Tempos e curvas compartilhados por toda a interface. */

export const EASE = {
  out: [0.22, 0.61, 0.36, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
  snap: [0.2, 1.18, 0.36, 1] as const,
};

export const DURATION = {
  instant: 0.08,
  fast: 0.14,
  base: 0.24,
  slow: 0.38,
  cinematic: 0.9,
};

export const SPRING = {
  soft: { type: 'spring' as const, stiffness: 160, damping: 24 },
  snappy: { type: 'spring' as const, stiffness: 320, damping: 26 },
  heavy: { type: 'spring' as const, stiffness: 220, damping: 28 },
};
