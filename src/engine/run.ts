import { RUN_VERSION, TOTAL_STAGES } from './types';
import type {
  ActionResult,
  Board,
  Coord,
  GameEvent,
  GameOverReason,
  MetaSnapshot,
  Piece,
  PowerId,
  RunState,
  RunStats,
  RunSummary,
} from './types';
import { Rng } from './rng';
import {
  areaAround,
  applyClear,
  canPlace,
  destroyCells,
  emptyCoords,
  findFullLines,
  filledCoords,
  inBounds,
  isFilled,
  pieceCells,
  placementsFor,
  rowCells,
  spawnCorruption,
  writePiece,
} from './board';
import { generateTray, trayHasPlacement } from './pieces';
import { computeScore } from './scoring';
import { deriveMods, hasRelic, rarePlusCount, rollRewardOptions } from './relics';
import { buildStage, stageTitle } from './stages';
import { BOSS_MAP } from './bosses';
import { allDone, bumpObjectives, setObjectiveProgress } from './objectives';
import { POWER_MAP, POWER_ORDER, defaultPowerLevels } from './powers';
import { getMods } from './mods';
import {
  addEnergy,
  addFragments,
  energyForPlacement,
  initialEnergy,
  maybeSpawnStageEvent,
  performanceRewards,
  syncEnergyMax,
} from './progression';

export { getMods } from './mods';
export { previewPlacement, previewAtProjection } from './preview';
export type { PreviewInfo } from './preview';
export { claimEnergyReward, resolveStageEvent, energyForPlacement } from './progression';
export type { ActionResult } from './types';

/** Pontos por jogada de par não usada ao concluir a câmara. */
export const EFFICIENCY_POINTS = 20;
/** A cada N jogadas de prorrogação, 1 célula corrompe. */
export const OVERTIME_PRESSURE_EVERY = 2;

function fail(state: RunState, reason: string): ActionResult {
  return { ok: false, state, events: [{ type: 'invalid', reason }], reason };
}

function cloneRun(state: RunState): RunState {
  return structuredClone(state);
}

export function newStats(): RunStats {
  return {
    placements: 0,
    lines: 0,
    doubles: 0,
    maxCombo: 0,
    powersUsed: 0,
    corruptDestroyed: 0,
    bombsDefused: 0,
    frozenThawed: 0,
    bestDrop: 0,
    bosses: 0,
    efficiencyBonus: 0,
  };
}

function refillTray(
  state: RunState,
  rng: Rng,
  events: GameEvent[],
  options: { preferClear?: boolean } = {},
): void {
  const mods = getMods(state);
  const forcePrism = mods.prismEvery > 0 && state.linesSincePrism >= mods.prismEvery;
  if (forcePrism) state.linesSincePrism = 0;
  state.tray = generateTray(state.board, rng, {
    specialChance: mods.specialChance,
    forcePrism,
    preference: mods.shapePreference,
    allowSpecials: state.stage.modifier !== 'precise',
    preferClear: options.preferClear,
  });
  events.push({ type: 'refill' });
}

export interface CreateRunResult {
  state: RunState;
  events: GameEvent[];
}

export function createRun(meta: MetaSnapshot, seed: number, startedAt = Date.now()): CreateRunResult {
  const rng = new Rng(seed);
  const baseMods = deriveMods([], meta.talents, null);
  const build = buildStage({
    index: 0,
    rng,
    mods: baseMods,
    unlockedPowers: meta.unlockedPowers,
    previousBoss: null,
    avoidModifier: null,
  });

  const state: RunState = {
    version: RUN_VERSION,
    seed,
    rngState: rng.state,
    board: build.board,
    tray: [null, null, null],
    stage: build.stage,
    score: 0,
    stageScore: 0,
    combo: 0,
    maxCombo: 0,
    stageMaxCombo: 0,
    moveCount: 0,
    movesSinceClear: 0,
    noClearStreak: 0,
    lines: 0,
    totalLines: 0,
    doubles: 0,
    maxSimultaneous: 0,
    linesSincePrism: 0,
    lastPlacement: null,
    wildcardArmed: false,
    rerollsLeft: 0,
    rewardOffer: null,
    rewardPicksLeft: 0,
    relics: [],
    unlockedRelics: meta.unlockedRelics,
    unlockedPowers: meta.unlockedPowers,
    talents: meta.talents,
    status: 'playing',
    overReason: null,
    stats: newStats(),
    crystals: 0,
    phoenixUsed: false,
    secondChanceUsed: false,
    recallUsed: false,
    extraMovesEarned: 0,
    startedAt,
    useCount: { hammer: 0, bomb: 0, drill: 0, convert: 0, shuffle: 0, wildcard: 0 },
    powerLevels: defaultPowerLevels(),
    energy: initialEnergy(baseMods),
    fragments: 0,
    pendingEvent: null,
    eventMoves: 0,
    eventsThisStage: 0,
  };

  const events: GameEvent[] = [...build.events];
  state.rerollsLeft = getMods(state).rerollsPerStage;
  refillTray(state, rng, events);
  state.rngState = rng.state;
  return { state, events };
}

