import { m as motion } from 'framer-motion';
import type { GameApi } from '../hooks/useGame';
import { ACHIEVEMENTS } from '../engine/achievements';
import { Icon } from '../ui/icons';
import type { IconName } from '../ui/icons';

export interface AchievementsScreenProps {
  api: GameApi;
}

const ICON_MAP: Record<string, IconName> = {
  stone: 'stone',
  crown: 'crown',
  flag: 'flag',
  flame: 'flame',
  bolt: 'bolt',
  cross: 'cross',
  star: 'star',
  titan: 'titan',
  rows: 'rows',
  virus: 'virus',
  bomb: 'bomb',
  prism: 'prism',
  feather: 'feather',
  shield: 'shield',
  clock: 'clock',
  chest: 'chest',
};

export function AchievementsScreen({ api }: AchievementsScreenProps) {
  const unlocked = api.meta.achievements;
  const totalCrystals = ACHIEVEMENTS.filter((a) => unlocked.includes(a.id)).reduce(
    (sum, a) => sum + a.crystals,
    0,
  );

  return (
    <div className="subscreen achievements screen">
      <header className="subscreen__head">
        <button type="button" className="icon-btn" aria-label="Voltar" onClick={api.goMenu}>
          <Icon name="back" size={20} />
        </button>
        <div className="subscreen__title">
          <h1>Conquistas</h1>
          <p>
            {unlocked.length} de {ACHIEVEMENTS.length} · {totalCrystals} cristais resgatados
          </p>
        </div>
        <span className="crystal-pill">
          <Icon name="crystal" size={16} /> {api.meta.crystals.toLocaleString('pt-BR')}
        </span>
      </header>

      <div className="progress-hero">
        <div className="progress-hero__bar">
          <span style={{ width: `${(unlocked.length / ACHIEVEMENTS.length) * 100}%` }} />
        </div>
        <span className="progress-hero__label">
          {Math.round((unlocked.length / ACHIEVEMENTS.length) * 100)}% completo
        </span>
      </div>

      <ul className="achievement-list">
        {ACHIEVEMENTS.map((achievement, index) => {
          const done = unlocked.includes(achievement.id);
          return (
            <motion.li
              key={achievement.id}
              className={`achievement ${done ? 'is-done' : ''}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(0.4, index * 0.03) }}
            >
              <span className="achievement__icon">
                <Icon name={ICON_MAP[achievement.icon] ?? 'trophy'} size={22} />
              </span>
              <div className="achievement__body">
                <h3>{achievement.name}</h3>
                <p>{achievement.desc}</p>
              </div>
              <span className={`achievement__reward ${done ? 'is-done' : ''}`}>
                {done ? <Icon name="check" size={15} /> : <Icon name="crystal" size={14} />}
                {done ? 'Concluída' : achievement.crystals}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
