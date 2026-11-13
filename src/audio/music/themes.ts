/**
 * Composições originais do BLOCKBOUND.
 *
 * O motivo principal (tônica → terça → quinta → nona) é transformado em cada
 * tema: contemplativo no menu, sincopado no gameplay, invertido no estágio
 * avançado, cromatizado no chefe e resolvido na vitória.
 *
 * Nenhuma melodia é copiada: as progressões, ritmos e variações são originais.
 */

import { chord, clampMidi, invert } from './theory';

export type MusicScene =
  | 'menu'
  | 'gameplay'
  | 'advanced'
  | 'boss'
  | 'reward'
  | 'victory'
  | 'defeat';

export type LayerId = 'pad' | 'bass' | 'arp' | 'melody' | 'bells' | 'perc' | 'tension';

export const LAYER_IDS: LayerId[] = ['pad', 'bass', 'arp', 'melody', 'bells', 'perc', 'tension'];

export interface NoteHit {
  step: number;
  midi: number;
  dur: number;
  pan?: number;
  vel?: number;
}

export interface ChordHit {
  step: number;
  midis: number[];
  dur: number;
  vel?: number;
}

export type PercKind = 'kick' | 'snare' | 'hat' | 'tom' | 'shaker';

export interface PercHit {
  step: number;
  kind: PercKind;
  vel?: number;
}

export interface ThemeSpec {
  id: MusicScene;
  label: string;
  bpm: number;
  bars: number;
  stepsPerBar: 16;
  chords: number[][];
  pad: ChordHit[];
  bass: NoteHit[];
  arp: NoteHit[];
  melody: NoteHit[];
  bells: NoteHit[];
  tension: NoteHit[];
  perc: PercHit[];
  intro: NoteHit[];
  introPerc: PercHit[];
  lead: 'mallet' | 'pluck' | 'bell' | 'synth';
  layerGain: Record<LayerId, number>;
  layerThreshold: Record<LayerId, number>;
}

interface RhythmHit {
  step: number;
  dur: number;
}

const MOTIF = [0, 3, 7, 14, 12, 7, 3, 2];
const MAJOR_MOTIF = [0, 4, 7, 14, 12, 7, 4, 2];

const MENU_CHORDS = [
  chord(['D3', 'F3', 'A3', 'C4', 'E4']),
  chord(['Bb2', 'D3', 'F3', 'A3']),
  chord(['F3', 'A3', 'C4', 'E4', 'G4']),
  chord(['C3', 'E3', 'G3', 'D4']),
];

const GAMEPLAY_CHORDS = [
  chord(['D3', 'F3', 'A3', 'C4', 'E4']),
  chord(['Bb2', 'D3', 'F3', 'A3']),
  chord(['F3', 'A3', 'C4', 'E4']),
  chord(['C3', 'E3', 'G3', 'D4']),
  chord(['D3', 'F3', 'A3', 'C4']),
  chord(['G2', 'Bb2', 'D3', 'F3']),
  chord(['Bb2', 'D3', 'F3', 'A3']),
  chord(['A2', 'C#3', 'E3', 'G3', 'Bb3']),
];

const BOSS_CHORDS = [
  chord(['D3', 'F3', 'A3', 'C4']),
  chord(['Eb3', 'G3', 'Bb3', 'D4']),
  chord(['D3', 'F3', 'A3', 'C4']),
  chord(['Bb2', 'D3', 'F3', 'Ab3']),
  chord(['D3', 'F3', 'A3', 'C4']),
  chord(['Eb3', 'G3', 'Bb3', 'D4']),
  chord(['A2', 'C#3', 'E3', 'G3', 'Bb3']),
  chord(['D3', 'F3', 'A3', 'C4']),
];

const REWARD_CHORDS = [
  chord(['F3', 'A3', 'C4', 'E4', 'G4']),
  chord(['D3', 'F3', 'A3', 'C4', 'E4']),
  chord(['Bb2', 'D3', 'F3', 'A3']),
  chord(['C3', 'E3', 'G3', 'D4']),
  chord(['F3', 'A3', 'C4', 'E4', 'G4']),
  chord(['G2', 'Bb2', 'D3', 'F3']),
  chord(['Bb2', 'D3', 'F3', 'A3']),
  chord(['C3', 'E3', 'G3', 'D4']),
];

