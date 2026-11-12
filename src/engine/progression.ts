import type {
  ActionResult,
  EnergyState,
  GameEvent,
  PowerId,
  RewardChoice,
  RunMods,
  RunState,
  StageEventKind,
  StageEventOffer,
} from './types';
import { Rng } from './rng';
import { POWER_MAP, POWER_ORDER, powerLevelInfo, powerMaxLevel } from './powers';
import { RELIC_MAP, rollRewardOptions } from './relics';
import { getMods } from './mods';

/**
 * Progressão in-run: barra de energia, recompensas por desempenho, eventos de
 * estágio e evolução de poderes. Todo o estado vive em `RunState`; as funções
 * abaixo são comandos imutáveis (clonam o estado, devolvem eventos).
 */

export const BASE_ENERGY_MAX = 100;
export const ENERGY_PER_PLACEMENT = 4;
export const ENERGY_PER_BLOCK = 1;
export const ENERGY_PER_LINE = 12;
export const ENERGY_PER_EXTRA_LINE = 8;
export const ENERGY_PER_COMBO = 2;
export const ENERGY_COMBO_CAP = 8;
export const ENERGY_PER_CORRUPT = 6;
export const ENERGY_PER_SPECIAL = 6;
export const MAX_PENDING_ENERGY_REWARDS = 3;

export interface PlacementEnergyInput {
  placed: number;
  blocks: number;
  lines: number;
  extraLines: number;
  combo: number;
  corrupt: number;
  special: boolean;
}

/** Fórmula única de energia — usada pela jogada real e pelo preview. */
export function energyForPlacement(input: PlacementEnergyInput, mods: RunMods): number {
  const comboBonus = Math.min(ENERGY_COMBO_CAP, input.combo * ENERGY_PER_COMBO);
  const base =
    input.placed * ENERGY_PER_PLACEMENT +
    input.blocks * ENERGY_PER_BLOCK +
    input.lines * ENERGY_PER_LINE +
    input.extraLines * ENERGY_PER_EXTRA_LINE +
    comboBonus +
    input.corrupt * (ENERGY_PER_CORRUPT + mods.energyOnSpecial) +
    (input.special ? ENERGY_PER_SPECIAL : 0);
  const flat =
    input.lines * mods.energyOnLine +
    Math.min(ENERGY_COMBO_CAP, input.combo * mods.energyComboMult);
  return Math.max(0, Math.round((base + flat) * mods.energyMult));
}

export function energyMaxFor(mods: RunMods): number {
  return Math.max(50, Math.round(BASE_ENERGY_MAX + mods.energyMax));
}

export function initialEnergy(mods: RunMods): EnergyState {
  return { value: 0, max: energyMaxFor(mods), pending: 0, earned: 0, claimed: 0, offer: null };
}

/** Reajusta o teto após ganhar/perder relíquias que mudam a capacidade. */
export function syncEnergyMax(state: RunState): void {
  const max = energyMaxFor(getMods(state));
  state.energy.max = max;
  state.energy.value = Math.max(0, Math.min(max, state.energy.value));
}

function cloneRunState(state: RunState): RunState {
  return structuredClone(state);
}

/**
 * Única porta de entrada de energia. Ao cruzar o limite, gera uma pendência e
 * uma oferta determinística (o jogador escolhe quando quiser, sem modal forçado).
 */
export function addEnergy(
  state: RunState,
  amount: number,
  rng: Rng,
  events: GameEvent[],
): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const max = Math.max(1, state.energy.max);
  state.energy.value += amount;
  state.energy.earned += amount;
  let ready = false;
  while (state.energy.value >= max && state.energy.pending < MAX_PENDING_ENERGY_REWARDS) {
    state.energy.value -= max;
    state.energy.pending += 1;
    ready = true;
    events.push({ type: 'energyReady', pending: state.energy.pending });
  }
  if (state.energy.value > max) state.energy.value = max;
  events.push({ type: 'energy', value: state.energy.value, max, gain: amount });
  if (ready && !state.energy.offer) {
    state.energy.offer = rollEnergyOffer(state, rng);
  }
}


