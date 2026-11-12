import { describe, expect, it } from 'vitest';
import {
  chooseReward,
  createRun,
  getMods,
  isStuck,
  placePiece,
  previewPlacement,
  recallLastPiece,
  rerollRewards,
  runSummary,
  usePower,
} from './run';
import {
  ALL_META,
  cellKind,
  fillBoard,
  fillColumn,
  fillRow,
  freshRun,
  setCell,
  setTrayShape,
} from './testing';
import { buildStage } from './stages';
import { defaultMods } from './scoring';
import { Rng } from './rng';
import { createBoss } from './bosses';
import { createObjective } from './objectives';
import { countFilled, createBoard, placementsFor } from './board';
import { generateTray } from './pieces';
import type { Piece, RunState } from './types';

function firstSpot(run: RunState, index: number): { r: number; c: number } {
  const piece = run.tray[index];
  if (!piece) throw new Error('sem peça');
  const spots = placementsFor(run.board, piece);
  if (spots.length === 0) throw new Error('peça sem encaixe');
  return spots[0] as { r: number; c: number };
}

describe('criação de run', () => {
  it('inicia com tabuleiro vazio, três peças e objetivo', () => {
    const run = freshRun(1);
    expect(run.status).toBe('playing');
    expect(run.stage.number).toBe(1);
    expect(run.tray.filter(Boolean).length).toBe(3);
    expect(run.stage.movesLeft).toBeGreaterThan(10);
    expect(run.stage.objectives.length).toBeGreaterThan(0);
    expect(countFilled(run.board)).toBeLessThanOrEqual(4);
    expect(run.score).toBe(0);
  });

  it('respeita os poderes desbloqueados', () => {
    const run = createRun({ ...ALL_META, unlockedPowers: ['hammer', 'shuffle', 'wildcard'] }, 5, 0).state;
    expect(run.stage.charges.hammer).toBe(1);
    expect(run.stage.charges.shuffle).toBe(1);
    expect(run.stage.charges.bomb).toBe(0);
  });
});

describe('posicionamento', () => {
  it('posiciona peça válida e pontua', () => {
    const run = freshRun(2);
    const spot = firstSpot(run, 0);
    const result = placePiece(run, 0, spot.r, spot.c);
    expect(result.ok).toBe(true);
    expect(result.state.tray[0]).toBeNull();
    expect(result.state.score).toBeGreaterThan(0);
    expect(result.state.stage.movesLeft).toBe(run.stage.movesLeft - 1);
    expect(result.state.stats.placements).toBe(1);
    // estado anterior permanece intacto
    expect(run.tray[0]).not.toBeNull();
    expect(run.score).toBe(0);
  });

  it('rejeita posições inválidas e peças usadas', () => {
    const run = freshRun(3);
    const out = placePiece(run, 0, 20, 20);
    expect(out.ok).toBe(false);
    expect(out.reason).toBeTruthy();
    const used: RunState = { ...run, tray: [null, null, null] };
    expect(placePiece(used, 0, 0, 0).ok).toBe(false);
  });

  it('reabastece a bandeja após usar as três peças', () => {
    let run = freshRun(4);
    for (let i = 0; i < 3; i += 1) {
      const spot = firstSpot(run, i);
      const result = placePiece(run, i, spot.r, spot.c);
      expect(result.ok).toBe(true);
      run = result.state;
    }
    expect(run.tray.every((piece) => piece !== null)).toBe(true);
    expect(run.stats.placements).toBe(3);
  });
});

