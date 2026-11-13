import { m as motion } from 'framer-motion';
import type { BossState } from '../engine/types';
import { BOSS_MAP } from '../engine/bosses';
import { BossPresence } from './BossPresence';
import { Icon } from '../ui/icons';

export interface BossBarProps {
  boss: BossState;
  compact?: boolean;
  hitTick?: number;
}

const ACCENT_LABEL: Record<string, string> = {
  ice: 'Gelo',
  corrupt: 'Corrupção',
  gravity: 'Gravidade',
  boom: 'Explosivo',
};

export function BossBar({ boss, compact = false, hitTick = 0 }: BossBarProps) {
  const def = BOSS_MAP[boss.id];
  const pct = boss.maxHp > 0 ? Math.max(0, (boss.hp / boss.maxHp) * 100) : 0;
  return (
    <div className={`bossbar bossbar--${def.accent} ${compact ? 'bossbar--compact' : ''} ${boss.phase > 0 ? 'is-enraged' : ''}`}>
      <motion.div
        key={`hit-${hitTick}`}
        className="bossbar__portrait"
        aria-hidden="true"
        initial={{ scale: hitTick > 0 ? 1.12 : 1, x: hitTick > 0 ? -4 : 0 }}
        animate={{ scale: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 18 }}
      >
        <BossPresence accent={def.accent} phase={boss.phase} />
        <span className="bossbar__halo" />
        <Icon
          name={def.accent === 'ice' ? 'crystal' : def.accent === 'corrupt' ? 'virus' : def.accent === 'gravity' ? 'spiral' : 'bomb'}
          size={compact ? 20 : 26}
        />
      </motion.div>
      <div className="bossbar__body">
        <div className="bossbar__title">
          <strong>{def.name}</strong>
          <span className="bossbar__epithet">{def.epithet}</span>
          <span className={`bossbar__tag bossbar__tag--${def.accent}`}>{ACCENT_LABEL[def.accent]}</span>
          <span className="bossbar__hp">{boss.hp}/{boss.maxHp}</span>
        </div>
        <div className="bossbar__track" title={def.rule}>
          <motion.span
            className="bossbar__fill"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 160, damping: 24 }}
          />
          <span className="bossbar__shimmer" aria-hidden="true" />
        </div>
        {!compact && <p className="bossbar__rule">{def.rule}</p>}
      </div>
    </div>
  );
}
