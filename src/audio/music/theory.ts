/** Teoria musical mínima e determinística usada pelas composições originais. */

const PITCH_CLASS: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

/** Converte nomes como "D4", "Bb3" ou "F#5" para MIDI (C4 = 60). */
export function midi(name: string): number {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!match) throw new Error(`Nota inválida: ${name}`);
  const [, letter, accidental, octaveText] = match;
  const pc = PITCH_CLASS[`${letter.toUpperCase()}${accidental}`];
  if (pc === undefined) throw new Error(`Nota inválida: ${name}`);
  const octave = Number(octaveText);
  return (octave + 1) * 12 + pc;
}

export function frequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

export function chord(notes: string[]): number[] {
  return notes.map(midi);
}

export function transpose(notes: number[], semitones: number): number[] {
  return notes.map((note) => note + semitones);
}

/** Inverte um motivo em torno do primeiro grau. */
export function invert(notes: number[]): number[] {
  if (notes.length === 0) return [];
  const root = notes[0];
  return notes.map((note) => root - (note - root));
}

/** Motivo (semitons a partir da tônica) -> notas MIDI absolutas. */
export function motifToNotes(root: number, degrees: number[]): number[] {
  return degrees.map((degree) => root + degree);
}

export function clampMidi(note: number, min = 24, max = 96): number {
  return Math.max(min, Math.min(max, Math.round(note)));
}

/** Hash simples para variações determinísticas por compasso. */
export function hashStep(value: number, salt = 0): number {
  let hash = (value * 374761393 + salt * 668265263) | 0;
  hash = (hash ^ (hash >>> 13)) * 1274126177;
  return Math.abs(hash ^ (hash >>> 16));
}

export function pickIndex(length: number, step: number, salt = 0): number {
  if (length <= 0) return 0;
  return hashStep(step, salt) % length;
}