const VICTORY_CHORDS = [
  chord(['D3', 'F#3', 'A3', 'D4']),
  chord(['G2', 'B2', 'D3', 'G3']),
  chord(['Bb2', 'D3', 'F3', 'A3']),
  chord(['A2', 'C#3', 'E3', 'A3']),
  chord(['D3', 'F#3', 'A3', 'D4']),
  chord(['G2', 'B2', 'D3', 'G3']),
  chord(['F3', 'A3', 'C4', 'F4']),
  chord(['A2', 'C#3', 'E3', 'G3']),
];

const DEFEAT_CHORDS = [
  chord(['Bb2', 'D3', 'F3', 'A3']),
  chord(['G2', 'Bb2', 'D3', 'F3']),
  chord(['D3', 'F3', 'A3', 'C4']),
  chord(['A2', 'C#3', 'E3', 'G3']),
  chord(['Bb2', 'D3', 'F3', 'A3']),
  chord(['G2', 'Bb2', 'D3', 'F3']),
  chord(['D3', 'F3', 'A3', 'C4']),
  chord(['D3', 'F#3', 'A3', 'D4']),
];

function repeatToBars<T>(source: T[], bars: number): T[] {
  if (source.length === 0) return [];
  return Array.from({ length: bars }, (_, index) => source[index % source.length] as T);
}

function buildPad(chords: number[][], octave = 12): ChordHit[] {
  return chords.map((notes, bar) => ({
    step: bar * 16,
    midis: notes.map((note) => clampMidi(note + octave)),
    dur: 16.8,
    vel: 0.9,
  }));
}

type BassStyle = 'half' | 'pulse' | 'ostinato' | 'long' | 'walk';

function buildBass(chords: number[][], style: BassStyle): NoteHit[] {
  const hits: NoteHit[] = [];
  chords.forEach((notes, bar) => {
    const root = notes[0] ?? 50;
    const fifth = root + 7;
    const base = bar * 16;
    if (style === 'long') {
      hits.push({ step: base, midi: root, dur: 15.5, vel: 0.9 });
      return;
    }
    if (style === 'half') {
      hits.push({ step: base, midi: root, dur: 7.5, vel: 0.9 });
      hits.push({ step: base + 8, midi: root, dur: 7.2, vel: 0.7 });
      return;
    }
    if (style === 'walk') {
      [0, 4, 8, 12].forEach((step, index) => {
        const note = index === 3 ? fifth - 2 : index === 1 ? root + 3 : root;
        hits.push({ step: base + step, midi: note, dur: 3.4, vel: 0.72 });
      });
      return;
    }
    if (style === 'ostinato') {
      [0, 2, 4, 6, 8, 10, 12, 14].forEach((step, index) => {
        hits.push({
          step: base + step,
          midi: index % 4 === 3 ? fifth : root,
          dur: 1.8,
          vel: index === 0 ? 0.95 : 0.62,
        });
      });
      return;
    }
    [0, 4, 8, 12].forEach((step, index) => {
      hits.push({ step: base + step, midi: index === 2 ? root + 7 : root, dur: 3.2, vel: 0.8 });
    });
  });
  return hits;
}

function buildArp(
  chords: number[][],
  gap: number,
  pattern: number[],
  octave = 24,
  panWidth = 0.18,
): NoteHit[] {
  const hits: NoteHit[] = [];
  chords.forEach((notes, bar) => {
    if (notes.length === 0) return;
    let index = 0;
    for (let step = 0; step < 16; step += gap) {
      const degree = pattern[index % pattern.length] ?? 0;
      const source = notes[degree % notes.length] ?? notes[0] ?? 62;
      hits.push({
        step: bar * 16 + step,
        midi: clampMidi(source + octave),
        dur: Math.max(1.2, gap * 0.82),
        pan: Math.sin((index / Math.max(1, pattern.length)) * Math.PI * 2) * panWidth,
        vel: index % 4 === 0 ? 0.9 : 0.62,
      });
      index += 1;
    }
  });
  return hits;
}

