import type { MetaState, RunSummary } from './types';
import { RELIC_MAP } from './relics';

export interface AchievementContext {
  meta: MetaState;
  summary: RunSummary;
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  crystals: number;
  icon: string;
  check: (ctx: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_run',
    name: 'Primeira Pedra',
    desc: 'Complete uma run (vitória ou derrota).',
    crystals: 40,
    icon: 'stone',
    check: ({ meta }) => meta.stats.runs >= 1,
  },
  {
    id: 'first_win',
    name: 'BLOCKBOUND',
    desc: 'Vença uma run derrotando o chefe final.',
    crystals: 320,
    icon: 'crown',
    check: ({ summary }) => summary.won,
  },
  {
    id: 'stage_four',
    name: 'Meio Caminho',
    desc: 'Alcance o estágio 4.',
    crystals: 80,
    icon: 'flag',
    check: ({ summary }) => summary.stage >= 4,
  },
  {
    id: 'combo_10',
    name: 'Sequência Insana',
    desc: 'Alcance um combo de 10.',
    crystals: 120,
    icon: 'flame',
    check: ({ summary, meta }) => summary.maxCombo >= 10 || meta.stats.bestCombo >= 10,
  },
  {
    id: 'combo_20',
    name: 'Ritmo Perfeito',
    desc: 'Alcance um combo de 20.',
    crystals: 260,
    icon: 'bolt',
    check: ({ summary, meta }) => summary.maxCombo >= 20 || meta.stats.bestCombo >= 20,
  },
  {
    id: 'five_lines',
    name: 'Cinco em Um',
    desc: 'Destrua 5 linhas ao mesmo tempo.',
    crystals: 300,
    icon: 'cross',
    check: ({ summary, meta }) =>
      summary.maxSimultaneous >= 5 || meta.stats.bestSimultaneous >= 5,
  },
  {
    id: 'score_10k',
    name: 'Mestre dos Blocos',
    desc: 'Faça 10.000 pontos em uma run.',
    crystals: 100,
    icon: 'star',
    check: ({ summary, meta }) => summary.score >= 10000 || meta.stats.bestScore >= 10000,
  },
  {
    id: 'score_25k',
    name: 'Lenda do Tabuleiro',
    desc: 'Faça 25.000 pontos em uma run.',
    crystals: 280,
    icon: 'titan',
    check: ({ summary, meta }) => summary.score >= 25000 || meta.stats.bestScore >= 25000,
  },
  {
    id: 'lines_100',
    name: 'Demolidor',
    desc: 'Destrua 100 linhas no total.',
    crystals: 130,
    icon: 'rows',
    check: ({ meta }) => meta.stats.totalLines >= 100,
  },
  {
    id: 'corrupt_50',
    name: 'Purificador',
    desc: 'Destrua 50 células corrompidas no total.',
    crystals: 120,
    icon: 'virus',
    check: ({ meta }) => meta.stats.corruptDestroyed >= 50,
  },
  {
    id: 'bombs_25',
    name: 'Esquadrão Antibomba',
    desc: 'Desarme 25 bombas no total.',
    crystals: 120,
    icon: 'bomb',
    check: ({ meta }) => meta.stats.bombsDefused >= 25,
  },
  {
    id: 'legendary_three',
    name: 'Colecionador Lendário',
    desc: 'Tenha 3 relíquias lendárias na mesma run.',
    crystals: 350,
    icon: 'prism',
    check: ({ summary }) =>
      summary.relics.filter((id) => RELIC_MAP[id]?.rarity === 'legendary').length >= 3,
  },
  {
    id: 'win_low_relics',
    name: 'Minimalista',
    desc: 'Vença uma run com 2 relíquias ou menos.',
    crystals: 300,
    icon: 'feather',
    check: ({ summary }) => summary.won && summary.relics.length <= 2,
  },
  {
    id: 'no_power_win',
    name: 'Mãos Limpas',
    desc: 'Vença uma run sem usar poderes.',
    crystals: 320,
    icon: 'shield',
    check: ({ summary }) => summary.won && summary.stats.powersUsed === 0,
  },
  {
    id: 'runs_10',
    name: 'Viciado em Blocos',
    desc: 'Complete 10 runs.',
    crystals: 100,
    icon: 'clock',
    check: ({ meta }) => meta.stats.runs >= 10,
  },
  {
    id: 'collect_20',
    name: 'Coleção Viva',
    desc: 'Desbloqueie 20 relíquias na coleção.',
    crystals: 220,
    icon: 'chest',
    check: ({ meta }) => meta.unlockedRelics.length >= 20,
  },
];

export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]),
);

export function evaluateAchievements(meta: MetaState, summary: RunSummary): AchievementDef[] {
  return ACHIEVEMENTS.filter(
    (achievement) => !meta.achievements.includes(achievement.id) && achievement.check({ meta, summary }),
  );
}
