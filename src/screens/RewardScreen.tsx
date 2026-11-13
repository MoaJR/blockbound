import { useState } from 'react';
import { AnimatePresence, m as motion } from 'framer-motion';
import type { GameApi } from '../hooks/useGame';
import { RELIC_MAP, RARITY_LABEL, SYNERGY_LABEL } from '../engine/relics';
import type { RelicDef } from '../engine/relics';
import { BOSS_MAP } from '../engine/bosses';
import { RelicArt } from '../ui/relicArt';
import { RelicAcquireOverlay } from '../components/RelicAcquire';
import { Icon } from '../ui/icons';
import { sfx } from '../audio/sfx';

export interface RewardScreenProps {
  api: GameApi;
}

export function RewardScreen({ api }: RewardScreenProps) {
  const run = api.run;
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acquiring, setAcquiring] = useState<RelicDef | null>(null);
  const reduced = api.meta.settings.reducedMotion;

  if (!run || run.status !== 'stageClear') return null;

  const offer = (run.rewardOffer ?? []).filter((id) => RELIC_MAP[id]);
  const stage = run.stage;
  const boss = stage.boss ? BOSS_MAP[stage.boss.id] : null;
  const picksLeft = Math.max(1, run.rewardPicksLeft);

  const pick = (id: string) => {
    if (busy) return;
    const relic = RELIC_MAP[id];
    if (!relic) return;
    setBusy(true);
    setPicked(id);
    setAcquiring(relic);
    sfx.playRelic(relic.rarity);
    const delay = reduced
      ? 160
      : relic.rarity === 'legendary'
        ? 780
        : relic.rarity === 'epic'
          ? 560
          : relic.rarity === 'rare'
            ? 420
            : 300;
    window.setTimeout(() => {
      api.pickReward(id);
      setPicked(null);
      setAcquiring(null);
      setBusy(false);
    }, delay);
  };

  return (
    <div className="reward screen">
      <span className="reward__glow" aria-hidden="true" />
      <header className="reward__head">
        <motion.span
          className="reward__eyebrow"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Icon name="check" size={14} /> Estágio {stage.number} concluído
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          {boss ? 'Chefe derrotado' : 'Escolha sua relíquia'}
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
          {boss
            ? `${boss.name} caiu. Sua recompensa está entre as relíquias abaixo.`
            : picksLeft > 1
              ? `Relicário ativo: você escolhe ${picksLeft} relíquias.`
              : 'Uma relíquia por estágio — monte a sinergia da sua run.'}
        </motion.p>
        {boss && (
          <motion.div
            className={`reward__boss-banner bossbar--${boss.accent}`}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.16, type: 'spring', stiffness: 220, damping: 22 }}
          >
            <Icon name="skull" size={16} />
            <span>{boss.name} derrotado</span>
          </motion.div>
        )}
        <div className="reward__stats">
          <span className="chip chip--gold">
            <Icon name="star" size={13} /> {run.score.toLocaleString('pt-BR')} pts
          </span>
          <span className="chip chip--cyan">
            <Icon name="flag" size={13} /> Próximo: estágio {Math.min(8, stage.number + 1)}
          </span>
          <span className="chip">
            <Icon name="crystal" size={13} /> {api.meta.crystals.toLocaleString('pt-BR')}
          </span>
        </div>
      </header>

      <div className={`reward__cards reward__cards--${offer.length}`}>
        <AnimatePresence initial={false}>
          {offer.map((id, index) => {
            const relic = RELIC_MAP[id];
            if (!relic) return null;
            const isPicked = picked === id;
            return (
              <motion.button
                type="button"
                key={id}
                className={`relic-card rarity-${relic.rarity} ${isPicked ? 'is-picked' : ''} ${
                  picked && !isPicked ? 'is-dimmed' : ''
                }`}
                initial={{ opacity: 0, y: 30, rotateX: -12, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 220, damping: 24, delay: index * 0.07 }}
                whileHover={{ y: -6, scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => pick(id)}
                disabled={busy}
                data-sfx="none"
                aria-label={`Escolher ${relic.name}, ${RARITY_LABEL[relic.rarity]}`}
              >
                <span className="relic-card__rarity">{RARITY_LABEL[relic.rarity]}</span>
                <span className="relic-card__art">
                  <RelicArt icon={relic.icon} rarity={relic.rarity} size={72} />
                </span>
                <h3 className="relic-card__name">{relic.name}</h3>
                <p className="relic-card__desc">{relic.desc}</p>
                <span className="relic-card__tags">
                  {relic.tags.map((tag) => (
                    <em key={tag}>{SYNERGY_LABEL[tag]}</em>
                  ))}
                </span>
                {relic.synergies.length > 0 && (
                  <span className="relic-card__synergy">
                    Combina com: {relic.synergies.map((tag) => SYNERGY_LABEL[tag]).join(' · ')}
                  </span>
                )}
                <span className="relic-card__cta">
                  {isPicked ? (
                    <>
                      <Icon name="check" size={16} /> Equipada
                    </>
                  ) : (
                    'Escolher'
                  )}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <footer className="reward__foot">
        <div className="reward__owned">
          <span className="rail-label">
            <Icon name="collection" size={13} /> Suas relíquias ({run.relics.length})
          </span>
          <div className="reward__owned-list">
            {run.relics.map((id) => {
              const relic = RELIC_MAP[id];
              if (!relic) return null;
              return (
                <span key={id} title={relic.name}>
                  <RelicArt icon={relic.icon} rarity={relic.rarity} size={26} />
                </span>
              );
            })}
            {run.relics.length === 0 && <span className="rail-empty">Nenhuma ainda</span>}
          </div>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={api.reroll}
          disabled={run.rerollsLeft <= 0 || busy}
        >
          <Icon name="refresh" size={15} /> Reroll ({run.rerollsLeft})
        </button>
      </footer>

      <AnimatePresence>
        {acquiring && <RelicAcquireOverlay key={acquiring.id} relic={acquiring} reduced={reduced} />}
      </AnimatePresence>
    </div>
  );
}
