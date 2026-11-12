import type { PowerId } from '../engine/types';
import { powerLevelInfo } from '../engine/powers';
import { Icon } from '../ui/icons';
import type { IconName } from '../ui/icons';

export const POWER_ICON: Record<PowerId, IconName> = {
  hammer: 'hammer',
  bomb: 'bomb',
  shuffle: 'shuffle',
  drill: 'drill',
  convert: 'convert',
  wildcard: 'wildcard',
};

export interface PowerBarProps {
  powers: { id: PowerId; charges: number; level?: number }[];
  armed: boolean;
  targeting: PowerId | null;
  recallAvailable: boolean;
  recallUsed: boolean;
  disabled: boolean;
  onUse: (id: PowerId) => void;
  onRecall: () => void;
  compact?: boolean;
}

export function PowerBar({
  powers,
  armed,
  targeting,
  recallAvailable,
  recallUsed,
  disabled,
  onUse,
  onRecall,
  compact = false,
}: PowerBarProps) {
  const visible = powers.filter((power) => power.charges > 0 || targeting === power.id);
  return (
    <div className={`powerbar ${compact ? 'powerbar--compact' : ''}`}>
      <div className="powerbar__head">
        <span className="rail-label">
          <Icon name="wand" size={14} /> Poderes
        </span>
        {armed && <span className="chip chip--green">Coringa ativo</span>}
      </div>
      <div className="powerbar__list">
        {visible.length === 0 && <p className="rail-empty">Sem cargas neste estágio.</p>}
        {visible.map((power) => {
          const isTargeting = targeting === power.id;
          const noCharges = power.charges <= 0;
          const level = power.level ?? 1;
          const levelLabel = powerLevelInfo(power.id, level);
          return (
            <button
              key={power.id}
              type="button"
              className={`power ${isTargeting ? 'is-targeting' : ''} ${noCharges ? 'is-empty' : ''} ${
                level > 1 ? 'is-evolved' : ''
              }`}
              disabled={disabled || noCharges}
              onClick={() => onUse(power.id)}
              title={`${levelLabel.name} (nível ${level}) — ${levelLabel.desc}`}
              aria-label={`${levelLabel.name}, nível ${level}, ${power.charges} cargas`}
            >
              <span className="power__icon">
                <Icon name={POWER_ICON[power.id]} size={compact ? 17 : 20} />
                {level > 1 && <span className="power__level">Nv.{level}</span>}
              </span>
              {!compact && (
                <span className="power__meta">
                  <span className="power__name">{levelLabel.name}</span>
                  <span className="power__desc">{levelLabel.desc}</span>
                </span>
              )}
              <span className="power__charges">{power.charges}</span>
            </button>
          );
        })}
        {recallAvailable && (
          <button
            type="button"
            className="power power--recall"
            disabled={disabled || recallUsed}
            onClick={onRecall}
            title="Luva Magnética — devolver a última peça colocada"
            aria-label="Devolver última peça"
          >
            <span className="power__icon">
              <Icon name="hand" size={compact ? 17 : 20} />
            </span>
            {!compact && (
              <span className="power__meta">
                <span className="power__name">Luva</span>
                <span className="power__desc">Devolver a última peça</span>
              </span>
            )}
            <span className="power__charges">{recallUsed ? 0 : 1}</span>
          </button>
        )}
      </div>
    </div>
  );
}
