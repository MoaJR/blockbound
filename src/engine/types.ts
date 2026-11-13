/**
 * BLOCKBOUND — tipos centrais do motor.
 * Este módulo (e todo o diretório engine/) não depende de React nem do DOM.
 */

export const RUN_VERSION = 2;
export const BOARD_SIZE = 9;
export const TRAY_SIZE = 3;
export const TOTAL_STAGES = 8;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type SynergyTag = 'combo' | 'lines' | 'prism' | 'power' | 'economy' | 'precision';

export type CellKind = 'empty' | 'block' | 'corrupt' | 'frozen' | 'bomb';

export interface Coord {
  r: number;
  c: number;
}

export interface Cell {
  kind: CellKind;
  color: number;
  timer?: number;
}

export interface Board {
  size: number;
  cells: Cell[][];
}

export type Special = 'prism' | 'tnt' | 'star';
export type ShapeTag = 'small' | 'big' | 'line' | 'corner' | 'block' | 'plus';

export interface PieceShape {
  id: string;
  cells: Coord[];
  weight: number;
  size: number;
  tags: ShapeTag[];
}

export interface Piece {
  id: string;
  shapeId: string;
  cells: Coord[];
  color: number;
  special?: Special;
}

export type PowerId = 'hammer' | 'bomb' | 'shuffle' | 'drill' | 'convert' | 'wildcard';
export type PowerTarget = 'none' | 'cell' | 'row';

export interface PowerDef {
  id: PowerId;
  name: string;
  desc: string;
  target: PowerTarget;
  baseCharges: number;
  unlockCost: number;
  price: number;
}

export type ObjectiveKind = 'score' | 'lines' | 'double' | 'survive' | 'corrupt' | 'combo' | 'boss';

export interface Objective {
  kind: ObjectiveKind;
  target: number;
  progress: number;
}

export type ModifierId =
  | 'precise'
  | 'no_powers'
  | 'heavy'
  | 'frozen_start'
  | 'corrupt_start'
  | 'low_moves'
  | 'prism_rain'
  | 'combo_hunger';

export interface ModifierDef {
  id: ModifierId;
  name: string;
  desc: string;
  tone: 'good' | 'bad' | 'wild';
}

export type BossId = 'ice_king' | 'corruption_king' | 'gravity_king' | 'explosive_king';

export interface BossState {
  id: BossId;
  hp: number;
  maxHp: number;
  tick: number;
  phase: number;
  name: string;
}

export interface StageState {
  index: number;
  number: number;
  objectives: Objective[];
  /** Par de jogadas da câmara. Não é limite: fica negativo na prorrogação. */
  movesLeft: number;
  movesTotal: number;
  modifier: ModifierId | null;
  charges: Record<PowerId, number>;
  isBoss: boolean;
  isFinal: boolean;
  boss: BossState | null;
}

/** Modificadores acumulados das relíquias, talentos e estágio. */
export interface RunMods {
  scoreMult: number;
  lineScoreMult: number;
  placeScoreMult: number;
  placeFlat: number;
  comboStep: number;
  comboCap: number;
  extraMoves: number;
  baseCharges: Partial<Record<PowerId, number>>;
  specialChance: number;
  prismEvery: number;
  emptyCellBonus: number;
  extraMovesOnClear: number;
  extraMovesOnClearCap: number;
  bigPieceBonus: number;
  crystalMult: number;
  rewardChoices: number;
  rerollsPerStage: number;
  noClearStreakBonus: number;
  mirrorChance: number;
  rareScoreBonus: number;
  comboKeepOnBigPlace: number;
  comboSafeAcrossStages: boolean;
  glassLens: boolean;
  canRecall: boolean;
  shapePreference: 'small' | 'heavy' | 'none';
  masterTable: boolean;
  /** Progressão in-run: energia, eventos e recompensas. */
  energyMult: number;
  energyOnLine: number;
  energyComboMult: number;
  energyMax: number;
  energyOnSpecial: number;
  powerRewardChance: number;
  eventChance: number;
  rewardDupeChance: number;
  shopDiscount: number;
  fragmentGain: number;
}

