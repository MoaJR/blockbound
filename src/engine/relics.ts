import type { Rarity, RunMods, SynergyTag } from './types';
import { defaultMods } from './scoring';
import type { Rng } from './rng';

export type RelicIcon =
  | 'crown'
  | 'seal'
  | 'hourglass'
  | 'glove'
  | 'map'
  | 'charm'
  | 'purse'
  | 'lens'
  | 'crystal'
  | 'core'
  | 'combo'
  | 'bomb'
  | 'clover'
  | 'compass'
  | 'boots'
  | 'mirror'
  | 'flame'
  | 'clock'
  | 'eye'
  | 'chain'
  | 'coin'
  | 'drill'
  | 'gem'
  | 'sun'
  | 'scepter'
  | 'glass'
  | 'phoenix'
  | 'sword'
  | 'link'
  | 'void'
  | 'titan'
  | 'chest'
  | 'table'
  | 'spiral';

export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: RelicIcon;
  tags: SynergyTag[];
  synergies: SynergyTag[];
  mods?: Partial<RunMods>;
  /** Presente quando a relíquia tem lógica dedicada no motor. */
  special?: string;
  startUnlocked?: boolean;
}

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Lendária',
};

export const RARITY_COST: Record<Rarity, number> = {
  common: 120,
  uncommon: 220,
  rare: 380,
  epic: 620,
  legendary: 950,
};

export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 46,
  uncommon: 27,
  rare: 16,
  epic: 8,
  legendary: 3,
};

export const SYNERGY_LABEL: Record<SynergyTag, string> = {
  combo: 'Combo',
  lines: 'Linhas',
  prism: 'Prisma',
  power: 'Poderes',
  economy: 'Economia',
  precision: 'Precisão',
};

