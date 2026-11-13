import { m as motion } from 'framer-motion';
import type { BossState, Objective } from '../engine/types';
import { BOSS_MAP } from '../engine/bosses';
import { comboTier } from '../fx/director';
import { Icon } from '../ui/icons';
import type { IconName } from '../ui/icons';

export interface ComboBannerProps {
  level: number;
  multiplier: number;
  reduced?: boolean;
}

const COMBO_LABEL: Record<string, string> = {
  x2: 'COMBO',
  x3: 'EM CADEIA',
  x5: 'IMPULSO',
  x10: 'LENDÁRIO',
};

export function ComboBanner({ level, multiplier, reduced = false }: ComboBannerProps) {
  const tier = comboTier(level);
  return (
    <motion.div
      className="combo-banner-layer"
      initial={{ opacity: 0, scale: 0.72, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.08, y: -10 }}
      transition={{ type: 'spring', stiffness: 360, damping: 22 }}
    >
      <div className={`combo-banner combo-banner--${tier} ${reduced ? 'is-reduced' : ''}`}>
        <span className="combo-banner__burst" aria-hidden="true" />
        <span className="combo-banner__x">×{level}</span>
        <span className="combo-banner__label">{COMBO_LABEL[tier]}</span>
        <span className="combo-banner__mult">multiplicador ×{multiplier.toFixed(2)}</span>
      </div>
    </motion.div>
  );
}

export interface StageBannerProps {
  number: number;
  title: string;
  objectives: Objective[];
  modifier: string | null;
}

const OBJECTIVE_LABEL: Record<string, string> = {
  score: 'pontos',
  lines: 'linhas',
  double: 'linhas duplas',
  survive: 'jogadas',
  corrupt: 'corrupções',
  combo: 'combo',
  boss: 'dano ao chefe',
};

export function StageBanner({ number, title, objectives, modifier }: StageBannerProps) {
  const objectiveText = objectives
    .map((objective) => `${OBJECTIVE_LABEL[objective.kind] ?? objective.kind} ${objective.target}`)
    .join(' · ');
  return (
    <motion.div
      className="stage-banner-layer"
      initial={{ opacity: 0, y: -18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.99 }}
      transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <div className="stage-banner">
        <span className="stage-banner__eyebrow">ESTÁGIO {number}</span>
        <strong>{title}</strong>
        <span className="stage-banner__objectives">{objectiveText}</span>
        {modifier && <span className="stage-banner__modifier">{modifier}</span>}
      </div>
    </motion.div>
  );
}

const BOSS_ICON: Record<string, IconName> = {
  ice: 'crystal',
  corrupt: 'virus',
  gravity: 'spiral',
  boom: 'bomb',
};

export interface BossIntroProps {
  boss: BossState;
}

export function BossIntro({ boss }: BossIntroProps) {
  const def = BOSS_MAP[boss.id];
  return (
    <motion.div
      className={`boss-intro boss-intro--${def.accent}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.span
        className="boss-intro__sigil"
        initial={{ scale: 0.5, rotate: -18, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.08 }}
      >
        <Icon name={BOSS_ICON[def.accent] ?? 'skull'} size={46} />
      </motion.span>
      <motion.span
        className="boss-intro__eyebrow"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        BATALHA DE CHEFE
      </motion.span>
      <motion.strong
        className="boss-intro__name"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
      >
        {def.name}
      </motion.strong>
      <motion.span
        className="boss-intro__epithet"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.38 }}
      >
        {def.epithet}
      </motion.span>
      <span className="boss-intro__line" aria-hidden="true" />
    </motion.div>
  );
}
