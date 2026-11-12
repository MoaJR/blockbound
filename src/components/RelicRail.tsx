import { AnimatePresence, m as motion } from 'framer-motion';
import { relicById } from '../engine/relics';
import { RelicArt } from '../ui/relicArt';
import { Icon } from '../ui/icons';

export interface RelicRailProps {
  relics: string[];
  hint?: string;
}

export function RelicRail({ relics, hint }: RelicRailProps) {
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
            return (
              <motion.li
                key={id}
                className="relic-rail__item"
                initial={{ opacity: 0, scale: 0.6, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                title={`${relic.name} — ${relic.desc}`}
              >
                <RelicArt icon={relic.icon} rarity={relic.rarity} size={34} />
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
