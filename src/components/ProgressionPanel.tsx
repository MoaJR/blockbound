import { m as motion } from 'framer-motion';
import type { RewardChoice } from '../engine/types';
import { RARITY_LABEL } from '../engine/relics';
import { POWER_MAP } from '../engine/powers';
import { Modal } from './Modal';
import { POWER_ICON } from './PowerBar';
import { Icon } from '../ui/icons';
import type { IconName } from '../ui/icons';
import { sfx } from '../audio/sfx';

export interface ProgressionPanelProps {
  title: string;
  subtitle: string;
  options: RewardChoice[];
  crystals: number;
  fragments: number;
  /** Permite recusar (mercador/santuário). Recompensa de energia exige escolha. */
  dismissable: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}

function choiceIcon(choice: RewardChoice): IconName {
  if (choice.power) return POWER_ICON[choice.power];
  if (choice.kind === 'energy') return 'bolt';
  if (choice.kind === 'crystals') return 'crystal';
  if (choice.kind === 'fragments') return 'gem';
  if (choice.kind === 'relic') return 'collection';
  return 'star';
}

function choiceTag(choice: RewardChoice): string {
  if (choice.kind === 'power_up') return `Nível ${choice.level ?? 2}`;
  if (choice.kind === 'new_power') return 'Novo poder';
  if (choice.kind === 'charges') return `+${choice.amount ?? 1} carga${(choice.amount ?? 1) > 1 ? 's' : ''}`;
  if (choice.kind === 'energy') return 'Energia';
  if (choice.kind === 'crystals') return 'Cristais';
  if (choice.kind === 'fragments') return 'Fragmentos';
  return 'Relíquia';
}

export function ProgressionPanel({
  title,
  subtitle,
  options,
  crystals,
  fragments,
  dismissable,
  onPick,
  onClose,
}: ProgressionPanelProps) {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={dismissable ? onClose : undefined}
      footer={
        dismissable ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            <Icon name="close" size={14} /> Agora não
          </button>
        ) : undefined
      }
    >
      <div className={`choice-grid choice-grid--${Math.min(3, Math.max(1, options.length))}`}>
        {options.map((choice, index) => {
          const cost = choice.cost ?? 0;
          const fragmentCost = choice.fragmentCost ?? 0;
          const affordable = cost <= crystals && fragmentCost <= fragments;
          return (
            <motion.button
              type="button"
              key={choice.id}
              className={`choice-card choice-card--${choice.kind} rarity-${choice.rarity} ${
                affordable ? '' : 'is-locked'
              }`}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
              onClick={() => {
                if (!affordable) return;
                if (choice.power) sfx.play('star');
                else if (choice.kind === 'crystals') sfx.play('crystal');
                else if (choice.kind === 'fragments') sfx.play('fragment');
                else if (choice.kind === 'relic') sfx.play('rewardRare');
                else if (choice.kind === 'energy' || choice.kind === 'charges') sfx.play('energyReady');
                else sfx.play('reward');
                onPick(choice.id);
              }}
              disabled={!affordable}
              data-sfx="none"
              aria-label={`${choice.label}${
                cost > 0 ? `, ${cost} cristais` : fragmentCost > 0 ? `, ${fragmentCost} fragmentos` : ''
              }`}
              title={choice.desc}
            >
              <span className="choice-card__rarity">{RARITY_LABEL[choice.rarity]}</span>
              <span className={`choice-card__icon ${choice.power ? `choice-card__icon--${choice.power}` : ''}`}>
                <Icon name={choiceIcon(choice)} size={26} />
              </span>
              <span className="choice-card__name">{choice.label}</span>
              <span className="choice-card__desc">{choice.desc}</span>
              <span className="choice-card__foot">
                <em>{choiceTag(choice)}</em>
                {choice.power && <span>{POWER_MAP[choice.power].name}</span>}
                {cost > 0 && (
                  <span className={`choice-card__cost ${affordable ? '' : 'is-short'}`}>
                    <Icon name="crystal" size={12} /> {cost}
                  </span>
                )}
                {fragmentCost > 0 && (
                  <span className={`choice-card__cost ${affordable ? '' : 'is-short'}`}>
                    <Icon name="gem" size={12} /> {fragmentCost}
                  </span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </Modal>
  );
}