/** Relíquias que podem ser sorteadas em eventos/recompensas. */
function rollRelic(state: RunState, rng: Rng): string | null {
  const picks = rollRewardOptions(rng, state.unlockedRelics, state.relics, 1, state.stage.number);
  return picks[0] ?? null;
}

function relicChoice(state: RunState, rng: Rng, swap: boolean): RewardChoice | null {
  const id = rollRelic(state, rng);
  if (!id) return null;
  const relic = RELIC_MAP[id];
  if (!relic) return null;
  return {
    id: `relic:${id}`,
    kind: 'relic',
    label: relic.name,
    desc: swap ? `Troca sua última relíquia por ${relic.name}.` : relic.desc,
    rarity: relic.rarity,
    swap,
  };
}

function chargeChoice(power: PowerId, amount: number): RewardChoice {
  const def = POWER_MAP[power];
  return {
    id: `charges:${power}`,
    kind: 'charges',
    power,
    amount,
    label: amount > 1 ? `${def.name} +${amount}` : `${def.name} +1`,
    desc: `Carga extra de ${def.name}.`,
    rarity: 'common',
  };
}

function upgradeChoice(state: RunState, power: PowerId): RewardChoice | null {
  const current = state.powerLevels[power] ?? 1;
  if (current >= powerMaxLevel(power)) return null;
  const next = powerLevelInfo(power, current + 1);
  return {
    id: `power_up:${power}`,
    kind: 'power_up',
    power,
    level: next.level,
    label: next.name,
    desc: next.desc,
    rarity: 'rare',
  };
}

function newPowerChoice(power: PowerId): RewardChoice {
  const def = POWER_MAP[power];
  return {
    id: `new_power:${power}`,
    kind: 'new_power',
    power,
    amount: 1,
    label: def.name,
    desc: `${def.desc} Você recebe 1 carga imediata.`,
    rarity: 'epic',
  };
}

function energyChoice(amount: number, label = 'Energia'): RewardChoice {
  return {
    id: `energy:${amount}`,
    kind: 'energy',
    amount,
    label: `${label} +${amount}`,
    desc: `Adiciona ${amount} à barra de energia.`,
    rarity: 'common',
  };
}

function crystalsChoice(amount: number): RewardChoice {
  return {
    id: `crystals:${amount}`,
    kind: 'crystals',
    amount,
    label: `Cristais +${amount}`,
    desc: 'Cristais da run, usados em mercadores e eventos.',
    rarity: 'common',
  };
}

function fragmentsChoice(amount: number): RewardChoice {
  return {
    id: `fragments:${amount}`,
    kind: 'fragments',
    amount,
    label: `Fragmentos +${amount}`,
    desc: 'Fragmentos energéticos para trocas e ofertas raras.',
    rarity: 'uncommon',
  };
}

export function ownedPowers(state: RunState): PowerId[] {
  return POWER_ORDER.filter((id) => state.unlockedPowers.includes(id));
}

export function lockedPowers(state: RunState): PowerId[] {
  return POWER_ORDER.filter((id) => !state.unlockedPowers.includes(id));
}

export function upgradeablePowers(state: RunState): PowerId[] {
  return ownedPowers(state).filter((id) => (state.powerLevels[id] ?? 1) < powerMaxLevel(id));
}

/**
 * Sorteia 3 recompensas diferentes para a barra de energia.
 * Determinístico: mesma seed + mesmo estado ⇒ mesma oferta.
 */