describe('linhas, pontuação e objetivos', () => {
  it('destrói linha completa e conclui objetivo', () => {
    const run = freshRun(5);
    run.stage.objectives = [createObjective('lines', 1)];
    fillRow(run, 8, [0]);
    setTrayShape(run, 0, 'dot');
    const result = placePiece(run, 0, 8, 0);
    expect(result.ok).toBe(true);
    expect(result.state.lines).toBe(1);
    expect(result.state.status).toBe('stageClear');
    expect(result.state.rewardOffer?.length).toBeGreaterThan(0);
    const clear = result.events.find((event) => event.type === 'clear');
    expect(clear).toBeTruthy();
    if (clear && clear.type === 'clear') {
      expect(clear.lines).toBe(1);
      expect(clear.points).toBeGreaterThan(100);
    }
  });

  it('destrói linha e coluna simultaneamente contando combo', () => {
    const run = freshRun(6);
    run.stage.objectives = [createObjective('double', 1)];
    fillRow(run, 8, [0]);
    fillColumn(run, 0, [8]);
    setTrayShape(run, 0, 'dot');
    const result = placePiece(run, 0, 8, 0);
    expect(result.ok).toBe(true);
    expect(result.state.doubles).toBe(1);
    expect(result.state.maxSimultaneous).toBe(2);
    expect(result.state.status).toBe('stageClear');
  });

  it('conclui objetivo de pontuação', () => {
    const run = freshRun(7);
    run.stage.objectives = [createObjective('score', 5)];
    const spot = firstSpot(run, 1);
    const result = placePiece(run, 1, spot.r, spot.c);
    expect(result.state.status).toBe('stageClear');
    expect(result.state.stageScore).toBeGreaterThanOrEqual(5);
  });

  it('perde quando as jogadas acabam', () => {
    const run = freshRun(8);
    run.stage.objectives = [createObjective('survive', 500)];
    run.stage.movesLeft = 1;
    const spot = firstSpot(run, 0);
    const result = placePiece(run, 0, spot.r, spot.c);
    expect(result.state.status).toBe('gameOver');
    expect(result.state.overReason).toBe('moves');
  });

  it('perde quando o tabuleiro trava sem resgate', () => {
    const run = freshRun(9);
    fillBoard(run);
    setTrayShape(run, 0, 'duo-0');
    run.stage.charges = { hammer: 1, bomb: 0, drill: 0, convert: 0, shuffle: 0, wildcard: 0 };
    // ainda há um martelo de resgate, então não é considerado travado
    expect(isStuck(run)).toBe(false);
    // o martelo abre apenas um buraco: a dupla não encaixa e não há mais resgate
    const result = usePower(run, 'hammer', { r: 4, c: 4 });
    expect(result.ok).toBe(true);
    expect(result.state.status).toBe('gameOver');
    expect(result.state.overReason).toBe('blocked');
  });

  it('prévia informa as linhas que serão completadas', () => {
    const run = freshRun(10);
    fillRow(run, 4, [2]);
    setTrayShape(run, 0, 'dot');
    const preview = previewPlacement(run, 0, 4, 2);
    expect(preview.valid).toBe(true);
    expect(preview.lines).toBe(1);
    expect(preview.cells.length).toBe(1);
  });
});

describe('poderes', () => {
  it('martelo destrói célula e consome carga', () => {
    const run = freshRun(11);
    fillRow(run, 5, []);
    const result = usePower(run, 'hammer', { r: 5, c: 3 });
    expect(result.ok).toBe(true);
    expect(result.state.stage.charges.hammer).toBe(0);
    expect(cellKind(result.state, 5, 3)).toBe('empty');
    expect(run.stage.charges.hammer).toBe(1);
  });

  it('não permite usar poder sem cargas', () => {
    const run = freshRun(12);
    run.stage.charges.bomb = 0;
    const result = usePower(run, 'bomb', { r: 3, c: 3 });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Sem cargas');
  });

  it('poderes desbloqueados começam o estágio com uma carga', () => {
    const run = freshRun(12);
    expect(run.stage.charges.bomb).toBe(1);
    expect(run.stage.charges.drill).toBe(1);
    expect(run.stage.charges.hammer).toBe(1);
  });

  it('reorganizar troca a bandeja', () => {
    const run = freshRun(13);
    const result = usePower(run, 'shuffle');
    expect(result.ok).toBe(true);
    expect(result.state.stage.charges.shuffle).toBe(0);
    expect(result.state.tray.filter(Boolean).length).toBe(3);
  });

  it('coringa permite encaixar sobre gelo', () => {
    const run = freshRun(14);
    setCell(run, 0, 0, 'frozen');
    setTrayShape(run, 0, 'dot');
    expect(placePiece(run, 0, 0, 0).ok).toBe(false);
    const armed = usePower(run, 'wildcard');
    expect(armed.ok).toBe(true);
    const placed = placePiece(armed.state, 0, 0, 0);
    expect(placed.ok).toBe(true);
    expect(placed.state.wildcardArmed).toBe(false);
  });

  it('bomba destrói área 3x3 quando há carga', () => {
    const run = freshRun(15);
    run.stage.charges.bomb = 1;
    fillRow(run, 4, []);
    const result = usePower(run, 'bomb', { r: 4, c: 4 });
    expect(result.ok).toBe(true);
    expect(result.state.stage.charges.bomb).toBe(0);
    expect(cellKind(result.state, 3, 4)).toBe('empty');
    expect(cellKind(result.state, 4, 4)).toBe('empty');
    expect(cellKind(result.state, 5, 5)).toBe('empty');
  });
});

