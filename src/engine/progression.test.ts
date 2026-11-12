import { describe, expect, it } from 'vitest';
import {
  addEnergy,
  applyRewardChoice,
  claimEnergyReward,
  energyForPlacement,
  energyMaxFor,
  eventChanceFor,
  maybeSpawnStageEvent,
  performanceRewards,
  resolveStageEvent,
  rollEnergyOffer,
  spawnStageEvent,
  syncEnergyMax,
} from './progression';
import { getMods } from './mods';
import { Rng } from './rng';
import { placePiece, usePower } from './run';
import { deriveMods } from './relics';
import { defaultMods } from './scoring';
import { countCompletingPlacements } from './pieces';
import { createBoard } from './board';
import { fillRow, freshRun, setCell, setTrayShape } from './testing';
import type { GameEvent, RewardChoice } from './types';

function energyInput(overrides: Partial<Parameters<typeof energyForPlacement>[0]> = {}) {
  return {
    placed: 1,
    blocks: 3,
    lines: 0,
    extraLines: 0,
    combo: 0,
    corrupt: 0,
    special: false,
    ...overrides,
  };
}

describe('barra de energia', () => {
  it('cresce com linhas, combo e relíquias', () => {
    const mods = defaultMods();
    const base = energyForPlacement(energyInput(), mods);
    const withLine = energyForPlacement(energyInput({ lines: 1, extraLines: 0 }), mods);
    const withCombo = energyForPlacement(energyInput({ combo: 4 }), mods);
    expect(withLine).toBeGreaterThan(base);
    expect(withCombo).toBeGreaterThan(base);

    const crystal = deriveMods(['energy_crystal'], {}, null);
    const relicGain = energyForPlacement(energyInput({ lines: 2, extraLines: 1 }), crystal);
    const baseGain = energyForPlacement(energyInput({ lines: 2, extraLines: 1 }), mods);
    expect(relicGain - baseGain).toBe(10);
  });

  it('ao encher gera pendência e uma oferta de 2 a 3 escolhas', () => {
    const run = freshRun(60);
    const events: GameEvent[] = [];
    run.energy.value = run.energy.max - 1;
    addEnergy(run, 10, new Rng(7), events);

    expect(run.energy.pending).toBe(1);
    expect(run.energy.value).toBe(9);
    expect(run.energy.offer?.length).toBeGreaterThanOrEqual(2);
    expect(run.energy.offer?.length).toBeLessThanOrEqual(3);
    expect(events.some((event) => event.type === 'energyReady')).toBe(true);
  });

  it('recompensa é aplicada uma única vez e some da oferta', () => {
    const run = freshRun(61);
    run.energy.value = run.energy.max - 1;
    addEnergy(run, 10, new Rng(11), []);
    const offer = run.energy.offer as RewardChoice[];
    const choice = offer[0] as RewardChoice;

    const first = claimEnergyReward(run, choice.id);
    expect(first.ok).toBe(true);
    expect(first.state.energy.pending).toBe(0);
    expect(first.state.energy.claimed).toBe(1);
    expect(first.state.energy.offer).toBeNull();

    const again = claimEnergyReward(first.state, choice.id);
    expect(again.ok).toBe(false);
    expect(again.state.energy.claimed).toBe(1);
  });

  it('não acumula pendências infinitas', () => {
    const run = freshRun(62);
    run.energy.value = run.energy.max - 1;
    for (let i = 0; i < 6; i += 1) addEnergy(run, run.energy.max, new Rng(i + 1), []);
    expect(run.energy.pending).toBeLessThanOrEqual(3);
    expect(run.energy.value).toBeLessThanOrEqual(run.energy.max);
  });

  it('a oferta inclui apenas poderes que o jogador possui', () => {
    const run = freshRun(63);
    const offer = rollEnergyOffer(run, new Rng(5));
    expect(offer.length).toBeGreaterThan(0);
    for (const choice of offer) {
      if (choice.kind === 'charges' || choice.kind === 'power_up') {
        expect(run.unlockedPowers).toContain(choice.power);
      }
    }
  });

  it('Bateria Arcana aumenta a capacidade máxima', () => {
    const run = freshRun(64);
    run.relics.push('arcane_battery');
    syncEnergyMax(run);
    expect(run.energy.max).toBe(energyMaxFor(getMods(run)));
    expect(run.energy.max).toBeGreaterThan(100);
  });
});

