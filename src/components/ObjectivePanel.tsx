import { m as motion } from 'framer-motion';
import type { ModifierId, Objective } from '../engine/types';
import {
  objectiveIcon,
  objectiveKindLabel,
  objectiveText,
} from '../engine/objectives';
import { MODIFIER_MAP } from '../engine/stages';
import { Icon } from '../ui/icons';
import type { IconName } from '../ui/icons';

export interface ObjectivePanelProps {
  objectives: Objective[];
  modifier: ModifierId | null;
  movesLeft: number;
  movesTotal: number;
  compact?: boolean;
}

export function ObjectivePanel({
  objectives,
  modifier,
  movesLeft,
  movesTotal,
  compact = false,
}: ObjectivePanelProps) {
  const modifierDef = modifier ? MODIFIER_MAP[modifier] : null;
  const overtime = movesLeft < 0;
  const nearPar = movesLeft >= 0 && movesLeft <= 4;
  const parTone = overtime ? 'chip--red' : nearPar ? 'chip--gold' : 'chip--cyan';
  return (
    <div className={`objectives ${compact ? 'objectives--compact' : ''}`}>
      {objectives.map((objective, index) => {
        const pct = Math.min(100, Math.round((objective.progress / objective.target) * 100));
        const done = objective.progress >= objective.target;
        return (
          <div
            key={`${objective.kind}-${index}`}
            className={`objective ${done ? 'is-done' : ''} objective--${objective.kind}`}
          >
            <span className="objective__icon">
              <Icon name={objectiveIcon(objective.kind) as IconName} size={16} />
            </span>
            <div className="objective__body">
              <div className="objective__head">
                <span className="objective__kind">{objectiveKindLabel(objective.kind)}</span>
                <span className="objective__count">
                  {Math.min(objective.progress, objective.target)}/{objective.target}
                </span>
              </div>
              <p className="objective__text">{objectiveText(objective)}</p>
              <div className="objective__track">
                <motion.span
                  className="objective__fill"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                />
              </div>
            </div>
            {done && <Icon name="check" size={18} className="objective__check" />}
          </div>
        );
      })}

      <div className="objective__footer">
        <span
          className={`chip ${parTone} ${overtime ? 'is-overtime' : ''}`}
          title={
            overtime
              ? `Prorrogação: ${-movesLeft} jogada(s) além do par (de ${movesTotal}). A cada 2, uma célula corrompe.`
              : `Par da câmara: ${movesLeft} de ${movesTotal} jogada(s). Termine dentro do par para ganhar bônus de eficiência.`
          }
        >
          <Icon name={overtime ? 'flame' : 'hourglass'} size={14} />
          {overtime ? `Prorrogação · ${-movesLeft}` : `Par · ${movesLeft}`}
        </span>
        {modifierDef && (
          <span
            className={`chip ${
              modifierDef.tone === 'bad' ? 'chip--red' : modifierDef.tone === 'good' ? 'chip--green' : 'chip--violet'
            }`}
            title={modifierDef.desc}
          >
            <Icon name="wand" size={13} />
            {modifierDef.name}
          </span>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {objectives.map((objective) => objectiveText(objective)).join('. ')}.{' '}
        {overtime
          ? `Prorrogação: ${-movesLeft} jogadas além do par de ${movesTotal}.`
          : `${movesLeft} de ${movesTotal} jogadas de par restantes.`}
      </span>
    </div>
  );
}