export function rollEnergyOffer(state: RunState, rng: Rng): RewardChoice[] {
  const owned = ownedPowers(state);
  const upgradeable = upgradeablePowers(state);
  const locked = lockedPowers(state);
  const pool: { item: string; weight: number }[] = [];
  if (upgradeable.length > 0) pool.push({ item: 'power_up', weight: 32 });
  if (owned.length > 0) pool.push({ item: 'charges', weight: 26 });
  if (locked.length > 0) pool.push({ item: 'new_power', weight: 18 });
  pool.push({ item: 'energy', weight: 12 });
  pool.push({ item: 'crystals', weight: 10 });
  pool.push({ item: 'fragments', weight: 8 });

  const picked: RewardChoice[] = [];
  const usedKinds = new Set<string>();
  for (let attempt = 0; attempt < 12 && picked.length < 3; attempt += 1) {
    const kind = rng.weighted(pool);
    if (!kind || usedKinds.has(kind)) continue;
    usedKinds.add(kind);
    if (kind === 'power_up') {
      const power = rng.pick(upgradeable);
      const choice = power ? upgradeChoice(state, power) : null;
      if (choice) picked.push(choice);
      continue;
    }
    if (kind === 'charges') {
      const power = rng.pick(owned);
      if (power) picked.push(chargeChoice(power, 1));
      continue;
    }
    if (kind === 'new_power') {
      const power = rng.pick(locked);
      if (power) picked.push(newPowerChoice(power));
      continue;
    }
    if (kind === 'energy') picked.push(energyChoice(20 + rng.int(11)));
    else if (kind === 'crystals') picked.push(crystalsChoice(30 + rng.int(21)));
    else picked.push(fragmentsChoice(2 + rng.int(3)));
  }
  if (picked.length === 0) picked.push(energyChoice(20));
  return picked;
}

/** Desbloqueia um poder na run (persistente entre estágios). */
export function grantPower(state: RunState, power: PowerId, events: GameEvent[]): void {
  if (state.unlockedPowers.includes(power)) return;
  state.unlockedPowers.push(power);
  if (!state.powerLevels[power]) state.powerLevels[power] = 1;
  events.push({ type: 'powerGranted', power });
  events.push({ type: 'toast', text: `${POWER_MAP[power].name} desbloqueado!`, tone: 'gold' });
}

/** Concede cargas (e desbloqueia se necessário). */
export function grantCharges(
  state: RunState,
  power: PowerId,
  amount: number,
  events: GameEvent[],
): void {
  if (amount <= 0) return;
  grantPower(state, power, events);
  state.stage.charges[power] = (state.stage.charges[power] ?? 0) + amount;
  events.push({ type: 'powerGranted', power });
}

/** Evolui um poder; devolve false se já está no nível máximo. */
export function levelUpPower(state: RunState, power: PowerId, events: GameEvent[]): boolean {
  const current = state.powerLevels[power] ?? 1;
  if (current >= powerMaxLevel(power)) return false;
  state.powerLevels[power] = current + 1;
  events.push({ type: 'powerUp', power, level: current + 1 });
  events.push({
    type: 'toast',
    text: `${POWER_MAP[power].name} evoluiu para o nível ${current + 1}!`,
    tone: 'gold',
  });
  return true;
}

export function addFragments(state: RunState, amount: number, events: GameEvent[]): void {
  if (amount <= 0) return;
  state.fragments += amount;
  events.push({ type: 'fragment', amount });
}

/**
 * Aplica uma escolha (energia/evento). Nunca é chamada duas vezes para a mesma
 * opção: quem chama consome `pending`/`pendingEvent` de forma atômica.
 */
export function applyRewardChoice(
  state: RunState,
  choice: RewardChoice,
  rng: Rng,
  events: GameEvent[],
  depth = 0,
): void {
  const amount = choice.amount ?? 1;
  switch (choice.kind) {
    case 'charges':
      if (choice.power) grantCharges(state, choice.power, amount, events);
      break;
    case 'new_power':
      if (choice.power) grantCharges(state, choice.power, amount, events);
      break;
    case 'power_up':
      if (choice.power) {
        // Oferta pode ter ficado obsoleta (poder já no nível máximo): vira carga extra.
        if (!levelUpPower(state, choice.power, events)) {
          grantCharges(state, choice.power, 1, events);
        }
      }
      break;
    case 'energy':
      addEnergy(state, amount, rng, events);
      break;
    case 'crystals':
      state.crystals += amount;
      events.push({ type: 'toast', text: `+${amount} cristais`, tone: 'gold' });
      break;
    case 'fragments':
      addFragments(state, amount, events);
      break;
    case 'relic': {
      if (choice.swap && state.relics.length > 0) state.relics.pop();
      const id = rollRelic(state, rng);
      if (id) {
        state.relics.push(id);
        syncEnergyMax(state);
        events.push({ type: 'relic', id });
      }
      break;
    }
    default:
      break;
  }

  events.push({
    type: 'rewardClaimed',
    kind: choice.kind,
    label: choice.label,
    power: choice.power,
    level: choice.level,
  });

  const mods = getMods(state);
  const duplicable =
    choice.kind === 'charges' ||
    choice.kind === 'new_power' ||
    choice.kind === 'power_up' ||
    choice.kind === 'energy';
  if (depth === 0 && duplicable && mods.rewardDupeChance > 0 && rng.chance(mods.rewardDupeChance)) {
    events.push({ type: 'toast', text: 'Duplicador: recompensa repetida!', tone: 'gold' });
    applyRewardChoice(state, choice, rng, events, depth + 1);
  }
}