function buildMelody(
  root: number,
  rhythm: RhythmHit[],
  bars: number,
  activeBars: number[],
  motif: number[] = MOTIF,
): NoteHit[] {
  const hits: NoteHit[] = [];
  for (const bar of activeBars) {
    if (bar < 0 || bar >= bars) continue;
    let degrees = motif;
    if (bar >= 8 && bar < 12) {
      degrees = invert(motif).map((degree) => degree + 12);
    }
    const lift = bar >= 12 ? 12 : 0;
    rhythm.forEach((entry, index) => {
      const degree = degrees[index % degrees.length] ?? 0;
      hits.push({
        step: bar * 16 + entry.step,
        midi: clampMidi(root + degree + lift),
        dur: entry.dur,
        vel: index === 0 ? 0.95 : 0.72,
        pan: (index % 2 === 0 ? -1 : 1) * 0.08,
      });
    });
  }
  return hits;
}

function buildBells(chords: number[][], bars: number[], stepPairs: number[], octave = 36): NoteHit[] {
  const hits: NoteHit[] = [];
  for (const bar of bars) {
    if (bar < 0 || bar >= chords.length) continue;
    const notes = chords[bar] ?? [];
    if (notes.length === 0) continue;
    stepPairs.forEach((step, index) => {
      const note = notes[(index + 2) % notes.length] ?? notes[0] ?? 62;
      hits.push({
        step: bar * 16 + step,
        midi: clampMidi(note + octave),
        dur: 6,
        vel: 0.55,
        pan: index % 2 === 0 ? 0.22 : -0.22,
      });
    });
  }
  return hits;
}

function buildTension(root: number, bars: number, every = 8): NoteHit[] {
  const hits: NoteHit[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    for (let step = 0; step < 16; step += every) {
      hits.push({
        step: bar * 16 + step,
        midi: clampMidi(root + (step === 0 ? 1 : 6)),
        dur: Math.max(2, every * 0.85),
        vel: 0.32,
      });
    }
  }
  return hits;
}

function percKickSnare(bars: number, kick: number[], snare: number[]): PercHit[] {
  const hits: PercHit[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    kick.forEach((step) => hits.push({ step: bar * 16 + step, kind: 'kick', vel: 0.9 }));
    snare.forEach((step) => hits.push({ step: bar * 16 + step, kind: 'snare', vel: 0.7 }));
  }
  return hits;
}

function percHats(bars: number, steps: number[], gain = 0.5): PercHit[] {
  const hits: PercHit[] = [];
  for (let bar = 0; bar < bars; bar += 1) {
    steps.forEach((step) => hits.push({ step: bar * 16 + step, kind: 'hat', vel: gain }));
  }
  return hits;
}

function withFills(hits: PercHit[], bars: number): PercHit[] {
  const out = [...hits];
  for (let bar = 3; bar < bars; bar += 4) {
    out.push({ step: bar * 16 + 12, kind: 'tom', vel: 0.6 });
    out.push({ step: bar * 16 + 14, kind: 'tom', vel: 0.75 });
  }
  return out;
}

function layerGains(overrides: Partial<Record<LayerId, number>> = {}): Record<LayerId, number> {
  return {
    pad: 0.19,
    bass: 0.27,
    arp: 0.13,
    melody: 0.2,
    bells: 0.14,
    perc: 0.15,
    tension: 0.1,
    ...overrides,
  };
}

function layerThresholds(
  overrides: Partial<Record<LayerId, number>> = {},
): Record<LayerId, number> {
  return {
    pad: 0,
    bass: 0,
    arp: 0,
    melody: 1,
    bells: 2,
    perc: 1,
    tension: 0,
    ...overrides,
  };
}

const MENU_RHYTHM: RhythmHit[] = [
  { step: 0, dur: 3 },
  { step: 3, dur: 2 },
  { step: 6, dur: 2 },
  { step: 8, dur: 3 },
  { step: 11, dur: 2 },
  { step: 14, dur: 2 },
];