describe('relíquias', () => {
  it('soma modificadores de múltiplas relíquias (sinergia)', () => {
    const run = freshRun(16);
    run.relics.push('combo_master', 'golden_crown', 'gravity_gem');
    const mods = getMods(run);
    expect(mods.comboStep).toBeCloseTo(0.4);
    expect(mods.comboCap).toBe(3);
    expect(mods.lineScoreMult).toBeCloseTo(0.2);
    expect(mods.bigPieceBonus).toBeCloseTo(0.5);
  });

  it('Cristal Explosivo destrói célula extra ao limpar duas linhas', () => {
    const run = freshRun(17);
    run.relics.push('explosive_crystal');
    fillRow(run, 8, [0]);
    fillColumn(run, 0, [8]);
    for (let c = 2; c < 9; c += 1) setCell(run, 7, c, 'block');
    setTrayShape(run, 0, 'dot');
    const result = placePiece(run, 0, 8, 0);
    expect(result.ok).toBe(true);
    const extra = result.events.find((event) => event.type === 'power');
    expect(extra).toBeTruthy();
  });

  it('Coroa do Vazio consome blocos acima da linha limpa', () => {
    const run = freshRun(18);
    run.relics.push('void_crown');
    fillRow(run, 8, [4]);
    for (let c = 0; c < 5; c += 1) setCell(run, 7, c, 'block');
    setTrayShape(run, 0, 'dot');
    const result = placePiece(run, 0, 8, 4);
    const removedAbove = [0, 1, 2, 3, 4].filter((c) => cellKind(result.state, 7, c) === 'empty');
    expect(removedAbove.length).toBe(3);
  });

  it('Luva Magnética devolve a última peça uma vez por estágio', () => {
    const run = freshRun(19);
    run.relics.push('magnetic_glove');
    setTrayShape(run, 0, 'dot');
    const spot = firstSpot(run, 0);
    const placed = placePiece(run, 0, spot.r, spot.c);
    const recalled = recallLastPiece(placed.state);
    expect(recalled.ok).toBe(true);
    expect(recalled.state.tray[0]).not.toBeNull();
    expect(cellKind(recalled.state, spot.r, spot.c)).toBe('empty');
    expect(recalled.state.score).toBe(placed.state.score - (placed.state.lastPlacement?.points ?? 0));
    expect(recallLastPiece(recalled.state).ok).toBe(false);
  });

  it('Luva não devolve peça após a bandeja ser reabastecida', () => {
    const run = freshRun(26);
    run.relics.push('magnetic_glove');
    setTrayShape(run, 0, 'dot');
    setTrayShape(run, 1, 'dot');
    setTrayShape(run, 2, 'dot');
    let result = placePiece(run, 0, 0, 0);
    result = placePiece(result.state, 1, 8, 8);
    result = placePiece(result.state, 2, 0, 8);
    expect(result.state.tray.every((piece) => piece !== null)).toBe(true);
    const recalled = recallLastPiece(result.state);
    expect(recalled.ok).toBe(false);
    expect(recalled.reason).toContain('reabastecida');
  });
});

