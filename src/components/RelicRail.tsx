import { AnimatePresence, m as motion } from 'framer-motion';
import type { SynergyTag } from '../engine/types';
import { relicById } from '../engine/relics';
import { RelicArt } from '../ui/relicArt';
import { Icon } from '../ui/icons';

export interface RelicRailProps {
  relics: string[];
  hint?: string;
  pulse?: { key: number; tags: SynergyTag[] } | null;
}

export function RelicRail({ relics, hint, pulse = null }: RelicRailProps) {
  return (
    <div className={`relic-rail ${relics.length === 0 ? 'is-empty' : ''}`}>
      <div className="relic-rail__head">
        <span className="rail-label">
          <Icon name="collection" size={14} /> Relíquias
        </span>
        <span className="relic-rail__count">{relics.length}</span>
      </div>
      <ul className="relic-rail__list">
        <AnimatePresence initial={false}>
          {relics.map((id) => {
            const relic = relicById(id);
            if (!relic) return null;
            const active = Boolean(pulse && relic.tags.some((tag) => pulse.tags.includes(tag)));
            return (
              <motion.li
                key={id}
                className={`relic-rail__item rarity-${relic.rarity} ${active ? 'is-pulsing' : ''}`}
                data-relic-id={id}
                data-rarity={relic.rarity}
                initial={{ opacity: 0, scale: 0.6, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                title={`${relic.name} — ${relic.desc}`}
              >
                <RelicArt icon={relic.icon} rarity={relic.rarity} size={34} />
                {active && <span key={`pulse-${pulse?.key ?? 0}`} className="relic-rail__pulse" aria-hidden="true" />}
                <span className="relic-rail__name">{relic.name}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {relics.length === 0 && <p className="rail-empty">{hint ?? 'Complete estágios para ganhar relíquias.'}</p>}
    </div>
  );
}