const GAMEPLAY_RHYTHM: RhythmHit[] = [
  { step: 0, dur: 3 },
  { step: 4, dur: 2 },
  { step: 7, dur: 2 },
  { step: 12, dur: 3 },
];

const ADVANCED_RHYTHM: RhythmHit[] = [
  { step: 0, dur: 3 },
  { step: 3, dur: 2 },
  { step: 6, dur: 2 },
  { step: 10, dur: 3 },
  { step: 14, dur: 2 },
];

const BOSS_RHYTHM: RhythmHit[] = [
  { step: 0, dur: 4 },
  { step: 4, dur: 3 },
  { step: 8, dur: 4 },
  { step: 12, dur: 3 },
];

const REWARD_RHYTHM: RhythmHit[] = [
  { step: 0, dur: 4 },
  { step: 4, dur: 3 },
  { step: 8, dur: 4 },
  { step: 12, dur: 3 },
];

const VICTORY_RHYTHM: RhythmHit[] = [
  { step: 0, dur: 2 },
  { step: 2, dur: 2 },
  { step: 4, dur: 3 },
  { step: 8, dur: 2 },
  { step: 10, dur: 2 },
  { step: 12, dur: 4 },
];

const DEFEAT_RHYTHM: RhythmHit[] = [
  { step: 0, dur: 6 },
  { step: 6, dur: 4 },
  { step: 12, dur: 4 },
];

const MENU_THEME: ThemeSpec = {
  id: 'menu',
  label: 'Menu — Fragmento à Deriva',
  bpm: 92,
  bars: 16,
  stepsPerBar: 16,
  chords: repeatToBars(MENU_CHORDS, 16),
  pad: buildPad(repeatToBars(MENU_CHORDS, 16)),
  bass: buildBass(repeatToBars(MENU_CHORDS, 16), 'half'),
  arp: buildArp(repeatToBars(MENU_CHORDS, 16), 4, [0, 1, 2, 3, 2, 1], 24, 0.22),
  melody: buildMelody(62, MENU_RHYTHM, 16, [0, 1, 2, 3, 4, 6, 8, 10, 12, 14]),
  bells: buildBells(repeatToBars(MENU_CHORDS, 16), [2, 5, 9, 13], [4, 10], 36),
  tension: buildTension(62, 16, 8),
  perc: [...percHats(16, [4, 12], 0.28)],
  intro: [],
  introPerc: [],
  lead: 'mallet',
  layerGain: layerGains(),
  layerThreshold: layerThresholds({ perc: 3 }),
};

const GAMEPLAY_THEME: ThemeSpec = {
  id: 'gameplay',
  label: 'Gameplay — Encaixe Perfeito',
  bpm: 104,
  bars: 16,
  stepsPerBar: 16,
  chords: repeatToBars(GAMEPLAY_CHORDS, 16),
  pad: buildPad(repeatToBars(GAMEPLAY_CHORDS, 16)),
  bass: buildBass(repeatToBars(GAMEPLAY_CHORDS, 16), 'pulse'),
  arp: buildArp(repeatToBars(GAMEPLAY_CHORDS, 16), 2, [0, 1, 2, 3, 2, 1], 24, 0.16),
  melody: buildMelody(62, GAMEPLAY_RHYTHM, 16, [0, 2, 4, 6, 8, 10, 12, 14]),
  bells: buildBells(repeatToBars(GAMEPLAY_CHORDS, 16), [4, 12], [6, 14], 36),
  tension: buildTension(62, 16, 8),
  perc: [
    ...percKickSnare(16, [0, 8], [4, 12]),
    ...percHats(16, [0, 2, 4, 6, 8, 10, 12, 14], 0.34),
  ],
  intro: [],
  introPerc: [],
  lead: 'pluck',
  layerGain: layerGains(),
  layerThreshold: layerThresholds(),
};