describe('estágios, chefes e recompensas', () => {
  it('escolher recompensa aplica relíquia e avança o estágio', () => {
    let run = freshRun(20);
    run.stage.objectives = [createObjective('score', 1)];
    setTrayShape(run, 0, 'dot');
    let result = placePiece(run, 0, 0, 0);
    run = result.state;
    expect(run.status).toBe('stageClear');
    const offer = run.rewardOffer ?? [];
    expect(offer.length).toBeGreaterThanOrEqual(3);
    result = chooseReward(run, offer[0] as string);
    expect(result.ok).toBe(true);
    expect(result.state.relics).toContain(offer[0]);
    expect(result.state.stage.number).toBe(2);
    expect(result.state.status).toBe('playing');
    expect(result.state.tray.filter(Boolean).length).toBe(3);
    expect(result.state.stageScore).toBe(0);
    expect(result.state.score).toBeGreaterThan(0);
  });

  it('rejeita recompensa fora da oferta', () => {
    const run = freshRun(21);
    run.stage.objectives = [createObjective('score', 1)];
    setTrayShape(run, 0, 'dot');
    const result = placePiece(run, 0, 0, 0);
    expect(chooseReward(result.state, 'reliquia_inexistente').ok).toBe(false);
  });

  it('reroll consome apenas quando há rerolls', () => {
    const run = freshRun(22);
    run.stage.objectives = [createObjective('score', 1)];
    setTrayShape(run, 0, 'dot');
    const result = placePiece(run, 0, 0, 0);
    expect(rerollRewards(result.state).ok).toBe(false);
  });

  it('gera chefe no estágio 4 com objetivo de vida', () => {
    const build = buildStage({
      index: 3,
      rng: new Rng(31),
      mods: defaultMods(),
      unlockedPowers: ['hammer', 'shuffle', 'wildcard'],
      previousBoss: null,
      avoidModifier: null,
    });
    expect(build.stage.isBoss).toBe(true);
    expect(build.stage.boss).not.toBeNull();
    expect(build.stage.objectives[0]?.kind).toBe('boss');
    expect(build.stage.objectives[0]?.target).toBe(build.stage.boss?.maxHp);
  });

  it('corrompidas destruídas ferem o Rei da Corrupção', () => {
    const run = freshRun(23);
    const boss = createBoss('corruption_king', 4, false);
    boss.hp = 2;
    run.stage.boss = boss;
    run.stage.objectives = [createObjective('boss', 2)];
    fillRow(run, 8, [4]);
    setCell(run, 8, 0, 'corrupt');
    setTrayShape(run, 0, 'dot');
    const result = placePiece(run, 0, 8, 4);
    expect(result.ok).toBe(true);
    expect(result.state.stage.boss?.hp).toBe(0);
    expect(result.state.status).toBe('stageClear');
  });

  it('resumo da run calcula cristais', () => {
    const run = freshRun(24);
    run.score = 3000;
    run.totalLines = 10;
    run.maxCombo = 6;
    const summary = runSummary(run, run.startedAt + 60000);
    expect(summary.crystals).toBeGreaterThan(0);
    expect(summary.durationSeconds).toBe(60);
    expect(summary.won).toBe(false);
  });
});

describe('justiça e determinismo', () => {
  it('sempre entrega ao menos uma peça encaixável', () => {
    for (let i = 0; i < 120; i += 1) {
      const board = createBoard();
      const rng = new Rng(i + 1);
      const occupancy = rng.next() * 0.7;
      for (let r = 0; r < 9; r += 1) {
        for (let c = 0; c < 9; c += 1) {
          if (rng.chance(occupancy)) board.cells[r][c] = { kind: 'block', color: 0 };
        }
      }
      const tray = generateTray(board, rng, { specialChance: 0.06 });
      const placeable = tray.filter((piece) => placementsFor(board, piece).length > 0).length;
      expect(placeable).toBeGreaterThan(0);
    }
  });

  it('mesma seed e mesmas ações geram mesma pontuação', () => {
    const play = (seed: number) => {
      let run = freshRun(seed);
      for (let i = 0; i < 8; i += 1) {
        const index = run.tray.findIndex(
          (piece) => piece !== null && placementsFor(run.board, piece).length > 0,
        );
        if (index < 0) break;
        const piece = run.tray[index] as Piece;
        const spot = placementsFor(run.board, piece)[0];
        if (!spot) break;
        const result = placePiece(run, index, spot.r, spot.c);
        if (!result.ok) break;
        run = result.state;
        if (run.status !== 'playing') break;
      }
      return run;
    };
    const a = play(777);
    const b = play(777);
    expect(a.score).toBe(b.score);
    expect(a.board.cells).toEqual(b.board.cells);
    expect(a.tray.map((piece) => piece?.shapeId)).toEqual(b.tray.map((piece) => piece?.shapeId));
  });

  it('tabuleiro cheio encerra a run', () => {
    const run = freshRun(25);
    fillBoard(run);
    setTrayShape(run, 0, 'dot');
    run.stage.charges = { hammer: 0, bomb: 0, drill: 0, convert: 0, shuffle: 0, wildcard: 0 };
    expect(isStuck(run)).toBe(true);
  });
});
