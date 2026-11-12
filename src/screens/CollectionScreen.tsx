import { useMemo, useState } from 'react';
import { m as motion } from 'framer-motion';
import type { GameApi } from '../hooks/useGame';
import type { Rarity } from '../engine/types';
import {
  RARITY_COST,
  RARITY_LABEL,
  RARITY_ORDER,
  RELICS,
  SYNERGY_LABEL,
} from '../engine/relics';
import { POWERS } from '../engine/powers';
import { TALENTS, talentCost, talentLevel } from '../engine/meta';
import { RelicArt } from '../ui/relicArt';
import { Icon } from '../ui/icons';
import type { IconName } from '../ui/icons';

type Tab = 'relics' | 'powers' | 'talents';

export interface CollectionScreenProps {
  api: GameApi;
}

const POWER_ICON = {
  hammer: 'hammer',
  bomb: 'bomb',
  shuffle: 'shuffle',
  drill: 'drill',
  convert: 'convert',
  wildcard: 'wildcard',
} as const;

const TALENT_ICON: Record<string, IconName> = {
  power_start: 'hammer',
  crystal_flow: 'crystal',
  extra_reroll: 'refresh',
  vital_moves: 'hourglass',
};

export function CollectionScreen({ api }: CollectionScreenProps) {
  const [tab, setTab] = useState<Tab>('relics');
  const [filter, setFilter] = useState<Rarity | 'all'>('all');
  const { meta } = api;

  const relics = useMemo(() => {
    const list = RELICS.slice().sort(
      (a, b) =>
        RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) ||
        a.name.localeCompare(b.name),
    );
    return filter === 'all' ? list : list.filter((relic) => relic.rarity === filter);
  }, [filter]);

  return (
    <div className="collection subscreen screen">
      <header className="subscreen__head">
        <button type="button" className="icon-btn" aria-label="Voltar" onClick={api.goMenu}>
          <Icon name="back" size={20} />
        </button>
        <div className="subscreen__title">
          <h1>Coleção</h1>
          <p>Desbloqueie relíquias, poderes e talentos permanentes.</p>
        </div>
        <span className="crystal-pill">
          <Icon name="crystal" size={16} /> {meta.crystals.toLocaleString('pt-BR')}
        </span>
      </header>

      <nav className="tabs" role="tablist" aria-label="Categorias da coleção">
        {(
          [
            ['relics', 'Relíquias', `${meta.unlockedRelics.length}/${RELICS.length}`],
            ['powers', 'Poderes', `${meta.unlockedPowers.length}/${POWERS.length}`],
            [
              'talents',
              'Talentos',
              `${Object.values(meta.talents).reduce((sum, value) => sum + (value ?? 0), 0)}`,
            ],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`tab ${tab === id ? 'is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
            <em>{count}</em>
          </button>
        ))}
      </nav>

      {tab === 'relics' && (
        <>
          <div className="filters">
            <button
              type="button"
              className={`filter ${filter === 'all' ? 'is-active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Todas
            </button>
            {RARITY_ORDER.map((rarity) => (
              <button
                key={rarity}
                type="button"
                className={`filter filter--${rarity} ${filter === rarity ? 'is-active' : ''}`}
                onClick={() => setFilter(rarity)}
              >
                {RARITY_LABEL[rarity]}
              </button>
            ))}
          </div>

          <div className="collection__grid">
            {relics.map((relic, index) => {
              const owned = meta.unlockedRelics.includes(relic.id);
              const cost = RARITY_COST[relic.rarity];
              return (
                <motion.article
                  key={relic.id}
                  className={`collection-card rarity-${relic.rarity} ${owned ? 'is-owned' : 'is-locked'}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(0.3, index * 0.012) }}
                >
                  <RelicArt icon={relic.icon} rarity={relic.rarity} size={48} locked={!owned} />
                  <div className="collection-card__body">
                    <div className="collection-card__top">
                      <h3>{relic.name}</h3>
                      <span className="collection-card__rarity">{RARITY_LABEL[relic.rarity]}</span>
                    </div>
                    <p>{relic.desc}</p>
                    <div className="collection-card__tags">
                      {relic.tags.map((tag) => (
                        <em key={tag}>{SYNERGY_LABEL[tag]}</em>
                      ))}
                    </div>
                  </div>
                  <div className="collection-card__action">
                    {owned ? (
                      <span className="owned-mark">
                        <Icon name="check" size={15} /> Ativa
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--sm btn--gold"
                        disabled={meta.crystals < cost}
                        onClick={() => api.purchaseRelic(relic.id)}
                      >
                        <Icon name="crystal" size={14} /> {cost}
                      </button>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </>
      )}

      {tab === 'powers' && (
        <div className="collection__list">
          {POWERS.map((power) => {
            const owned = meta.unlockedPowers.includes(power.id);
            return (
              <article key={power.id} className={`power-card ${owned ? 'is-owned' : ''}`}>
                <span className="power-card__icon">
                  <Icon name={POWER_ICON[power.id]} size={26} />
                </span>
                <div className="power-card__body">
                  <h3>
                    {power.name}
                    {owned && (
                      <span className="owned-mark">
                        <Icon name="check" size={13} /> Ativo
                      </span>
                    )}
                  </h3>
                  <p>{power.desc}</p>
                  <span className="power-card__meta">
                    {power.baseCharges > 0
                      ? `${power.baseCharges} carga por estágio`
                      : 'Cargas extras via relíquias'}
                  </span>
                </div>
                {!owned && (
                  <button
                    type="button"
                    className="btn btn--sm btn--gold"
                    disabled={meta.crystals < power.unlockCost}
                    onClick={() => api.purchasePower(power.id)}
                  >
                    <Icon name="crystal" size={14} /> {power.unlockCost}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {tab === 'talents' && (
        <div className="collection__list">
          {TALENTS.map((talent) => {
            const level = talentLevel(meta, talent.id);
            const maxed = level >= talent.maxLevel;
            const cost = talentCost(talent, level);
            return (
              <article key={talent.id} className="talent-card">
                <span className="talent-card__icon">
                  <Icon name={TALENT_ICON[talent.id] ?? 'armor'} size={24} />
                </span>
                <div className="talent-card__body">
                  <h3>{talent.name}</h3>
                  <p>{talent.desc}</p>
                  <span className="talent-card__pips" aria-label={`Nível ${level} de ${talent.maxLevel}`}>
                    {Array.from({ length: talent.maxLevel }).map((_, index) => (
                      <i key={index} className={index < level ? 'is-filled' : ''} />
                    ))}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--sm btn--gold"
                  disabled={maxed || meta.crystals < cost}
                  onClick={() => api.purchaseTalent(talent.id)}
                >
                  {maxed ? (
                    'Máximo'
                  ) : (
                    <>
                      <Icon name="crystal" size={14} /> {cost}
                    </>
                  )}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