function syncObjectives(state: RunState, hard = false): void {
  for (const objective of state.stage.objectives) {
    if (objective.kind === 'score') {
      objective.progress = hard ? state.stageScore : Math.max(objective.progress, state.stageScore);
    }
    if (objective.kind === 'combo') {
      objective.progress = Math.max(objective.progress, state.stageMaxCombo);
    }
    if (objective.kind === 'survive') {
      objective.progress = hard ? state.moveCount : Math.max(objective.progress, state.moveCount);
    }
    if (objective.kind === 'boss' && state.stage.boss) {
      objective.progress = state.stage.boss.maxHp - state.stage.boss.hp;
    }
  }
}

function neighborsOf(cells: readonly Coord[]): Coord[] {
  const seen = new Set<string>();
  const out: Coord[] = [];
  for (const { r, c } of cells) {
    const around: Coord[] = [
      { r: r - 1, c },
      { r: r + 1, c },
      { r, c: c - 1 },
      { r, c: c + 1 },
    ];
    for (const coord of around) {
      const key = `${coord.r}:${coord.c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(coord);
    }
  }
  return out;
}

function nearbyOccupied(board: Board, cells: readonly Coord[]): Coord[] {
  return neighborsOf(cells).filter(
    ({ r, c }) => inBounds(board, r, c) && isFilled(board.cells[r][c]),
  );
}

function nearbyCorrupt(board: Board, cells: readonly Coord[]): Coord[] {
  return neighborsOf(cells).filter(
    ({ r, c }) => inBounds(board, r, c) && board.cells[r][c].kind === 'corrupt',
  );
}

function fullestRow(board: Board): number {
  let best = -1;
  let bestCount = 0;
  for (let r = 0; r < board.size; r += 1) {
    let count = 0;
    for (let c = 0; c < board.size; c += 1) if (isFilled(board.cells[r][c])) count += 1;
    if (count > bestCount) {
      bestCount = count;
      best = r;
    }
  }
  return bestCount > 0 ? best : -1;
}

function damageBoss(state: RunState, amount: number, events: GameEvent[]): void {
  const boss = state.stage.boss;
  if (!boss) return;
  const dealt = Math.min(boss.hp, Math.max(0, Math.round(amount)));
  if (dealt <= 0) return;
  boss.hp -= dealt;
  boss.phase = boss.hp <= boss.maxHp * 0.5 ? 1 : 0;
  events.push({ type: 'boss', damage: dealt, hp: boss.hp });
  const objective = state.stage.objectives.find((entry) => entry.kind === 'boss');
  if (objective) objective.progress = boss.maxHp - boss.hp;
}

function completeStage(state: RunState, rng: Rng, events: GameEvent[]): void {
  const mods = getMods(state);
  const emptyBonus = mods.emptyCellBonus > 0 ? emptyCoords(state.board).length * mods.emptyCellBonus : 0;
  const bonus = 200 + state.stage.number * 60 + emptyBonus;
  state.score += bonus;
  state.stageScore += bonus;
  events.push({ type: 'score', amount: bonus, total: state.score });

  // Bônus de eficiência: terminar dentro do par compra pontos e cristais.
  // (Passar do par não encerra a run — vira prorrogação com pressão no tabuleiro.)
  const parLeft = Math.max(0, state.stage.movesLeft);
  if (parLeft > 0) {
    const efficiency = parLeft * EFFICIENCY_POINTS;
    state.score += efficiency;
    state.stageScore += efficiency;
    state.stats.efficiencyBonus += efficiency;
    const crystals = Math.floor(parLeft / 2);
    if (crystals > 0) state.crystals += crystals;
    events.push({ type: 'score', amount: efficiency, total: state.score });
    events.push({
      type: 'toast',
      text: `Bônus de eficiência +${efficiency} · ${parLeft} jogadas abaixo do par`,
      tone: 'gold',
    });
  }

  setObjectiveProgress(state.stage.objectives, 'score', state.stageScore);
  if (state.stage.isBoss) state.stats.bosses += 1;

  if (state.stage.isFinal) {
    state.status = 'victory';
    state.overReason = null;
    events.push({ type: 'victory' });
    return;
  }
  state.status = 'stageClear';
  state.rewardOffer = rollRewardOptions(
    rng,
    state.unlockedRelics,
    state.relics,
    mods.rewardChoices,
    state.stage.number,
  );
  state.rewardPicksLeft = hasRelic(state.relics, 'relicary') ? 2 : 1;
  events.push({ type: 'stageClear', stage: state.stage.number });
}

function canRescue(state: RunState): boolean {
  for (const power of POWER_ORDER) {
    if ((state.stage.charges[power] ?? 0) <= 0) continue;
    if (power === 'wildcard') {
      if (trayHasPlacement(state.board, state.tray, true)) return true;
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Prorrogação: passar do par não encerra a run, mas o tabuleiro começa a ceder
 * (1 corrupção a cada 2 jogadas extras). É a pressão que substitui o relógio.
 */
function applyOvertimePressure(state: RunState, rng: Rng, events: GameEvent[]): void {
  const overtime = -state.stage.movesLeft;
  if (overtime <= 0) return;
  if (overtime === 1) {
    events.push({
      type: 'toast',
      text: 'Prorrogação: você passou do par e o tabuleiro começa a ceder.',
      tone: 'bad',
    });
  }
  if (overtime % OVERTIME_PRESSURE_EVERY !== 0) return;
  if (emptyCoords(state.board).length <= 12) return;
  const cells = spawnCorruption(state.board, 1, rng, 12);
  if (cells.length > 0) events.push({ type: 'spawn', cells, kind: 'corrupt' });
}

function postTurn(state: RunState, rng: Rng, events: GameEvent[]): void {
  if (state.tray.every((piece) => piece === null)) refillTray(state, rng, events);
  // A pressão da prorrogação entra ANTES da checagem de encaixe: se ela travar
  // o tabuleiro, a cadeia de resgates abaixo ainda pode salvar a run.
  applyOvertimePressure(state, rng, events);

  if (!trayHasPlacement(state.board, state.tray, state.wildcardArmed)) {
    if (canRescue(state)) {
      events.push({
        type: 'toast',
        text: 'Nenhuma peça encaixa: use um poder para abrir o tabuleiro!',
        tone: 'bad',
      });
      return;
    }
    // Segunda Chance: resgate único por run, antes de qualquer relíquia.
    if (!state.secondChanceUsed) {
      state.secondChanceUsed = true;
      const filled = filledCoords(state.board);
      const count = Math.max(4, Math.floor(filled.length * 0.3));
      const removed = destroyCells(state.board, rng.shuffle(filled).slice(0, count));
      events.push({ type: 'rescue', cells: removed });
      events.push({
        type: 'toast',
        text: 'Segunda Chance: o tabuleiro respira de novo!',
        tone: 'info',
      });
      refillTray(state, rng, events);
      if (trayHasPlacement(state.board, state.tray, state.wildcardArmed)) return;
    }
    if (hasRelic(state.relics, 'phoenix_crystal') && !state.phoenixUsed) {
      state.phoenixUsed = true;
      const filled = filledCoords(state.board);
      const count = Math.max(4, Math.floor(filled.length * 0.3));
      const removed = destroyCells(state.board, rng.shuffle(filled).slice(0, count));
      events.push({ type: 'rescue', cells: removed });
      events.push({ type: 'toast', text: 'A Fênix de Cristal renasceu o tabuleiro!', tone: 'gold' });
      refillTray(state, rng, events);
      if (trayHasPlacement(state.board, state.tray, state.wildcardArmed)) return;
    }
    state.status = 'gameOver';
    state.overReason = 'blocked';
    events.push({ type: 'gameOver', reason: 'blocked' });
  }
}

export function placePiece(
  stateIn: RunState,
  trayIndex: number,
  row: number,
  col: number,
): ActionResult {
  if (stateIn.status !== 'playing') return fail(stateIn, 'A run não está em andamento.');
  const selected = stateIn.tray[trayIndex];
  if (!selected) return fail(stateIn, 'Essa peça já foi usada.');
  if (!canPlace(stateIn.board, selected, row, col, { allowHazard: stateIn.wildcardArmed })) {
    return fail(stateIn, 'Posição inválida para esta peça.');
  }

  const state = cloneRun(stateIn);
  const events: GameEvent[] = [];
  const rng = new Rng(state.rngState);
  const mods = getMods(state);
  const piece = state.tray[trayIndex] as Piece;
  state.tray[trayIndex] = null;
  const objectivesBefore = state.stage.objectives.map(
    (objective) => objective.progress >= objective.target,
  );
  const bestDropBefore = state.stats.bestDrop;

  const targetCells = pieceCells(piece, row, col);
  const overwrittenCorrupt = targetCells.filter(
    ({ r, c }) => state.board.cells[r][c].kind === 'corrupt',
  );
  const usedWildcard =
    state.wildcardArmed &&
    targetCells.some(({ r, c }) => {
      const kind = state.board.cells[r][c].kind;
      return kind === 'frozen' || kind === 'corrupt';
    });
  const cells = writePiece(state.board, piece, row, col);
  if (usedWildcard) {
    state.wildcardArmed = false;
    events.push({ type: 'toast', text: 'Coringa liberou o encaixe.', tone: 'good' });
  }

  state.stats.placements += 1;
  state.moveCount += 1;
  state.stage.movesLeft -= 1;
  events.push({ type: 'place', cells, color: piece.color, special: piece.special });

  const blocks = piece.cells.length;
  const full = findFullLines(state.board);
  const lines = full.rows.length + full.cols.length;
  const comboBefore = state.combo;
  const breakdown = computeScore({
    blocks,
    lines,
    combo: comboBefore,
    mods,
    rarePlus: rarePlusCount(state.relics),
    noClearStreak: state.noClearStreak,
    pieceMult: piece.special === 'prism' ? 3 : 1,
    rng,
  });
  const gained = breakdown.total;

  let cleared: ReturnType<typeof applyClear> | null = null;
  let corruptDestroyed = overwrittenCorrupt.length;
  let energyCorrupt = overwrittenCorrupt.length;
  let bombsDefused = 0;
  let frozenThawed = 0;

  if (lines > 0) {
    cleared = applyClear(state.board, full.rows, full.cols);
    corruptDestroyed += cleared.corrupt.length;
    energyCorrupt = corruptDestroyed;
    bombsDefused += cleared.bombs.length;
    frozenThawed += cleared.frozenNearby.length;

    events.push({
      type: 'clear',
      cells: cleared.cells,
      rows: full.rows,
      cols: full.cols,
      lines,
      combo: comboBefore,
      points: gained,
      breakdown,
      corrupt: corruptDestroyed,
      bombs: bombsDefused,
      frozen: frozenThawed,
    });
    if (cleared.frozenNearby.length > 0) events.push({ type: 'thaw', cells: cleared.frozenNearby });

    const extras: Coord[] = [];
    if (hasRelic(state.relics, 'explosive_crystal')) {
      for (let index = 0; index < lines - 1; index += 1) {
        const candidates = nearbyOccupied(state.board, cleared.cells);
        if (candidates.length === 0) break;
        extras.push(...destroyCells(state.board, [rng.pick(candidates)]));
      }
    }
    if (hasRelic(state.relics, 'fire_heart')) {
      const burned = nearbyCorrupt(state.board, cleared.cells);
      if (burned.length > 0) {
        extras.push(...destroyCells(state.board, burned));
        corruptDestroyed += burned.length;
      }
    }
    if (hasRelic(state.relics, 'void_crown')) {
      for (const rowIndex of full.rows) {
        const above = rowCells(state.board, rowIndex - 1).filter(
          ({ r, c }) => inBounds(state.board, r, c) && isFilled(state.board.cells[r][c]),
        );
        extras.push(...destroyCells(state.board, above.slice(0, 3)));
      }
    }
    if (lines >= 3 && hasRelic(state.relics, 'flood_sword')) {
      const target = fullestRow(state.board);
      if (target >= 0) extras.push(...destroyCells(state.board, rowCells(state.board, target)));
    }
    if (piece.special === 'tnt') {
      for (const cell of cells) {
        extras.push(...destroyCells(state.board, areaAround(cell.r, cell.c, 1, state.board)));
      }
    }
    if (extras.length > 0) events.push({ type: 'power', power: 'hammer', cells: extras });
  }

  // Coringa nível 2+: o encaixe especial queima corrupção adjacente.
  if (usedWildcard && (state.powerLevels.wildcard ?? 1) >= 2) {
    const burned = neighborsOf(cells).filter(
      ({ r, c }) => inBounds(state.board, r, c) && state.board.cells[r][c].kind === 'corrupt',
    );
    const destroyedCorrupt = destroyCells(state.board, burned);
    if (destroyedCorrupt.length > 0) {
      corruptDestroyed += destroyedCorrupt.length;
      events.push({ type: 'power', power: 'wildcard', cells: destroyedCorrupt });
    }
  }

  if (piece.special === 'star') {
    const options = POWER_ORDER.filter((id) => state.unlockedPowers.includes(id));
    const target = options.length > 0 ? rng.pick(options) : ('hammer' as PowerId);
    state.stage.charges[target] = (state.stage.charges[target] ?? 0) + 1;
    events.push({ type: 'toast', text: `Estrela: +1 carga de ${POWER_MAP[target].name}.`, tone: 'good' });
  }

  state.score += gained;
  state.stageScore += gained;
  events.push({ type: 'score', amount: gained, total: state.score, at: cells[0], breakdown });

  if (lines > 0) {
    state.combo = Math.min(40, comboBefore + lines);
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.stageMaxCombo = Math.max(state.stageMaxCombo, state.combo);
    state.noClearStreak = 0;
    events.push({
      type: 'combo',
      level: state.combo,
      multiplier: Math.min(1 + mods.comboStep * state.combo, mods.comboCap),
    });
  } else {
    const keepCombo = mods.comboKeepOnBigPlace > 0 && blocks >= mods.comboKeepOnBigPlace;
    if (!keepCombo) state.combo = 0;
    state.noClearStreak += 1;
  }

  state.lines += lines;
  state.totalLines += lines;
  state.linesSincePrism += lines;
  if (lines >= 2) state.doubles += 1;
  state.maxSimultaneous = Math.max(state.maxSimultaneous, lines);
  state.stats.lines += lines;
  state.stats.doubles += lines >= 2 ? 1 : 0;
  state.stats.corruptDestroyed += corruptDestroyed;
  state.stats.bombsDefused += bombsDefused;
  state.stats.frozenThawed += frozenThawed;
  state.stats.bestDrop = Math.max(state.stats.bestDrop, gained);
  state.stats.maxCombo = Math.max(state.stats.maxCombo, state.combo);

  // Progressão in-run: energia, fragmentos e oportunidades durante o estágio.
  const energyGained = energyForPlacement(
    {
      placed: 1,
      blocks,
      lines,
      extraLines: Math.max(0, lines - 1),
      combo: state.combo,
      corrupt: energyCorrupt,
      special: Boolean(piece.special),
    },
    mods,
  );
  addEnergy(state, energyGained, rng, events);
  if (lines > 0 && mods.fragmentGain > 0) {
    addFragments(state, Math.max(1, Math.round(lines * mods.fragmentGain)), events);
  }
  state.eventMoves += 1;

  bumpObjectives(state.stage.objectives, 'lines', lines);
  if (lines >= 2) bumpObjectives(state.stage.objectives, 'double', 1);
  if (corruptDestroyed > 0) bumpObjectives(state.stage.objectives, 'corrupt', corruptDestroyed);

  if (lines > 0 && mods.extraMovesOnClear > 0) {
    const room = Math.max(0, mods.extraMovesOnClearCap - state.extraMovesEarned);
    const bonus = Math.min(lines * mods.extraMovesOnClear, room);
    if (bonus > 0) {
      state.stage.movesLeft += bonus;
      state.stage.movesTotal += bonus;
      state.extraMovesEarned += bonus;
      events.push({ type: 'extraMove', amount: bonus });
    }
  }

  if (lines > 0 && hasRelic(state.relics, 'fractal_tempo')) {
    const milestones = Math.max(0, Math.floor(state.combo / 5) - Math.floor(comboBefore / 5));
    if (milestones > 0) {
      const bonusPoints = Math.floor(gained * 0.25 * milestones);
      state.score += bonusPoints;
      state.stageScore += bonusPoints;
      state.stage.movesLeft += milestones;
      state.stage.movesTotal += milestones;
      events.push({ type: 'extraMove', amount: milestones });
      events.push({ type: 'score', amount: bonusPoints, total: state.score });
    }
  }

  const boss = state.stage.boss;
  if (boss) {
    const tick = BOSS_MAP[boss.id].afterMove({
      board: state.board,
      boss,
      rng,
      stageNumber: state.stage.number,
      movesMade: state.moveCount,
      points: gained,
      clear: cleared
        ? {
            lines,
            cells: cleared.cells,
            corrupt: cleared.corrupt,
            frozen: cleared.frozenNearby,
            bombs: cleared.bombs,
          }
        : null,
    });
    if (tick.events.length > 0) events.push(...tick.events);
    if (tick.damage > 0) damageBoss(state, tick.damage, events);
  }

  state.lastPlacement = {
    piece,
    cells,
    cleared: lines > 0,
    trayIndex,
    points: gained,
    energy: energyGained,
  };

  syncObjectives(state);
  const objectivesDone = allDone(state.stage.objectives);
  const secondaryCompleted = state.stage.objectives.some(
    (objective, index) =>
      index > 0 && !objectivesBefore[index] && objective.progress >= objective.target,
  );
  if (objectivesDone) {
    completeStage(state, rng, events);
  } else {
    postTurn(state, rng, events);
    // Recompensas in-run só depois de confirmar que o estágio continua jogável.
    if (state.status === 'playing') {
      performanceRewards(
        state,
        {
          lines,
          combo: state.combo,
          comboBefore,
          corruptDestroyed,
          gained,
          bestDropBefore,
          secondaryCompleted,
        },
        rng,
        events,
      );
      maybeSpawnStageEvent(state, rng, events);
    }
  }

  state.rngState = rng.state;
  return { ok: true, state, events };
}

function consume(state: RunState, power: PowerId): void {
  state.stage.charges[power] = Math.max(0, (state.stage.charges[power] ?? 0) - 1);
  state.stats.powersUsed += 1;
  state.useCount[power] = (state.useCount[power] ?? 0) + 1;
}

function trayPlayableCount(board: Board, tray: readonly (Piece | null)[]): number {
  let count = 0;
  for (const piece of tray) {
    if (!piece) continue;
    if (placementsFor(board, piece).length > 0) count += 1;
  }
  return count;
}

/** Vizinho ocupado mais próximo (determinístico) para o Martelo nível 2+. */
function nearestOccupiedNeighbor(board: Board, origin: Coord): Coord | null {
  let best: Coord | null = null;
  let bestDistance = Infinity;
  for (let r = 0; r < board.size; r += 1) {
    for (let c = 0; c < board.size; c += 1) {
      if (r === origin.r && c === origin.c) continue;
      if (!isFilled(board.cells[r][c])) continue;
      const distance = Math.abs(r - origin.r) + Math.abs(c - origin.c);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { r, c };
      }
    }
  }
  return best;
}

export function usePower(stateIn: RunState, power: PowerId, target?: Coord): ActionResult {
  if (stateIn.status !== 'playing') return fail(stateIn, 'A run não está em andamento.');
  const def = POWER_MAP[power];
  if (!def) return fail(stateIn, 'Poder desconhecido.');
  if ((stateIn.stage.charges[power] ?? 0) <= 0) return fail(stateIn, `Sem cargas de ${def.name}.`);

  const state = cloneRun(stateIn);
  const events: GameEvent[] = [];
  const rng = new Rng(state.rngState);
  const level = state.powerLevels[power] ?? 1;

  if (power === 'shuffle') {
    consume(state, power);
    const scratch: GameEvent[] = [];
    refillTray(state, rng, scratch, { preferClear: level >= 3 });
    if (level >= 2) {
      const first = state.tray;
      refillTray(state, rng, scratch, { preferClear: level >= 3 });
      const second = state.tray;
      state.tray =
        trayPlayableCount(state.board, second) >= trayPlayableCount(state.board, first)
          ? second
          : first;
    }
    events.push({ type: 'refill' });
    events.push({ type: 'power', power, cells: [] });
    events.push({
      type: 'toast',
      text: level >= 3 ? 'Reorganizar guiado: peças melhores na bandeja.' : 'Bandeja reorganizada.',
      tone: 'good',
    });
    postTurn(state, rng, events);
    state.rngState = rng.state;
    return { ok: true, state, events };
  }

  if (power === 'wildcard') {
    if (state.wildcardArmed) return fail(stateIn, 'O Coringa já está armado.');
    consume(state, power);
    state.wildcardArmed = true;
    if (level >= 3) addEnergy(state, 12, rng, events);
    events.push({ type: 'power', power, cells: [] });
    events.push({ type: 'toast', text: 'Coringa ativo: encaixe sobre gelo ou corrupção.', tone: 'good' });
    state.rngState = rng.state;
    return { ok: true, state, events };
  }

  if (!target || !inBounds(state.board, target.r, target.c)) {
    return fail(stateIn, 'Selecione um alvo válido.');
  }

  let cells: Coord[] = [];
  if (power === 'hammer') {
    cells = [{ ...target }];
    if (level >= 2) {
      const neighbor = nearestOccupiedNeighbor(state.board, target);
      if (neighbor) cells.push(neighbor);
    }
  } else if (power === 'bomb') {
    if (level >= 2) {
      const span = 4;
      const baseR = Math.min(Math.max(0, target.r - 1), state.board.size - span);
      const baseC = Math.min(Math.max(0, target.c - 1), state.board.size - span);
      for (let dr = 0; dr < span; dr += 1) {
        for (let dc = 0; dc < span; dc += 1) cells.push({ r: baseR + dr, c: baseC + dc });
      }
    } else {
      cells = areaAround(target.r, target.c, 1, state.board);
    }
  } else if (power === 'drill') {
    cells = rowCells(state.board, target.r);
    if (level >= 3) {
      for (let r = 0; r < state.board.size; r += 1) cells.push({ r, c: target.c });
    }
  } else if (power === 'convert') {
    const span = level >= 2 ? 3 : 2;
    const offset = span > 2 ? 1 : 0;
    const baseR = Math.min(Math.max(0, target.r - offset), state.board.size - span);
    const baseC = Math.min(Math.max(0, target.c - offset), state.board.size - span);
    for (let dr = 0; dr < span; dr += 1) {
      for (let dc = 0; dc < span; dc += 1) cells.push({ r: baseR + dr, c: baseC + dc });
    }
  }

  const corruptHits = cells.filter(({ r, c }) => state.board.cells[r][c].kind === 'corrupt').length;
  const frozenHits = cells.filter(({ r, c }) => state.board.cells[r][c].kind === 'frozen').length;
  const bombHits = cells.filter(({ r, c }) => state.board.cells[r][c].kind === 'bomb').length;
  const hasTarget = cells.some(({ r, c }) => state.board.cells[r][c].kind !== 'empty');
  if (!hasTarget) return fail(stateIn, 'Não há nada para destruir aí.');

  const destroyed = destroyCells(state.board, cells);
  consume(state, power);
  events.push({ type: 'power', power, cells: destroyed });

  // Efeitos de evolução (ver POWER_LEVELS).
  if (power === 'bomb' && level >= 3 && destroyed.length > 0) {
    const bonus = destroyed.length * 12;
    state.score += bonus;
    state.stageScore += bonus;
    events.push({ type: 'score', amount: bonus, total: state.score });
  }
  if (power === 'bomb' && level >= 4 && corruptHits + frozenHits + bombHits > 0) {
    if (rng.chance(0.5)) addEnergy(state, 12, rng, events);
  }
  if (power === 'drill' && level >= 2) addEnergy(state, 8, rng, events);
  if (power === 'convert' && level >= 3 && corruptHits > 0) {
    addEnergy(state, corruptHits * 6, rng, events);
  }
  if (power === 'hammer' && level >= 3) addEnergy(state, 10, rng, events);
  if (corruptHits > 0) {
    bumpObjectives(state.stage.objectives, 'corrupt', corruptHits);
    state.stats.corruptDestroyed += corruptHits;
  }
  if (frozenHits > 0) state.stats.frozenThawed += frozenHits;
  if (bombHits > 0) state.stats.bombsDefused += bombHits;
  if (state.stage.boss) {
    let damage = 0;
    if (state.stage.boss.id === 'corruption_king') damage += corruptHits * 2;
    if (state.stage.boss.id === 'ice_king') damage += frozenHits * 2;
    if (state.stage.boss.id === 'explosive_king') damage += bombHits * 3;
    if (damage > 0) damageBoss(state, damage, events);
  }

  syncObjectives(state);
  if (allDone(state.stage.objectives)) completeStage(state, rng, events);
  else postTurn(state, rng, events);
  state.rngState = rng.state;
  return { ok: true, state, events };
}

export function recallLastPiece(stateIn: RunState): ActionResult {
  if (stateIn.status !== 'playing') return fail(stateIn, 'A run não está em andamento.');
  if (!hasRelic(stateIn.relics, 'magnetic_glove')) return fail(stateIn, 'A Luva Magnética não está equipada.');
  if (stateIn.recallUsed) return fail(stateIn, 'A Luva já foi usada neste estágio.');
  if (stateIn.energy.pending > 0) {
    return fail(stateIn, 'Resolva as recompensas de energia antes de devolver a peça.');
  }
  const last = stateIn.lastPlacement;
  if (!last || last.cleared) return fail(stateIn, 'Nada para devolver.');
  if (stateIn.tray[last.trayIndex]) {
    return fail(stateIn, 'A bandeja já foi reabastecida neste estágio.');
  }

  const state = cloneRun(stateIn);
  const events: GameEvent[] = [];
  destroyCells(state.board, last.cells);
  state.tray[last.trayIndex] = last.piece;
  state.score = Math.max(0, state.score - last.points);
  state.stageScore = Math.max(0, state.stageScore - last.points);
  if (last.energy && last.energy > 0) {
    state.energy.value = Math.max(0, state.energy.value - last.energy);
    state.energy.earned = Math.max(0, state.energy.earned - last.energy);
  }
  state.stage.movesLeft = Math.min(state.stage.movesTotal, state.stage.movesLeft + 1);
  state.moveCount = Math.max(0, state.moveCount - 1);
  state.eventMoves = Math.max(0, state.eventMoves - 1);
  state.stats.placements = Math.max(0, state.stats.placements - 1);
  state.recallUsed = true;
  state.lastPlacement = null;
  syncObjectives(state, true);
  events.push({ type: 'power', power: 'hammer', cells: last.cells });
  events.push({ type: 'toast', text: 'Peça devolvida à bandeja.', tone: 'good' });
  return { ok: true, state, events };
}

function nextStage(state: RunState, rng: Rng, events: GameEvent[]): void {
  const nextIndex = state.stage.index + 1;
  if (nextIndex >= TOTAL_STAGES) {
    state.status = 'victory';
    events.push({ type: 'victory' });
    return;
  }
  const mods = getMods(state);
  const build = buildStage({
    index: nextIndex,
    rng,
    mods,
    unlockedPowers: state.unlockedPowers,
    previousBoss: state.stage.boss?.id ?? null,
    avoidModifier: state.stage.modifier,
  });

  state.stage = build.stage;
  state.board = build.board;
  if (!mods.comboSafeAcrossStages) state.combo = 0;
  state.stageMaxCombo = state.combo;
  state.stageScore = 0;
  state.moveCount = 0;
  state.movesSinceClear = 0;
  state.extraMovesEarned = 0;
  state.recallUsed = false;
  state.wildcardArmed = false;
  state.lastPlacement = null;
  state.rerollsLeft = mods.rerollsPerStage;
  state.rewardOffer = null;
  state.rewardPicksLeft = 0;
  state.pendingEvent = null;
  state.eventMoves = 0;
  state.eventsThisStage = 0;
  state.status = 'playing';
  syncEnergyMax(state);
  events.push(...build.events);
  events.push({
    type: 'mission',
    text: `Estágio ${state.stage.number} — ${stageTitle(state.stage.index)}`,
  });
  refillTray(state, rng, events);
}

export function chooseReward(stateIn: RunState, relicId: string): ActionResult {
  if (stateIn.status !== 'stageClear') return fail(stateIn, 'Nenhuma recompensa disponível agora.');
  if (!stateIn.rewardOffer || !stateIn.rewardOffer.includes(relicId)) {
    return fail(stateIn, 'Recompensa inválida.');
  }
  const state = cloneRun(stateIn);
  const events: GameEvent[] = [];
  const rng = new Rng(state.rngState);

  state.relics.push(relicId);
  syncEnergyMax(state);
  events.push({ type: 'relic', id: relicId });
  state.rewardPicksLeft -= 1;

  if (state.rewardPicksLeft > 0) {
    const mods = getMods(state);
    const offer = rollRewardOptions(
      rng,
      state.unlockedRelics,
      state.relics,
      mods.rewardChoices,
      state.stage.number,
    );
    if (offer.length > 0) {
      state.rewardOffer = offer;
      state.rngState = rng.state;
      return { ok: true, state, events };
    }
    state.rewardPicksLeft = 0;
  }

  nextStage(state, rng, events);
  state.rngState = rng.state;
  return { ok: true, state, events };
}

export function rerollRewards(stateIn: RunState): ActionResult {
  if (stateIn.status !== 'stageClear') return fail(stateIn, 'Nenhuma recompensa disponível agora.');
  if (stateIn.rerollsLeft <= 0) return fail(stateIn, 'Sem rerolls disponíveis.');
  const state = cloneRun(stateIn);
  const rng = new Rng(state.rngState);
  state.rerollsLeft -= 1;
  const mods = getMods(state);
  state.rewardOffer = rollRewardOptions(
    rng,
    state.unlockedRelics,
    state.relics,
    mods.rewardChoices,
    state.stage.number,
  );
  state.rngState = rng.state;
  return { ok: true, state, events: [] };
}

export function abandonRun(stateIn: RunState): ActionResult {
  if (stateIn.status !== 'playing' && stateIn.status !== 'stageClear') {
    return fail(stateIn, 'Nada para abandonar.');
  }
  const state = cloneRun(stateIn);
  state.status = 'gameOver';
  state.overReason = 'abandoned';
  return { ok: true, state, events: [{ type: 'gameOver', reason: 'abandoned' }] };
}

export function computeCrystals(state: RunState): number {
  const mods = getMods(state);
  const base =
    state.score / 200 +
    state.stage.number * 30 +
    state.maxCombo * 5 +
    state.totalLines * 3 +
    state.stats.bosses * 60;
  return Math.max(1, Math.round(base * mods.crystalMult));
}

const REASON_LABEL: Record<GameOverReason, string> = {
  moves: 'Jogadas esgotadas',
  blocked: 'Tabuleiro travado',
  corruption: 'Corrupção total',
  abandoned: 'Run abandonada',
};

export function runSummary(state: RunState, now = Date.now()): RunSummary {
  const won = state.status === 'victory';
  return {
    score: state.score,
    stage: state.stage.number,
    stageReached: state.stage.number,
    won,
    maxCombo: state.maxCombo,
    maxSimultaneous: state.maxSimultaneous,
    lines: state.totalLines,
    relics: [...state.relics],
    crystals: computeCrystals(state),
    reason: state.overReason,
    reasonLabel: won ? 'Os 8 estágios foram concluídos' : REASON_LABEL[state.overReason ?? 'moves'],
    stats: { ...state.stats },
    durationSeconds: Math.max(0, Math.round((now - state.startedAt) / 1000)),
  };
}

export function isStuck(state: RunState): boolean {
  if (state.status !== 'playing') return false;
  if (trayHasPlacement(state.board, state.tray, state.wildcardArmed)) return false;
  return !canRescue(state);
}

export function usablePowers(
  state: RunState,
): { id: PowerId; charges: number; level: number }[] {
  return POWER_ORDER.filter(
    (id) => (state.stage.charges[id] ?? 0) > 0 || state.unlockedPowers.includes(id),
  ).map((id) => ({
    id,
    charges: state.stage.charges[id] ?? 0,
    level: state.powerLevels[id] ?? 1,
  }));
}