const ADVANCED_THEME: ThemeSpec = {
  id: 'advanced',
  label: 'Estágio Avançado — Coração Antigo',
  bpm: 112,
  bars: 16,
  stepsPerBar: 16,
  chords: repeatToBars(GAMEPLAY_CHORDS, 16),
  pad: buildPad(repeatToBars(GAMEPLAY_CHORDS, 16), 12),
  bass: buildBass(repeatToBars(GAMEPLAY_CHORDS, 16), 'walk'),
  arp: buildArp(repeatToBars(GAMEPLAY_CHORDS, 16), 2, [0, 2, 1, 3, 2, 4], 24, 0.2),
  melody: buildMelody(
    62,
    ADVANCED_RHYTHM,
    16,
    [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14],
  ),
  bells: buildBells(repeatToBars(GAMEPLAY_CHORDS, 16), [2, 6, 10, 14], [3, 8, 13], 36),
  tension: buildTension(62, 16, 8),
  perc: withFills(
    [
      ...percKickSnare(16, [0, 6, 8, 14], [4, 12]),
      ...percHats(16, [0, 2, 4, 6, 8, 10, 12, 14], 0.4),
    ],
    16,
  ),
  intro: [],
  introPerc: [],
  lead: 'pluck',
  layerGain: layerGains({ melody: 0.17, bells: 0.12, perc: 0.13 }),
  layerThreshold: layerThresholds({ bells: 1 }),
};

const BOSS_THEME: ThemeSpec = {
  id: 'boss',
  label: 'Chefe — Trono de Pesadelo',
  bpm: 124,
  bars: 16,
  stepsPerBar: 16,
  chords: repeatToBars(BOSS_CHORDS, 16),
  pad: buildPad(repeatToBars(BOSS_CHORDS, 16), 0),
  bass: buildBass(repeatToBars(BOSS_CHORDS, 16), 'ostinato'),
  arp: buildArp(repeatToBars(BOSS_CHORDS, 16), 4, [0, 1, 0, 2, 1, 3], 12, 0.12),
  melody: buildMelody(
    62,
    BOSS_RHYTHM,
    16,
    [0, 1, 2, 3, 4, 6, 8, 10, 12, 14],
    [0, 1, 7, 13, 12, 7, 1, 0],
  ),
  bells: buildBells(repeatToBars(BOSS_CHORDS, 16), [3, 7, 11, 15], [2, 10], 36),
  tension: buildTension(62, 16, 4),
  perc: withFills(
    [
      ...percKickSnare(16, [0, 3, 6, 8, 11, 14], [4, 12]),
      ...percHats(16, [0, 2, 4, 6, 8, 10, 12, 14], 0.32),
    ],
    16,
  ),
  intro: [],
  introPerc: [],
  lead: 'synth',
  layerGain: layerGains({ bass: 0.25, melody: 0.16, tension: 0.1, perc: 0.14 }),
  layerThreshold: layerThresholds(),
};

const REWARD_THEME: ThemeSpec = {
  id: 'reward',
  label: 'Recompensa — Cristal Desperto',
  bpm: 88,
  bars: 8,
  stepsPerBar: 16,
  chords: REWARD_CHORDS,
  pad: buildPad(REWARD_CHORDS, 12),
  bass: buildBass(REWARD_CHORDS, 'long'),
  arp: buildArp(REWARD_CHORDS, 4, [0, 1, 2, 3, 2, 1], 24, 0.25),
  melody: buildMelody(65, REWARD_RHYTHM, 8, [0, 2, 4, 6], [0, 4, 7, 12, 11, 7, 4, 2]),
  bells: buildBells(REWARD_CHORDS, [0, 1, 2, 3, 4, 5, 6, 7], [4, 12], 36),
  tension: [],
  perc: [...percHats(8, [4, 12], 0.22)],
  intro: [],
  introPerc: [],
  lead: 'bell',
  layerGain: layerGains({ pad: 0.15, bass: 0.14, arp: 0.12, melody: 0.13, bells: 0.13 }),
  layerThreshold: layerThresholds({ melody: 1, bells: 1, perc: 3 }),
};

