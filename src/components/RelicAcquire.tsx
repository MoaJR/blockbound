import { m as motion } from 'framer-motion';
import type { RelicDef } from '../engine/relics';
import { RARITY_LABEL } from '../engine/relics';
import { RelicArt } from '../ui/relicArt';

export interface RelicAcquireOverlayProps {
  relic: RelicDef;
  reduced?: boolean;
}

export function RelicAcquireOverlay({ relic, reduced = false }: RelicAcquireOverlayProps) {
  return (
    <motion.div
      className={`relic-acquire rarity-${relic.rarity} ${reduced ? 'is-reduced' : ''}`}
      initial={{ opacity: 0, scale: 0.86 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: reduced ? 0.12 : 0.3, ease: [0.22, 0.61, 0.36, 1] }}
      aria-hidden="true"
    >
      <span className="relic-acquire__wash" />
      <span className="relic-acquire__rays" />
      <span className="relic-acquire__ring" />
      <motion.span
        className="relic-acquire__art"
        initial={{ y: 14, scale: 0.7, rotate: -6 }}
        animate={{ y: 0, scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18, delay: reduced ? 0 : 0.08 }}
      >
        <RelicArt icon={relic.icon} rarity={relic.rarity} size={92} />
      </motion.span>
      <span className="relic-acquire__rarity">{RARITY_LABEL[relic.rarity]}</span>
      <strong className="relic-acquire__name">{relic.name}</strong>
      <span className="relic-acquire__desc">{relic.desc}</span>
    </motion.div>
  );
}
