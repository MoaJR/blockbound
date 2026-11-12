import { m as motion } from 'framer-motion';
import type { EnergyState } from '../engine/types';
import { Icon } from '../ui/icons';

export interface EnergyBarProps {
  energy: EnergyState;
  crystals: number;
  fragments: number;
  disabled: boolean;
  onOpenReward: () => void;
}

/**
 * Barra de energia in-run: progresso discreto, preenchimento animado e um chip
 * pulsante quando existe recompensa pronta para escolher.
 */
export function EnergyBar({ energy, crystals, fragments, disabled, onOpenReward }: EnergyBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round((energy.value / Math.max(1, energy.max)) * 100)));
  const ready = energy.pending > 0 && Boolean(energy.offer);
  const waiting = energy.pending > 0 && !energy.offer;

  return (
    <div className={`energybar ${ready ? 'is-ready' : ''}`}>
      <button
        type="button"
        className="energybar__main"
        onClick={onOpenReward}
        disabled={!ready || disabled}
        aria-label={
          ready
            ? `Recompensa de energia disponível (${energy.pending}). Abrir escolha.`
            : `Barra de energia: ${Math.round(energy.value)} de ${energy.max}`
        }
      >
        <span className="energybar__head">
          <span className="rail-label">
            <Icon name="bolt" size={13} /> Energia
          </span>
          <span className="energybar__value">
            {ready
              ? `${energy.pending} pronta${energy.pending > 1 ? 's' : ''}`
              : waiting
                ? 'preparando…'
                : `${Math.round(energy.value)}/${energy.max}`}
          </span>
        </span>
        <span className="energybar__track">
          <motion.span
            className="energybar__fill"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 26 }}
          />
          {ready && <span className="energybar__glow" aria-hidden="true" />}
        </span>
      </button>

      {ready && (
        <span className="energybar__chip" aria-hidden="true">
          <Icon name="star" size={12} /> Recompensa
        </span>
      )}

      {(crystals > 0 || fragments > 0) && (
        <div className="energybar__wallet">
          {crystals > 0 && (
            <span className="chip chip--gold" title="Cristais da run (mercadores e eventos)">
              <Icon name="crystal" size={12} /> {crystals}
            </span>
          )}
          {fragments > 0 && (
            <span className="chip chip--violet" title="Fragmentos energéticos">
              <Icon name="gem" size={12} /> {fragments}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