const VICTORY_THEME: ThemeSpec = {
  id: 'victory',
  label: 'Vitória — Além do Último Bloco',
  bpm: 108,
  bars: 16,
  stepsPerBar: 16,
  chords: repeatToBars(VICTORY_CHORDS, 16),
  pad: buildPad(repeatToBars(VICTORY_CHORDS, 16), 12),
  bass: buildBass(repeatToBars(VICTORY_CHORDS, 16), 'walk'),
  arp: buildArp(repeatToBars(VICTORY_CHORDS, 16), 2, [0, 2, 1, 3], 24, 0.2),
  melody: buildMelody(
    62,
    VICTORY_RHYTHM,
    16,
    [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14],
    MAJOR_MOTIF,
  ),
  bells: buildBells(repeatToBars(VICTORY_CHORDS, 16), [1, 5, 9, 13], [2, 7, 11], 36),
  tension: [],
  perc: withFills(
    [
      ...percKickSnare(16, [0, 8], [4, 12]),
      ...percHats(16, [0, 2, 4, 6, 8, 10, 12, 14], 0.4),
    ],
    16,
  ),
  intro: [
    { step: 0, midi: 74, dur: 2 },
    { step: 2, midi: 78, dur: 2 },
    { step: 4, midi: 81, dur: 3 },
    { step: 7, midi: 86, dur: 4 },
    { step: 12, midi: 81, dur: 2 },
    { step: 14, midi: 78, dur: 3 },
    { step: 16, midi: 74, dur: 2 },
    { step: 18, midi: 81, dur: 2 },
    { step: 20, midi: 86, dur: 4 },
    { step: 24, midi: 88, dur: 6 },
  ],
  introPerc: [
    { step: 0, kind: 'kick', vel: 1 },
    { step: 4, kind: 'snare', vel: 0.8 },
    { step: 8, kind: 'kick', vel: 0.9 },
    { step: 12, kind: 'snare', vel: 0.85 },
    { step: 16, kind: 'kick', vel: 1 },
    { step: 20, kind: 'snare', vel: 0.9 },
    { step: 24, kind: 'tom', vel: 0.8 },
    { step: 26, kind: 'tom', vel: 0.9 },
  ],
  lead: 'mallet',
  layerGain: layerGains({ pad: 0.14, melody: 0.17, bells: 0.12, perc: 0.13 }),
  layerThreshold: layerThresholds({ bells: 1 }),
};

const DEFEAT_THEME: ThemeSpec = {
  id: 'defeat',
  label: 'Derrota — O Último Fragmento',
  bpm: 68,
  bars: 8,
  stepsPerBar: 16,
  chords: DEFEAT_CHORDS,
  pad: buildPad(DEFEAT_CHORDS, 12),
  bass: buildBass(DEFEAT_CHORDS, 'long'),
  arp: buildArp(DEFEAT_CHORDS, 8, [0, 2, 1, 3], 24, 0.1),
  melody: buildMelody(62, DEFEAT_RHYTHM, 8, [0, 1, 2, 3, 4, 5, 6, 7]),
  bells: buildBells(DEFEAT_CHORDS, [1, 4, 6], [8], 36),
  tension: [],
  perc: [],
  intro: [],
  introPerc: [],
  lead: 'bell',
  layerGain: layerGains({ pad: 0.16, bass: 0.16, melody: 0.12, bells: 0.1, arp: 0.06 }),
  layerThreshold: layerThresholds({ melody: 1, bells: 2, perc: 3 }),
};

export const THEMES: Record<MusicScene, ThemeSpec> = {
  menu: MENU_THEME,
  gameplay: GAMEPLAY_THEME,
  advanced: ADVANCED_THEME,
  boss: BOSS_THEME,
  reward: REWARD_THEME,
  victory: VICTORY_THEME,
  defeat: DEFEAT_THEME,
};

export function themeById(id: MusicScene): ThemeSpec {
  return THEMES[id];
}

export function totalSteps(theme: ThemeSpec): number {
  return theme.bars * theme.stepsPerBar;
}

export function defaultIntensity(id: MusicScene): number {
  if (id === 'menu') return 2;
  if (id === 'victory') return 3;
  if (id === 'defeat') return 1;
  if (id === 'reward') return 2;
  return 2;
}

/** Exportado para testes de composição. */
export const MOTIF_DEGREES = MOTIF;