export function claimEnergyReward(stateIn: RunState, choiceId: string): ActionResult {
  if (stateIn.status !== 'playing') {
    return { ok: false, state: stateIn, events: [], reason: 'A run não está em andamento.' };
  }
  const offer = stateIn.energy.offer;
  if (stateIn.energy.pending <= 0 || !offer) {
    return { ok: false, state: stateIn, events: [], reason: 'Nenhuma recompensa de energia disponível.' };
  }
  const choice = offer.find((entry) => entry.id === choiceId);
  if (!choice) {
    return { ok: false, state: stateIn, events: [], reason: 'Recompensa inválida.' };
  }

  const state = cloneRunState(stateIn);
  const events: GameEvent[] = [];
  const rng = new Rng(state.rngState);
  state.energy.pending = Math.max(0, state.energy.pending - 1);
  state.energy.claimed += 1;
  state.energy.offer = null;
  applyRewardChoice(state, choice, rng, events);
  if (state.energy.pending > 0) {
    state.energy.offer = rollEnergyOffer(state, rng);
  }
  state.rngState = rng.state;
  return { ok: true, state, events };
}



/* ============================ Eventos de estágio ============================ */

export const EVENT_MIN_MOVES = 3;
export const EVENT_MOVE_CHANCE = 0.1;

export const EVENT_WEIGHTS: { kind: StageEventKind; weight: number }[] = [
  { kind: 'fragment', weight: 30 },
  { kind: 'chest', weight: 28 },
  { kind: 'portal', weight: 16 },
  { kind: 'merchant', weight: 14 },
  { kind: 'sanctuary', weight: 12 },
];

/** Chance de um evento aparecer nesta jogada (0 quando inelegível). */
export function eventChanceFor(state: RunState, mods: RunMods): number {
  if (state.pendingEvent || state.energy.pending > 0) return 0;
  const cap = 2 + Math.floor(state.stage.index / 2);
  if (state.eventsThisStage >= cap) return 0;
  if (state.eventMoves < EVENT_MIN_MOVES) return 0;
  const base = Math.min(0.28, EVENT_MOVE_CHANCE + state.stage.index * 0.02);
  return Math.min(0.45, base * (1 + mods.eventChance));
}

function uniqueChoices(list: (RewardChoice | null)[]): RewardChoice[] {
  const seen = new Set<string>();
  const out: RewardChoice[] = [];
  for (const choice of list) {
    if (!choice || seen.has(choice.id)) continue;
    seen.add(choice.id);
    out.push(choice);
  }
  return out;
}

function merchantCost(base: number, mods: RunMods): number {
  const discount = Math.max(0, Math.min(0.7, mods.shopDiscount));
  return Math.max(10, Math.round(base * (1 - discount)));
}