describe('eventos durante o estágio', () => {
  it('respeita o cooldown de jogadas e o limite por estágio', () => {
    const run = freshRun(70);
    const mods = getMods(run);
    expect(eventChanceFor(run, mods)).toBe(0);
    run.eventMoves = 10;
    expect(eventChanceFor(run, mods)).toBeGreaterThan(0);
    run.pendingEvent = { id: 'x', kind: 'chest', title: 'Teste', desc: '', options: [] };
    expect(eventChanceFor(run, mods)).toBe(0);
    run.pendingEvent = null;
    run.energy.pending = 1;
    expect(eventChanceFor(run, mods)).toBe(0);
    run.energy.pending = 0;
    run.eventsThisStage = 99;
    expect(eventChanceFor(run, mods)).toBe(0);
  });

  it('Baú Afortunado aumenta a chance de eventos', () => {
    const run = freshRun(71);
    run.eventMoves = 10;
    const plain = eventChanceFor(run, getMods(run));
    run.relics.push('lucky_chest');
    expect(eventChanceFor(run, getMods(run))).toBeGreaterThan(plain);
  });

  it('eventos aparecem com o RNG da run e podem ser resolvidos uma vez', () => {
    const run = freshRun(72);
    const events: GameEvent[] = [];
    let spawned = false;
    for (let attempt = 0; attempt < 40 && !spawned; attempt += 1) {
      run.eventMoves = 5;
      run.eventsThisStage = 0;
      run.pendingEvent = null;
      maybeSpawnStageEvent(run, new Rng(200 + attempt), events);
      spawned = run.pendingEvent !== null || events.some((event) => event.type === 'stageEvent');
    }
    expect(spawned).toBe(true);
    if (!run.pendingEvent) return;

    const offer = run.pendingEvent;
    const resolved = resolveStageEvent(run, offer.options[0]?.id ?? null);
    expect(resolved.ok).toBe(true);
    expect(resolved.state.pendingEvent).toBeNull();
    expect(resolveStageEvent(resolved.state, offer.options[0]?.id ?? null).ok).toBe(false);
  });

  it('mercador cobra cristais da run e falha sem saldo', () => {
    const run = freshRun(73);
    for (let r = 0; r < 4; r += 1) fillRow(run, r, []);
    spawnStageEvent(run, 'merchant', new Rng(9), []);
    const offer = run.pendingEvent;
    expect(offer).not.toBeNull();
    if (!offer) return;
    const paid = offer.options.find((option) => (option.cost ?? 0) > 0);
    if (!paid) return;

    run.crystals = 0;
    expect(resolveStageEvent(run, paid.id).ok).toBe(false);

    run.crystals = 500;
    const resolved = resolveStageEvent(run, paid.id);
    expect(resolved.ok).toBe(true);
    expect(resolved.state.crystals).toBe(500 - (paid.cost ?? 0));
  });

  it('Comerciante Itinerante reduz os preços', () => {
    const plain = freshRun(74);
    const discountRun = freshRun(74);
    discountRun.relics.push('itinerant_merchant');
    spawnStageEvent(plain, 'merchant', new Rng(3), []);
    spawnStageEvent(discountRun, 'merchant', new Rng(3), []);
    const plainCosts = new Map(
      (plain.pendingEvent?.options ?? []).map((option) => [option.id, option.cost ?? 0]),
    );
    let compared = 0;
    for (const option of discountRun.pendingEvent?.options ?? []) {
      const cost = option.cost ?? 0;
      if (cost <= 0) continue;
      const base = plainCosts.get(option.id);
      expect(base).toBeGreaterThan(0);
      expect(cost).toBeLessThan(base as number);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('mercador aceita fragmentos em melhorias', () => {
    const run = freshRun(76);
    spawnStageEvent(run, 'merchant', new Rng(21), []);
    const option = run.pendingEvent?.options.find((entry) => (entry.fragmentCost ?? 0) > 0);
    expect(option).toBeTruthy();
    if (!option) return;

    run.fragments = 0;
    expect(resolveStageEvent(run, option.id).ok).toBe(false);

    run.fragments = 5;
    const resolved = resolveStageEvent(run, option.id);
    expect(resolved.ok).toBe(true);
    expect(resolved.state.fragments).toBe(5 - (option.fragmentCost ?? 0));
  });

  it('recusar um evento consome a oferta sem aplicar bônus', () => {
    const run = freshRun(75);
    spawnStageEvent(run, 'chest', new Rng(12), []);
    const before = { crystals: run.crystals, charges: { ...run.stage.charges } };
    const resolved = resolveStageEvent(run, null);
    expect(resolved.ok).toBe(true);
    expect(resolved.state.pendingEvent).toBeNull();
    expect(resolved.state.crystals).toBe(before.crystals);
    expect(resolved.state.stage.charges).toEqual(before.charges);
  });
});


describe('recompensas por desempenho', () => {
  const base = {
    lines: 0,
    combo: 0,
    comboBefore: 0,
    corruptDestroyed: 0,
    gained: 100,
    bestDropBefore: 0,
    secondaryCompleted: false,
  };

  it('objetivo secundário abre escolha de habilidade', () => {
    const run = freshRun(80);
    performanceRewards(run, { ...base, secondaryCompleted: true }, new Rng(4), []);
    expect(run.pendingEvent?.title).toBe('Objetivo Secundário');
    expect(run.pendingEvent?.options.length).toBeGreaterThan(0);
  });

  it('marco de combo concede energia e não repete recompensa na mesma jogada', () => {
    const run = freshRun(81);
    const events: GameEvent[] = [];
    performanceRewards(run, { ...base, combo: 5, comboBefore: 4, lines: 1 }, new Rng(5), events);
    expect(run.energy.earned).toBeGreaterThan(0);
    const earned = run.energy.earned;

    run.pendingEvent = { id: 'guard', kind: 'chest', title: 'Guardado', desc: '', options: [] };
    performanceRewards(run, { ...base, combo: 9, comboBefore: 4, lines: 1 }, new Rng(6), events);
    expect(run.energy.earned).toBe(earned);
  });

  it('não gera recompensa quando a run terminou', () => {
    const run = freshRun(82);
    run.status = 'stageClear';
    performanceRewards(run, { ...base, secondaryCompleted: true }, new Rng(8), []);
    expect(run.pendingEvent).toBeNull();
    expect(run.energy.earned).toBe(0);
  });
});

describe('evolução de poderes', () => {
  it('bomba nível 2 explode 4×4', () => {
    const run = freshRun(90);
    for (let r = 3; r <= 6; r += 1) {
      for (let c = 3; c <= 6; c += 1) setCell(run, r, c, 'block');
    }
    run.powerLevels.bomb = 2;
    run.stage.charges.bomb = 1;
    const result = usePower(run, 'bomb', { r: 4, c: 4 });
    expect(result.ok).toBe(true);
    const power = result.events.find((event) => event.type === 'power');
    expect(power && power.type === 'power' ? power.cells.length : 0).toBe(16);
  });

  it('bomba nível 3 adiciona pontos por célula destruída', () => {
    const run = freshRun(91);
    for (let r = 2; r <= 4; r += 1) {
      for (let c = 2; c <= 4; c += 1) setCell(run, r, c, 'block');
    }
    run.powerLevels.bomb = 3;
    run.stage.charges.bomb = 1;
    const result = usePower(run, 'bomb', { r: 3, c: 3 });
    expect(result.ok).toBe(true);
    expect(result.state.score - run.score).toBe(9 * 12);
  });

  it('martelo nível 2 remove duas células', () => {
    const run = freshRun(92);
    fillRow(run, 4, []);
    run.powerLevels.hammer = 2;
    run.stage.charges.hammer = 1;
    const result = usePower(run, 'hammer', { r: 4, c: 4 });
    const power = result.events.find((event) => event.type === 'power');
    expect(power && power.type === 'power' ? power.cells.length : 0).toBe(2);
    expect(result.state.board.cells[4][4].kind).toBe('empty');
  });

  it('broca nível 2 concede energia ao ser usada', () => {
    const run = freshRun(93);
    fillRow(run, 4, []);
    run.powerLevels.drill = 2;
    run.stage.charges.drill = 1;
    const result = usePower(run, 'drill', { r: 4, c: 0 });
    expect(result.state.energy.earned).toBeGreaterThan(run.energy.earned);
  });

  it('níveis não passam do máximo e a oferta vira carga extra', () => {
    const run = freshRun(94);
    run.powerLevels.hammer = 3;
    const before = run.stage.charges.hammer ?? 0;
    const events: GameEvent[] = [];
    const choice: RewardChoice = {
      id: 'up',
      kind: 'power_up',
      power: 'hammer',
      label: 'x',
      desc: 'x',
      rarity: 'rare',
    };
    applyRewardChoice(run, choice, new Rng(1), events);
    expect(run.powerLevels.hammer).toBe(3);
    expect(run.stage.charges.hammer).toBe(before + 1);
  });
});

describe('integração com relíquias', () => {
  it('Duplicador repete recompensas em algumas seeds', () => {
    let dupes = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const run = freshRun(100);
      run.relics.push('duplicator');
      run.stage.charges.hammer = 0;
      const choice: RewardChoice = {
        id: 'charges:hammer',
        kind: 'charges',
        power: 'hammer',
        amount: 1,
        label: 'Martelo +1',
        desc: '',
        rarity: 'common',
      };
      applyRewardChoice(run, choice, new Rng(seed), []);
      if ((run.stage.charges.hammer ?? 0) >= 2) dupes += 1;
    }
    expect(dupes).toBeGreaterThan(0);
    expect(dupes).toBeLessThan(40);
  });

  it('Fragmentador gera fragmentos ao destruir linhas numa jogada real', () => {
    const run = freshRun(101);
    run.relics.push('fragmenter');
    fillRow(run, 8, [0]);
    setTrayShape(run, 0, 'dot');
    const result = placePiece(run, 0, 8, 0);
    expect(result.state.fragments).toBeGreaterThan(0);
  });

  it('Cristal de Energia aumenta a energia prevista com linhas', () => {
    const run = freshRun(102);
    run.relics.push('energy_crystal');
    const relicGain = energyForPlacement(energyInput({ lines: 1 }), getMods(run));
    const plainGain = energyForPlacement(energyInput({ lines: 1 }), defaultMods());
    expect(relicGain).toBeGreaterThan(plainGain);
  });
});

describe('preferClear do Reorganizar nível 3', () => {
  it('conta posições que completam linha', () => {
    const board = createBoard();
    for (let c = 0; c < 9; c += 1) if (c !== 4) board.cells[8][c] = { kind: 'block', color: 0 };
    const piece = { id: 'x', shapeId: 'dot', cells: [{ r: 0, c: 0 }], color: 0 };
    expect(countCompletingPlacements(board, piece)).toBe(1);
  });
});

