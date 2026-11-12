import type { PowerDef, PowerId } from './types';

export const POWERS: PowerDef[] = [
  {
    id: 'hammer',
    name: 'Martelo',
    desc: 'Esmaga uma célula do tabuleiro.',
    target: 'cell',
    baseCharges: 1,
    unlockCost: 0,
    price: 0,
  },
  {
    id: 'shuffle',
    name: 'Reorganizar',
    desc: 'Troca as três peças disponíveis por outras.',
    target: 'none',
    baseCharges: 1,
    unlockCost: 0,
    price: 0,
  },
  {
    id: 'wildcard',
    name: 'Coringa',
    desc: 'A próxima peça pode ser encaixada sobre células congeladas ou corrompidas.',
    target: 'none',
    baseCharges: 1,
    unlockCost: 0,
    price: 0,
  },
  {
    id: 'convert',
    name: 'Conversão',
    desc: 'Esvazia uma área 2×2 contaminada.',
    target: 'cell',
    baseCharges: 0,
    unlockCost: 180,
    price: 90,
  },
  {
    id: 'bomb',
    name: 'Bomba',
    desc: 'Explode uma área 3×3.',
    target: 'cell',
    baseCharges: 0,
    unlockCost: 260,
    price: 120,
  },
  {
    id: 'drill',
    name: 'Broca',
    desc: 'Perfura e limpa uma linha inteira.',
    target: 'row',
    baseCharges: 0,
    unlockCost: 320,
    price: 150,
  },
];

export const POWER_MAP: Record<PowerId, PowerDef> = Object.fromEntries(
  POWERS.map((power) => [power.id, power]),
) as Record<PowerId, PowerDef>;

export const DEFAULT_POWERS: PowerId[] = ['hammer', 'shuffle', 'wildcard'];

export const POWER_ORDER: PowerId[] = ['hammer', 'bomb', 'drill', 'convert', 'shuffle', 'wildcard'];

export interface PowerLevelInfo {
  level: number;
  name: string;
  desc: string;
}

/** Nível máximo de evolução de cada poder. */
export const POWER_MAX_LEVEL: Record<PowerId, number> = {
  hammer: 3,
  bomb: 4,
  shuffle: 3,
  drill: 3,
  convert: 3,
  wildcard: 3,
};

/**
 * Catálogo de evolução. Cada entrada descreve o que aquele nível faz; o motor
 * lê os níveis em `usePower` e a UI usa os textos nas recompensas.
 */
export const POWER_LEVELS: Record<PowerId, PowerLevelInfo[]> = {
  hammer: [
    { level: 1, name: 'Martelo', desc: 'Esmaga uma célula do tabuleiro.' },
    { level: 2, name: 'Martelo Duplo', desc: 'Esmaga a célula alvo e um vizinho ocupado.' },
    { level: 3, name: 'Martelo Rúnico', desc: 'Esmaga duas células e gera 10 de energia.' },
  ],
  bomb: [
    { level: 1, name: 'Bomba', desc: 'Explode uma área 3×3.' },
    { level: 2, name: 'Bomba Ampliada', desc: 'Explode uma área 4×4.' },
    { level: 3, name: 'Bomba Incendiária', desc: '4×4 e +12 pontos por célula destruída.' },
    {
      level: 4,
      name: 'Bomba Arcana',
      desc: '4×4, bônus de pontos e chance de energia ao destruir células especiais.',
    },
  ],
  shuffle: [
    { level: 1, name: 'Reorganizar', desc: 'Troca as três peças disponíveis por outras.' },
    { level: 2, name: 'Reorganizar Duplo', desc: 'Gera dois conjuntos e mantém o mais jogável.' },
    {
      level: 3,
      name: 'Reorganizar Guiado',
      desc: 'Dois conjuntos, priorizando peças que completam linhas.',
    },
  ],
  drill: [
    { level: 1, name: 'Broca', desc: 'Perfura e limpa uma linha inteira.' },
    { level: 2, name: 'Broca Vibratória', desc: 'Limpa a linha e gera 8 de energia.' },
    { level: 3, name: 'Broca Total', desc: 'Limpa a linha e a coluna do alvo.' },
  ],
  convert: [
    { level: 1, name: 'Conversão', desc: 'Esvazia uma área 2×2 contaminada.' },
    { level: 2, name: 'Conversão Ampliada', desc: 'Esvazia uma área 3×3.' },
    { level: 3, name: 'Conversão Purificadora', desc: '3×3 e +6 de energia por corrupção.' },
  ],
  wildcard: [
    {
      level: 1,
      name: 'Coringa',
      desc: 'A próxima peça pode ser encaixada sobre células congeladas ou corrompidas.',
    },
    {
      level: 2,
      name: 'Coringa Flamejante',
      desc: 'O encaixe especial também queima corrupção adjacente.',
    },
    {
      level: 3,
      name: 'Coringa Arcano',
      desc: 'Queima corrupção adjacente e gera 12 de energia ao ser usado.',
    },
  ],
};

export function defaultPowerLevels(): Record<PowerId, number> {
  return { hammer: 1, bomb: 1, drill: 1, convert: 1, shuffle: 1, wildcard: 1 };
}

export function powerLevelInfo(id: PowerId, level: number): PowerLevelInfo {
  const list = POWER_LEVELS[id];
  const index = Math.max(0, Math.min(list.length - 1, Math.round(level) - 1));
  return list[index] as PowerLevelInfo;
}

export function powerMaxLevel(id: PowerId): number {
  return POWER_MAX_LEVEL[id];
}

export function emptyCharges(): Record<PowerId, number> {
  return { hammer: 0, bomb: 0, drill: 0, convert: 0, shuffle: 0, wildcard: 0 };
}