export const RELICS: RelicDef[] = [
  {
    id: 'golden_crown',
    name: 'Coroa Dourada',
    desc: '+20% de pontos em todas as linhas destruídas.',
    rarity: 'common',
    icon: 'crown',
    tags: ['lines'],
    synergies: ['combo', 'prism'],
    mods: { lineScoreMult: 0.2 },
    startUnlocked: true,
  },
  {
    id: 'amber_seal',
    name: 'Selo de Âmbar',
    desc: '+25% de pontos por bloco posicionado.',
    rarity: 'common',
    icon: 'seal',
    tags: ['economy'],
    synergies: ['precision'],
    mods: { placeScoreMult: 0.25 },
    startUnlocked: true,
  },
  {
    id: 'hourglass',
    name: 'Ampulheta',
    desc: '+1 jogada em cada estágio.',
    rarity: 'common',
    icon: 'hourglass',
    tags: ['precision'],
    synergies: ['economy'],
    mods: { extraMoves: 1 },
    startUnlocked: true,
  },
  {
    id: 'magnetic_glove',
    name: 'Luva Magnética',
    desc: 'Uma vez por estágio, devolva à bandeja a última peça colocada (se ela não limpou linha).',
    rarity: 'common',
    icon: 'glove',
    tags: ['precision'],
    synergies: ['combo'],
    mods: { canRecall: true },
    special: 'recall',
  },
  {
    id: 'mosaic_map',
    name: 'Mapa do Mosaico',
    desc: 'Peças grandes ficam mais raras; formas pequenas aparecem com mais frequência.',
    rarity: 'common',
    icon: 'map',
    tags: ['precision'],
    synergies: ['lines'],
    mods: { shapePreference: 'small' },
  },
  {
    id: 'artisan_charm',
    name: 'Amuleto do Artesão',
    desc: '+8 pontos fixos por bloco posicionado.',
    rarity: 'common',
    icon: 'charm',
    tags: ['economy'],
    synergies: ['precision'],
    mods: { placeFlat: 8 },
    startUnlocked: true,
  },
  {
    id: 'crystal_purse',
    name: 'Bolsa de Cristais',
    desc: '+25% de cristais ao final da run.',
    rarity: 'common',
    icon: 'purse',
    tags: ['economy'],
    synergies: ['precision'],
    mods: { crystalMult: 0.25 },
  },
  {
    id: 'glass_lens',
    name: 'Lente de Vidro',
    desc: 'A prévia de posicionamento mostra quantas linhas a jogada vai completar.',
    rarity: 'common',
    icon: 'lens',
    tags: ['precision'],
    synergies: ['lines'],
    mods: { glassLens: true },
    startUnlocked: true,
  },
  {
    id: 'explosive_crystal',
    name: 'Cristal Explosivo',
    desc: 'Ao destruir 2+ linhas de uma vez, cada linha extra destrói uma célula vizinha.',
    rarity: 'uncommon',
    icon: 'crystal',
    tags: ['lines'],
    synergies: ['combo', 'power'],
    special: 'explosive',
    startUnlocked: true,
  },
  {
    id: 'prismatic_core',
    name: 'Núcleo Prismático',
    desc: 'A cada 5 linhas destruídas, a próxima bandeja traz um Bloco Prisma.',
    rarity: 'uncommon',
    icon: 'core',
    tags: ['prism'],
    synergies: ['lines'],
    mods: { prismEvery: 5 },
    startUnlocked: true,
  },
  {
    id: 'combo_master',
    name: 'Combo Mestre',
    desc:
      'O multiplicador de combo cresce +0.15 por nível, o teto sobe para 3.0 e cada nível de combo gera +1 de energia.',
    rarity: 'uncommon',
    icon: 'combo',
    tags: ['combo'],
    synergies: ['lines', 'precision'],
    mods: { comboStep: 0.15, comboCap: 1, energyComboMult: 1 },
    startUnlocked: true,
  },
  {
    id: 'fragment_bomb',
    name: 'Bomba de Fragmentação',
    desc: '+1 carga da Bomba 3×3 em cada estágio.',
    rarity: 'uncommon',
    icon: 'bomb',
    tags: ['power'],
    synergies: ['lines'],
    mods: { baseCharges: { bomb: 1 } },
  },
  {
    id: 'golden_luck',
    name: 'Sorte Dourada',
    desc: '+20% de chance de vir uma peça especial na bandeja.',
    rarity: 'uncommon',
    icon: 'clover',
    tags: ['prism'],
    synergies: ['precision'],
    mods: { specialChance: 0.2 },
  },
  {
    id: 'void_compass',
    name: 'Bússola do Vazio',
    desc: '+25 pontos por célula vazia restante ao concluir o estágio.',
    rarity: 'uncommon',
    icon: 'compass',
    tags: ['precision'],
    synergies: ['economy'],
    mods: { emptyCellBonus: 25 },
  },
  {
    id: 'heavy_boots',
    name: 'Botas Pesadas',
    desc: 'Cada linha destruída concede +1 jogada (máximo de 3 por estágio).',
    rarity: 'uncommon',
    icon: 'boots',
    tags: ['precision'],
    synergies: ['lines'],
    mods: { extraMovesOnClear: 1, extraMovesOnClearCap: 3 },
    startUnlocked: true,
  },
  {
    id: 'silver_mirror',
    name: 'Espelho de Prata',
    desc: '20% de chance de duplicar os pontos de um posicionamento.',
    rarity: 'uncommon',
    icon: 'mirror',
    tags: ['economy'],
    synergies: ['combo'],
    mods: { mirrorChance: 0.2 },
    startUnlocked: true,
  },
  {
    id: 'fire_heart',
    name: 'Coração de Fogo',
    desc: 'Cada linha destruída queima as células corrompidas adjacentes a ela.',
    rarity: 'rare',
    icon: 'flame',
    tags: ['lines'],
    synergies: ['prism', 'combo'],
    special: 'fire',
    startUnlocked: true,
  },
  {
    id: 'blood_clock',
    name: 'Relógio de Sangue',
    desc: 'Cada jogada sem limpar linha acumula +8% de pontos (até +80%) e zera ao limpar.',
    rarity: 'rare',
    icon: 'clock',
    tags: ['precision'],
    synergies: ['combo'],
    mods: { noClearStreakBonus: 0.08 },
  },
  {
    id: 'strategist_eye',
    name: 'Olho do Estrategista',
    desc: 'A tela de recompensa oferece 4 cartas em vez de 3.',
    rarity: 'rare',
    icon: 'eye',
    tags: ['economy'],
    synergies: ['power'],
    mods: { rewardChoices: 1 },
  },
  {
    id: 'silver_chain',
    name: 'Corrente de Prata',
    desc: 'O combo não é reiniciado ao começar um novo estágio.',
    rarity: 'rare',
    icon: 'chain',
    tags: ['combo'],
    synergies: ['lines'],
    mods: { comboSafeAcrossStages: true },
  },
  {
    id: 'fortune_coin',
    name: 'Moeda da Fortuna',
    desc: '+1 reroll gratuito de recompensa por estágio.',
    rarity: 'rare',
    icon: 'coin',
    tags: ['economy'],
    synergies: ['precision'],
    mods: { rerollsPerStage: 1 },
  },
  {
    id: 'war_drill',
    name: 'Broca de Guerra',
    desc: '+1 carga da Broca (limpa uma linha) por estágio.',
    rarity: 'rare',
    icon: 'drill',
    tags: ['power'],
    synergies: ['lines'],
    mods: { baseCharges: { drill: 1 } },
    startUnlocked: true,
  },
  {
    id: 'gravity_gem',
    name: 'Gema de Gravidade',
    desc: 'Peças com 4+ blocos concedem +50% de pontos.',
    rarity: 'rare',
    icon: 'gem',
    tags: ['economy'],
    synergies: ['lines', 'combo'],
    mods: { bigPieceBonus: 0.5 },
    startUnlocked: true,
  },
  {
    id: 'prism_sun',
    name: 'Sol Prismático',
    desc: 'Gera um Bloco Prisma a cada 3 linhas destruídas (em vez de 5).',
    rarity: 'epic',
    icon: 'sun',
    tags: ['prism'],
    synergies: ['lines', 'combo'],
    mods: { prismEvery: 3 },
  },
  {
    id: 'combo_scepter',
    name: 'Cetro do Combo',
    desc: 'Posicionar uma peça de 4+ blocos não reinicia o combo.',
    rarity: 'epic',
    icon: 'scepter',
    tags: ['combo'],
    synergies: ['precision'],
    mods: { comboKeepOnBigPlace: 4 },
  },
  {
    id: 'time_glass',
    name: 'Vidro do Tempo',
    desc: '+2 jogadas por estágio, mas -10% de pontos em tudo.',
    rarity: 'epic',
    icon: 'glass',
    tags: ['precision'],
    synergies: ['economy'],
    mods: { extraMoves: 2, scoreMult: -0.1 },
  },
  {
    id: 'phoenix_crystal',
    name: 'Fênix de Cristal',
    desc: 'Uma vez por run: quando o tabuleiro travar, limpa 30% das células e a run continua.',
    rarity: 'epic',
    icon: 'phoenix',
    tags: ['lines'],
    synergies: ['power', 'precision'],
    special: 'phoenix',
  },
  {
    id: 'flood_sword',
    name: 'Espada do Dilúvio',
    desc: 'Destruir 3+ linhas ao mesmo tempo também varre a linha mais cheia do tabuleiro.',
    rarity: 'epic',
    icon: 'sword',
    tags: ['lines'],
    synergies: ['combo'],
    special: 'flood',
  },
  {
    id: 'synergy_link',
    name: 'Elo de Sinergia',
    desc: '+6% de pontos por cada relíquia rara, épica ou lendária equipada.',
    rarity: 'epic',
    icon: 'link',
    tags: ['economy'],
    synergies: ['combo', 'lines', 'prism', 'power', 'precision'],
    mods: { rareScoreBonus: 0.06 },
  },
  {
    id: 'void_crown',
    name: 'Coroa do Vazio',
    desc: 'Cada linha destruída consome 3 blocos da linha imediatamente acima.',
    rarity: 'legendary',
    icon: 'void',
    tags: ['lines'],
    synergies: ['combo', 'prism'],
    special: 'void_crown',
  },
  {
    id: 'golden_titan',
    name: 'Titã de Ouro',
    desc: '+100% de pontos por linha destruída, mas -1 jogada por estágio.',
    rarity: 'legendary',
    icon: 'titan',
    tags: ['lines'],
    synergies: ['combo'],
    mods: { lineScoreMult: 1, extraMoves: -1 },
  },
  {
    id: 'relicary',
    name: 'Relicário',
    desc: 'Ao escolher uma recompensa, receba também uma segunda relíquia.',
    rarity: 'legendary',
    icon: 'chest',
    tags: ['economy'],
    synergies: ['precision', 'power'],
    special: 'relicary',
  },
  {
    id: 'master_table',
    name: 'Mesa do Mestre',
    desc: '+1 carga de TODOS os poderes em cada estágio.',
    rarity: 'legendary',
    icon: 'table',
    tags: ['power'],
    synergies: ['lines', 'combo'],
    mods: { masterTable: true },
  },
  {
    id: 'fractal_tempo',
    name: 'Tempo Fractal',
    desc: 'A cada 5 níveis de combo, ganhe +1 jogada e +25% de pontos no estágio.',
    rarity: 'legendary',
    icon: 'spiral',
    tags: ['combo'],
    synergies: ['precision', 'lines'],
    special: 'fractal',
  },
  {
    id: 'energy_crystal',
    name: 'Cristal de Energia',
    desc: '+5 de energia por cada linha destruída.',
    rarity: 'common',
    icon: 'crystal',
    tags: ['lines'],
    synergies: ['power', 'combo'],
    mods: { energyOnLine: 5 },
  },
  {
    id: 'fragmenter',
    name: 'Fragmentador',
    desc: 'Gera +1 fragmento por linha destruída e +6 de energia ao destruir corrupção.',
    rarity: 'uncommon',
    icon: 'gem',
    tags: ['economy'],
    synergies: ['lines', 'precision'],
    mods: { fragmentGain: 1, energyOnSpecial: 6 },
  },
  {
    id: 'lucky_chest',
    name: 'Baú Afortunado',
    desc: '+60% de chance de eventos e recompensas aparecerem durante o estágio.',
    rarity: 'uncommon',
    icon: 'chest',
    tags: ['economy'],
    synergies: ['power', 'combo'],
    mods: { eventChance: 0.6 },
  },
  {
    id: 'arcane_battery',
    name: 'Bateria Arcana',
    desc: '+40 de capacidade máxima na barra de energia.',
    rarity: 'rare',
    icon: 'core',
    tags: ['power'],
    synergies: ['combo', 'lines'],
    mods: { energyMax: 40, energyMult: 0.1 },
  },
  {
    id: 'itinerant_merchant',
    name: 'Comerciante Itinerante',
    desc: '-30% no custo de poderes e melhorias em mercadores e eventos.',
    rarity: 'rare',
    icon: 'coin',
    tags: ['economy'],
    synergies: ['power'],
    mods: { shopDiscount: 0.3 },
  },
  {
    id: 'duplicator',
    name: 'Duplicador',
    desc: '22% de chance de duplicar uma recompensa de habilidade ou energia.',
    rarity: 'epic',
    icon: 'mirror',
    tags: ['power'],
    synergies: ['economy', 'combo'],
    mods: { rewardDupeChance: 0.22, powerRewardChance: 0.15 },
  },
];