export function buildStageEventOffer(
  state: RunState,
  kind: StageEventKind,
  rng: Rng,
): StageEventOffer | null {
  const mods = getMods(state);
  const owned = ownedPowers(state);
  const locked = lockedPowers(state);
  const upgradeable = upgradeablePowers(state);
  const withCost = (choice: RewardChoice | null, base: number): RewardChoice | null =>
    choice ? { ...choice, cost: merchantCost(base, mods) } : null;

  if (kind === 'chest') {
    const options = uniqueChoices([
      locked.length > 0
        ? newPowerChoice(rng.pick(locked))
        : owned.length > 0
          ? chargeChoice(rng.pick(owned), 2)
          : null,
      owned.length > 0 ? chargeChoice(rng.pick(owned), 2) : null,
      crystalsChoice(50 + rng.int(21)),
      fragmentsChoice(3 + rng.int(3)),
    ]).slice(0, 3);
    return {
      id: `chest:${state.moveCount}`,
      kind,
      title: 'Baú Misterioso',
      desc: 'Um baú antigo se abre: escolha um dos tesouros.',
      options,
    };
  }

  if (kind === 'portal') {
    const shuffled = rng.shuffle(upgradeable);
    const options = uniqueChoices([
      shuffled[0] ? upgradeChoice(state, shuffled[0]) : null,
      shuffled[1] ? upgradeChoice(state, shuffled[1]) : null,
      owned.length > 0 ? chargeChoice(rng.pick(owned), 2) : null,
      energyChoice(18),
    ]).slice(0, 3);
    return {
      id: `portal:${state.moveCount}`,
      kind,
      title: 'Portal Arcano',
      desc: 'Duas melhorias diferentes brilham no portal.',
      options,
    };
  }

  if (kind === 'merchant') {
    const shuffledUpgrades = rng.shuffle(upgradeable);
    const crystalUpgrade = shuffledUpgrades[0] ? upgradeChoice(state, shuffledUpgrades[0]) : null;
    const fragmentBase = shuffledUpgrades[1]
      ? upgradeChoice(state, shuffledUpgrades[1])
      : shuffledUpgrades[0]
        ? upgradeChoice(state, shuffledUpgrades[0])
        : null;
    const fragmentUpgrade = fragmentBase
      ? { ...fragmentBase, id: `${fragmentBase.id}:frag`, fragmentCost: 3 }
      : null;
    const options = uniqueChoices([
      locked.length > 0 ? withCost(newPowerChoice(rng.pick(locked)), 90) : null,
      withCost(crystalUpgrade, 60),
      owned.length > 0 ? withCost(chargeChoice(rng.pick(owned), 2), 30) : null,
      fragmentUpgrade,
    ]).slice(0, 4);
    return {
      id: `merchant:${state.moveCount}`,
      kind,
      title: 'Mercador Itinerante',
      desc: 'Gaste cristais ou fragmentos em poderes, cargas e melhorias.',
      options,
    };
  }

  if (kind === 'sanctuary') {
    const options = uniqueChoices([
      energyChoice(25),
      owned.length > 0 ? chargeChoice(rng.pick(owned), 1) : null,
      upgradeable.length > 0 ? upgradeChoice(state, rng.pick(upgradeable)) : null,
      relicChoice(state, rng, true),
    ]).slice(0, 3);
    return {
      id: `sanctuary:${state.moveCount}`,
      kind,
      title: 'Santuário',
      desc: 'A energia antiga oferece uma escolha serena.',
      options,
    };
  }

  return null;
}

export interface StageEventOverride {
  title: string;
  desc: string;
}

/**
 * Materializa um evento. `fragment` é automático; os demais viram uma oferta
 * discreta que o jogador abre quando quiser.
 */
export function spawnStageEvent(
  state: RunState,
  kind: StageEventKind,
  rng: Rng,
  events: GameEvent[],
  override?: StageEventOverride,
): void {
  state.eventMoves = 0;
  state.eventsThisStage += 1;

  if (kind === 'fragment') {
    const energy = 18 + rng.int(12);
    addEnergy(state, energy, rng, events);
    state.crystals += 6 + rng.int(10);
    events.push({ type: 'stageEvent', kind, title: 'Fragmento de Energia' });
    events.push({
      type: 'toast',
      text: `Fragmento de energia: +${energy} de energia e cristais.`,
      tone: 'gold',
    });
    return;
  }

  const offer = buildStageEventOffer(state, kind, rng);
  if (!offer || offer.options.length === 0) {
    addEnergy(state, 15, rng, events);
    return;
  }
  if (override) {
    offer.title = override.title;
    offer.desc = override.desc;
  }
  state.pendingEvent = offer;
  events.push({ type: 'stageEvent', kind, title: offer.title });
  events.push({ type: 'toast', text: `${offer.title} disponível!`, tone: 'gold' });
}