export interface ScoreBreakdown {
  place: number;
  line: number;
  lineBonus: number;
  comboMult: number;
  globalMult: number;
  bigBonus: number;
  streakBonus: number;
  mirrored: boolean;
  total: number;
}

export interface RunStats {
  placements: number;
  lines: number;
  doubles: number;
  maxCombo: number;
  powersUsed: number;
  corruptDestroyed: number;
  bombsDefused: number;
  frozenThawed: number;
  bestDrop: number;
  bosses: number;
  /** Pontos ganhos por concluir câmaras abaixo do par de jogadas. */
  efficiencyBonus: number;
}

export type RunStatus = 'playing' | 'stageClear' | 'gameOver' | 'victory';
export type GameOverReason = 'moves' | 'blocked' | 'corruption' | 'abandoned';

export type RewardChoiceKind =
  | 'charges'
  | 'new_power'
  | 'power_up'
  | 'energy'
  | 'crystals'
  | 'fragments'
  | 'relic';

/** Uma opção de recompensa apresentada durante a fase (energia ou evento). */
export interface RewardChoice {
  /** Chave estável dentro da oferta. */
  id: string;
  kind: RewardChoiceKind;
  label: string;
  desc: string;
  rarity: Rarity;
  power?: PowerId;
  /** Nível resultante (power_up) ou quantidade (cargas/energia/cristais). */
  level?: number;
  amount?: number;
  /** Custo em cristais da run (mercador). */
  cost?: number;
  /** Custo em fragmentos (opções raras de mercador). */
  fragmentCost?: number;
  /** Santuário: troca a última relíquia em vez de apenas somar. */
  swap?: boolean;
}

export interface EnergyState {
  value: number;
  max: number;
  /** Recompensas completas aguardando escolha. */
  pending: number;
  earned: number;
  claimed: number;
  offer: RewardChoice[] | null;
}

export type StageEventKind = 'fragment' | 'chest' | 'portal' | 'merchant' | 'sanctuary';

export interface StageEventOffer {
  id: string;
  kind: StageEventKind;
  title: string;
  desc: string;
  options: RewardChoice[];
}

export interface ActionResult {
  ok: boolean;
  state: RunState;
  events: GameEvent[];
  reason?: string;
}

export interface RunState {
  version: number;
  seed: number;
  rngState: number;
  board: Board;
  tray: (Piece | null)[];
  stage: StageState;
  score: number;
  stageScore: number;
  combo: number;
  maxCombo: number;
  stageMaxCombo: number;
  moveCount: number;
  movesSinceClear: number;
  noClearStreak: number;
  lines: number;
  totalLines: number;
  doubles: number;
  maxSimultaneous: number;
  linesSincePrism: number;
  lastPlacement: {
    piece: Piece;
    cells: Coord[];
    cleared: boolean;
    trayIndex: number;
    points: number;
    /** Energia concedida pela jogada (devolvida junto com a Luva Magnética). */
    energy?: number;
  } | null;
  wildcardArmed: boolean;
  rerollsLeft: number;
  rewardOffer: string[] | null;
  rewardPicksLeft: number;
  relics: string[];
  unlockedRelics: string[];
  unlockedPowers: PowerId[];
  talents: Partial<Record<TalentId, number>>;
  status: RunStatus;
  overReason: GameOverReason | null;
  stats: RunStats;
  crystals: number;
  phoenixUsed: boolean;
  /** Resgate único de emergência quando a bandeja trava sem poderes (1 por run). */
  secondChanceUsed: boolean;
  recallUsed: boolean;
  extraMovesEarned: number;
  startedAt: number;
  useCount: Record<PowerId, number>;
  /** Nível de evolução de cada poder (1 = base). Persiste durante a run. */
  powerLevels: Record<PowerId, number>;
  /** Barra de energia in-run e recompensas pendentes. */
  energy: EnergyState;
  /** Fragmentos gerados por relíquias/eventos. */
  fragments: number;
  /** Evento especial aguardando escolha (baú, portal, mercador, santuário). */
  pendingEvent: StageEventOffer | null;
  eventMoves: number;
  eventsThisStage: number;
}