export const RELIC_MAP: Record<string, RelicDef> = Object.fromEntries(
  RELICS.map((relic) => [relic.id, relic]),
);

export const DEFAULT_UNLOCKED: string[] = RELICS.filter((relic) => relic.startUnlocked).map(
  (relic) => relic.id,
);

export function relicById(id: string): RelicDef | undefined {
  return RELIC_MAP[id];
}

export const TALENT_STARTING_RELICS = 0;

export interface TalentModInput {
  power_start?: number;
  crystal_flow?: number;
  extra_reroll?: number;
  vital_moves?: number;
}

/** Soma todos os modificadores das relíquias + talentos + modificador de estágio. */
export function deriveMods(
  relicIds: readonly string[],
  talents: TalentModInput = {},
  modifier: string | null = null,
): RunMods {
  const mods = defaultMods();
  const charges: Partial<Record<keyof RunMods['baseCharges'], number>> = {};

  for (const id of relicIds) {
    const relic = RELIC_MAP[id];
    if (!relic?.mods) continue;
    const entry = relic.mods;
    for (const key of Object.keys(entry) as (keyof RunMods)[]) {
      const value = entry[key];
      if (value === undefined) continue;
      if (key === 'baseCharges') {
        const source = value as Partial<Record<string, number>>;
        for (const powerId of Object.keys(source)) {
          const current = (charges[powerId as keyof typeof charges] ?? 0) + (source[powerId] ?? 0);
          charges[powerId as keyof typeof charges] = current;
        }
        continue;
      }
      if (key === 'shapePreference') {
        mods.shapePreference = value as RunMods['shapePreference'];
        continue;
      }
      if (typeof value === 'boolean') {
        (mods[key] as unknown as boolean) = true;
        continue;
      }
      if (typeof value === 'number') {
        (mods[key] as unknown as number) = (mods[key] as unknown as number) + value;
      }
    }
  }

  // Talentos permanentes
  if (talents.power_start) charges.hammer = (charges.hammer ?? 0) + talents.power_start;
  if (talents.crystal_flow) mods.crystalMult += 0.08 * talents.crystal_flow;
  if (talents.extra_reroll) mods.rerollsPerStage += talents.extra_reroll;
  if (talents.vital_moves) mods.extraMoves += Math.min(2, talents.vital_moves);

  // Modificadores de estágio que afetam números
  if (modifier === 'low_moves') mods.scoreMult += 0.15;
  if (modifier === 'heavy') mods.shapePreference = 'heavy';
  if (modifier === 'prism_rain') mods.specialChance += 0.2;
  if (modifier === 'combo_hunger') mods.comboStep += 0.1;
  if (modifier === 'precise') mods.specialChance = 0;

  mods.baseCharges = charges;
  mods.scoreMult = Math.max(0.5, mods.scoreMult);
  mods.comboCap = Math.max(1.25, mods.comboCap);
  mods.rewardChoices = Math.max(3, mods.rewardChoices);
  mods.prismEvery = mods.prismEvery > 0 ? mods.prismEvery : 0;
  return mods;
}