/** Roda após cada jogada confirmada; respeita cooldown e limites por estágio. */
export function maybeSpawnStageEvent(state: RunState, rng: Rng, events: GameEvent[]): void {
  if (state.status !== 'playing') return;
  const mods = getMods(state);
  const chance = eventChanceFor(state, mods);
  if (chance <= 0) return;
  if (!rng.chance(chance)) return;
  const kind =
    rng.weighted(EVENT_WEIGHTS.map((entry) => ({ item: entry.kind, weight: entry.weight }))) ??
    'fragment';
  spawnStageEvent(state, kind, rng, events);
}

/** Aplica (ou recusa) a oferta pendente. Consome o evento em qualquer caso. */
export function resolveStageEvent(stateIn: RunState, optionId: string | null): ActionResult {
  if (stateIn.status !== 'playing') {
    return { ok: false, state: stateIn, events: [], reason: 'A run não está em andamento.' };
  }
  const offer = stateIn.pendingEvent;
  if (!offer) {
    return { ok: false, state: stateIn, events: [], reason: 'Nenhum evento disponível.' };
  }

  const state = cloneRunState(stateIn);
  const events: GameEvent[] = [];
  const rng = new Rng(state.rngState);
  state.pendingEvent = null;
  state.eventMoves = 0;

  if (optionId) {
    const option = offer.options.find((entry) => entry.id === optionId);
    if (!option) {
      return { ok: false, state: stateIn, events: [], reason: 'Opção inválida.' };
    }
    const cost = option.cost ?? 0;
    if (cost > 0) {
      if (state.crystals < cost) {
        return { ok: false, state: stateIn, events: [], reason: 'Cristais insuficientes.' };
      }
      state.crystals -= cost;
    }
    const fragmentCost = option.fragmentCost ?? 0;
    if (fragmentCost > 0) {
      if (state.fragments < fragmentCost) {
        return { ok: false, state: stateIn, events: [], reason: 'Fragmentos insuficientes.' };
      }
      state.fragments -= fragmentCost;
    }
    applyRewardChoice(state, option, rng, events);
  } else {
    events.push({ type: 'toast', text: `${offer.title} ignorado.`, tone: 'info' });
  }

  state.rngState = rng.state;
  return { ok: true, state, events };
}

/* ====================== Recompensas por desempenho ======================== */

export interface PerformanceInput {
  lines: number;
  combo: number;
  comboBefore: number;
  corruptDestroyed: number;
  gained: number;
  bestDropBefore: number;
  secondaryCompleted: boolean;
}

/**
 * No máximo uma recompensa de desempenho por jogada. Prioriza objetivo
 * secundário > 3+ linhas > marco de combo > purificação > jogada excepcional.
 */
export function performanceRewards(
  state: RunState,
  input: PerformanceInput,
  rng: Rng,
  events: GameEvent[],
): void {
  if (state.status !== 'playing') return;
  if (state.pendingEvent || state.energy.pending > 0) return;
  const mods = getMods(state);
  const owned = ownedPowers(state);

  const chargeRandom = (text: string): boolean => {
    if (owned.length === 0) return false;
    grantCharges(state, rng.pick(owned), 1, events);
    events.push({ type: 'toast', text, tone: 'gold' });
    return true;
  };

  if (input.secondaryCompleted) {
    spawnStageEvent(state, 'sanctuary', rng, events, {
      title: 'Objetivo Secundário',
      desc: 'Jogada precisa: escolha um bônus.',
    });
    return;
  }

  if (input.lines >= 3 && rng.chance(Math.min(0.9, 0.45 + mods.powerRewardChance))) {
    if (chargeRandom('Jogada tripla: +1 carga de poder!')) return;
  }

  if (input.combo >= 5 && input.comboBefore < 5) {
    addEnergy(state, 12 + Math.round(mods.energyOnLine), rng, events);
    events.push({ type: 'toast', text: `Combo ${input.combo}: energia extra!`, tone: 'good' });
    return;
  }

  if (input.corruptDestroyed >= 3 && chargeRandom('Purificação: +1 carga de poder!')) return;

  if (input.gained >= 1500 && input.bestDropBefore < 1500) {
    state.crystals += 40;
    addEnergy(state, 20, rng, events);
    events.push({ type: 'toast', text: 'Jogada excepcional: cristais e energia!', tone: 'gold' });
  }
}