/** Eventos emitidos pelo motor para a camada visual (partículas, som, popups). */
export type GameEvent =
  | { type: 'place'; cells: Coord[]; color: number; special?: Special }
  | { type: 'invalid'; reason: string }
  | { type: 'score'; amount: number; total: number; at?: Coord; breakdown?: ScoreBreakdown }
  | {
      type: 'clear';
      cells: Coord[];
      rows: number[];
      cols: number[];
      lines: number;
      combo: number;
      points: number;
      breakdown: ScoreBreakdown;
      corrupt: number;
      bombs: number;
      frozen: number;
    }
  | { type: 'combo'; level: number; multiplier: number }
  | { type: 'refill' }
  | { type: 'power'; power: PowerId; cells: Coord[] }
  | { type: 'boss'; damage: number; hp: number; text?: string; cells?: Coord[] }
  | { type: 'spawn'; cells: Coord[]; kind: CellKind }
  | { type: 'shift'; cells: Coord[] }
  | { type: 'thaw'; cells: Coord[] }
  | { type: 'stageClear'; stage: number }
  | { type: 'gameOver'; reason: GameOverReason }
  | { type: 'victory' }
  | { type: 'toast'; text: string; tone?: 'info' | 'good' | 'bad' | 'gold' }
  | { type: 'relic'; id: string }
  | { type: 'rescue'; cells: Coord[] }
  | { type: 'extraMove'; amount: number }
  | { type: 'mission'; text: string }
  | { type: 'energy'; value: number; max: number; gain: number }
  | { type: 'energyReady'; pending: number }
  | { type: 'rewardClaimed'; kind: RewardChoiceKind; label: string; power?: PowerId; level?: number }
  | { type: 'powerUp'; power: PowerId; level: number }
  | { type: 'powerGranted'; power: PowerId }
  | { type: 'stageEvent'; kind: StageEventKind; title: string }
  | { type: 'fragment'; amount: number };

export type ScreenId =
  | 'menu'
  | 'run'
  | 'reward'
  | 'result'
  | 'collection'
  | 'achievements'
  | 'stats'
  | 'talents';

export type VisualQuality = 'auto' | 'high' | 'economy';

export interface Settings {
  /** Volume geral (mestre). */
  volume: number;
  /** Volume relativo da trilha. */
  musicVolume: number;
  /** Volume relativo dos efeitos. */
  sfxVolume: number;
  muted: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  quality: VisualQuality;
}

export interface MetaStats {
  runs: number;
  wins: number;
  bestScore: number;
  bestStage: number;
  bestCombo: number;
  totalLines: number;
  bestSimultaneous: number;
  crystalsEarned: number;
  totalRelicsFound: number;
  bossesDefeated: number;
  powersUsed: number;
  corruptDestroyed: number;
  bombsDefused: number;
  playSeconds: number;
}

export type TalentId = 'power_start' | 'crystal_flow' | 'extra_reroll' | 'vital_moves';

export interface TalentDef {
  id: TalentId;
  name: string;
  desc: string;
  maxLevel: number;
  baseCost: number;
}

export interface MetaState {
  version: number;
  crystals: number;
  unlockedRelics: string[];
  unlockedPowers: PowerId[];
  talents: Partial<Record<TalentId, number>>;
  achievements: string[];
  stats: MetaStats;
  settings: Settings;
  seenIntro: boolean;
  lastRun: { score: number; stage: number; won: boolean; at: number } | null;
}

export interface MetaSnapshot {
  unlockedRelics: string[];
  unlockedPowers: PowerId[];
  talents: Partial<Record<TalentId, number>>;
}

export interface RunSummary {
  score: number;
  stage: number;
  stageReached: number;
  won: boolean;
  maxCombo: number;
  maxSimultaneous: number;
  lines: number;
  relics: string[];
  crystals: number;
  reason: GameOverReason | null;
  reasonLabel: string;
  stats: RunStats;
  durationSeconds: number;
}