export function rarePlusCount(relicIds: readonly string[]): number {
  let count = 0;
  for (const id of relicIds) {
    const relic = RELIC_MAP[id];
    if (!relic) continue;
    if (relic.rarity === 'rare' || relic.rarity === 'epic' || relic.rarity === 'legendary') count += 1;
  }
  return count;
}

export function hasRelic(relicIds: readonly string[], id: string): boolean {
  return relicIds.includes(id);
}

export function relicRarityWeight(rarity: Rarity, stageNumber: number): number {
  const stageBias = Math.max(0, stageNumber - 1) * 0.012;
  if (rarity === 'common') return RARITY_WEIGHT.common;
  if (rarity === 'uncommon') return RARITY_WEIGHT.uncommon;
  if (rarity === 'rare') return RARITY_WEIGHT.rare + stageBias * 20;
  if (rarity === 'epic') return RARITY_WEIGHT.epic + stageBias * 12;
  return RARITY_WEIGHT.legendary + stageBias * 8;
}

/** Sorteia recompensas sem repetição, respeitando o pool desbloqueado. */
export function rollRewardOptions(
  rng: Rng,
  unlocked: readonly string[],
  owned: readonly string[],
  count: number,
  stageNumber: number,
): string[] {
  const pool = unlocked.filter((id) => RELIC_MAP[id] && !owned.includes(id));
  const picked: string[] = [];
  const available = pool.slice();
  while (picked.length < count && available.length > 0) {
    const weights = available.map((id) => {
      const relic = RELIC_MAP[id] as RelicDef;
      return { item: id, weight: relicRarityWeight(relic.rarity, stageNumber) };
    });
    const choice = rng.weighted(weights);
    if (!choice) break;
    picked.push(choice);
    available.splice(available.indexOf(choice), 1);
  }
  return picked;
}
