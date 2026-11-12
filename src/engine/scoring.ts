import type { RunMods, ScoreBreakdown } from './types';
import type { Rng } from './rng';
import { clamp } from './rng';

export const PLACE_POINTS_PER_BLOCK = 5;
export const LINE_BASE = 100;

export function defaultMods(): RunMods {
  return {
    scoreMult: 1,
    lineScoreMult: 0,
    placeScoreMult: 0,
    placeFlat: 0,
    comboStep: 0.25,
    comboCap: 2,
    extraMoves: 0,
    baseCharges: {},
    specialChance: 0.06,
    prismEvery: 0,
    emptyCellBonus: 0,
    extraMovesOnClear: 0,
    extraMovesOnClearCap: 0,
    bigPieceBonus: 0,
    crystalMult: 1,
    rewardChoices: 3,
    rerollsPerStage: 0,
    noClearStreakBonus: 0,
    mirrorChance: 0,
    rareScoreBonus: 0,
    comboKeepOnBigPlace: 0,
    comboSafeAcrossStages: false,
    glassLens: false,
    canRecall: false,
    shapePreference: 'none',
    masterTable: false,
    energyMult: 1,
    energyOnLine: 0,
    energyComboMult: 0,
    energyMax: 0,
    energyOnSpecial: 0,
    powerRewardChance: 0,
    eventChance: 0,
    rewardDupeChance: 0,
    shopDiscount: 0,
    fragmentGain: 0,
  };
}

export interface ScoreInput {
  blocks: number;
  lines: number;
  combo: number;
  mods: RunMods;
  /** Relíquias raras ou melhores equipadas (Elo de Sinergia). */
  rarePlus: number;
  noClearStreak: number;
  /** Multiplicador da peça (prisma = 3). */
  pieceMult: number;
  rng: Rng;
}

/**
 * Fórmula de pontuação (documentada no README):
 * posicionamento = blocos × 5 (+ flat) × multiplicadores da peça
 * linha = 100 × linhas × (1 + 0.5 × (linhas - 1)) × bônus de linha
 * combo = 1 + passo × nível (limitado por comboCap)
 */
export function computeScore(input: ScoreInput): ScoreBreakdown {
  const { blocks, lines, combo, mods, rarePlus, noClearStreak, pieceMult, rng } = input;
  const placeBase = blocks * PLACE_POINTS_PER_BLOCK + blocks * mods.placeFlat;
  const bigBonus = blocks >= 4 ? mods.bigPieceBonus : 0;
  const place = Math.round(placeBase * (1 + mods.placeScoreMult + bigBonus) * pieceMult);

  let line = 0;
  let lineBonus = 0;
  let comboMult = 1;
  let streakBonus = 0;

  if (lines > 0) {
    const simultaneous = 1 + 0.5 * (lines - 1);
    line = Math.round(LINE_BASE * lines * simultaneous * (1 + mods.lineScoreMult));
    if (lines >= 3) lineBonus = Math.round(line * 0.5 * (lines - 2));
    comboMult = clamp(1 + mods.comboStep * combo, 1, mods.comboCap);
  } else {
    streakBonus = Math.round(place * Math.min(mods.noClearStreakBonus * noClearStreak, 0.8));
  }

  const globalMult = 1 + mods.rareScoreBonus * rarePlus;
  let total = (place + line + lineBonus + streakBonus) * comboMult * globalMult * mods.scoreMult;

  const mirrored = mods.mirrorChance > 0 && rng.chance(mods.mirrorChance);
  if (mirrored) total *= 2;

  return {
    place,
    line,
    lineBonus,
    comboMult: Math.round(comboMult * 100) / 100,
    globalMult: Math.round(globalMult * 100) / 100,
    bigBonus,
    streakBonus,
    mirrored,
    total: Math.max(0, Math.round(total)),
  };
}
