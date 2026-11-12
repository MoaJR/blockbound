import { m as motion } from 'framer-motion';
import type { GameApi } from '../hooks/useGame';
import { RELIC_MAP } from '../engine/relics';
import { RelicArt } from '../ui/relicArt';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Icon } from '../ui/icons';

export interface ResultScreenProps {
  api: GameApi;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ResultScreen({ api }: ResultScreenProps) {
  const summary = api.summary;
  if (!summary) return null;
  const won = summary.won;

  return (
    <div className={`result screen ${won ? 'is-victory' : 'is-defeat'}`}>
      {won && (
        <div className="result__rays" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, index) => (
            <span key={index} style={{ transform: `rotate(${index * (360 / 14)}deg)` }} />
          ))}
        </div>
      )}

      <motion.header
        className="result__head"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <span className="result__emblem">
          <Icon name={won ? 'crown' : 'skull'} size={won ? 44 : 38} />
        </span>
        <span className="result__eyebrow">{won ? 'CHEFE FINAL DERROTADO' : 'FIM DA RUN'}</span>
        <h1>{won ? 'VITÓRIA' : 'A run acabou'}</h1>
        <p>{summary.reasonLabel}</p>
      </motion.header>

      <motion.div
        className="result__score"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 180, damping: 20 }}
      >
        <span className="result__score-label">PONTUAÇÃO FINAL</span>
        <AnimatedNumber value={summary.score} className="result__score-value" />
        <em>Estágio {summary.stage} de 8</em>
      </motion.div>

      <div className="result__grid">
        {[
          { icon: 'bolt' as const, label: 'Melhor combo', value: `${summary.maxCombo}×` },
          { icon: 'rows' as const, label: 'Linhas destruídas', value: `${summary.lines}` },
          { icon: 'cross' as const, label: 'Máx. simultâneas', value: `${summary.maxSimultaneous}` },
          { icon: 'collection' as const, label: 'Relíquias', value: `${summary.relics.length}` },
          { icon: 'wand' as const, label: 'Poderes usados', value: `${summary.stats.powersUsed}` },
          { icon: 'clock' as const, label: 'Duração', value: formatTime(summary.durationSeconds) },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            className="result__stat"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + index * 0.05 }}
          >
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </motion.div>
        ))}
      </div>

      <div className="result__relics">
        <span className="rail-label">
          <Icon name="collection" size={13} /> Relíquias da run
        </span>
        <div className="result__relics-list">
          {summary.relics.map((id) => {
            const relic = RELIC_MAP[id];
            if (!relic) return null;
            return (
              <span key={id} title={`${relic.name} — ${relic.desc}`}>
                <RelicArt icon={relic.icon} rarity={relic.rarity} size={32} />
              </span>
            );
          })}
          {summary.relics.length === 0 && <span className="rail-empty">Nenhuma relíquia coletada</span>}
        </div>
      </div>

      <motion.div
        className="result__rewards"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="result__crystals">
          <Icon name="crystal" size={26} />
          <div>
            <span>Cristais recebidos</span>
            <strong>+{summary.crystals.toLocaleString('pt-BR')}</strong>
          </div>
          <em>Total: {api.meta.crystals.toLocaleString('pt-BR')}</em>
        </div>
        {api.newAchievements.length > 0 && (
          <div className="result__achievements">
            <span className="rail-label">
              <Icon name="trophy" size={13} /> Novas conquistas
            </span>
            <ul>
              {api.newAchievements.map((achievement) => (
                <li key={achievement.id}>
                  <Icon name="trophy" size={15} />
                  <span>{achievement.name}</span>
                  <em>+{achievement.crystals}</em>
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>

      <div className="result__actions">
        <button type="button" className="btn btn--primary" onClick={api.startRun}>
          <Icon name="play" size={18} /> Jogar novamente
        </button>
        <button type="button" className="btn btn--ghost" onClick={api.goMenu}>
          <Icon name="home" size={17} /> Menu
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => api.goto('collection')}>
          <Icon name="collection" size={17} /> Coleção
        </button>
      </div>
    </div>
  );
}
