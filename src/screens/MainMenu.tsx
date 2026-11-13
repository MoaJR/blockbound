import { m as motion } from 'framer-motion';
import type { GameApi } from '../hooks/useGame';
import { ACHIEVEMENTS } from '../engine/achievements';
import { RELICS } from '../engine/relics';
import { Ambient } from '../components/Ambient';
import { Icon } from '../ui/icons';

export interface MainMenuProps {
  api: GameApi;
}

export function MainMenu({ api }: MainMenuProps) {
  const { meta } = api;
  const continueStage = api.run?.stage.number ?? 0;
  return (
    <div className="menu screen">
      <Ambient />

      <header className="menu__top">
        <span className="menu__tagline">PUZZLE ROGUELITE</span>
        <div className="menu__wallet">
          <span className="crystal-pill">
            <Icon name="crystal" size={17} />
            {meta.crystals.toLocaleString('pt-BR')}
          </span>
          <button type="button" className="icon-btn" aria-label="Configurações" onClick={api.openSettings}>
            <Icon name="gear" size={20} />
          </button>
        </div>
      </header>

      <section className="menu__hero">
        <motion.div
          className="logo"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 90, damping: 16 }}
        >
          <span className="logo__glyph" aria-hidden="true">
            <span className="logo__glyph-ring" />
            <Icon name="prism" size={40} />
          </span>
          <h1 className="logo__text">
            BLOCK<span>BOUND</span>
          </h1>
          <p className="logo__sub">Encaixe · Exploda · Colecione</p>
        </motion.div>

        <div className="menu__float" aria-hidden="true">
          <span className="float-block float-block--cyan" />
          <span className="float-block float-block--violet" />
          <span className="float-block float-block--gold" />
          <span className="float-star float-star--1">
            <Icon name="star" size={16} />
          </span>
          <span className="float-star float-star--2">
            <Icon name="star" size={12} />
          </span>
          <span className="float-crystal float-crystal--1" />
          <span className="float-crystal float-crystal--2" />
        </div>
      </section>

      <motion.section
        className="menu__actions"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <motion.button
          type="button"
          className="btn btn--primary menu__play"
          onClick={api.startRun}
          whileTap={{ scale: 0.975 }}
        >
          <Icon name="play" size={20} />
          Jogar
        </motion.button>
        {api.hasSave && (
          <motion.button
            type="button"
            className="btn menu__continue"
            onClick={api.continueRun}
            whileTap={{ scale: 0.98 }}
          >
            <span className="menu__continue-main">
              <Icon name="play" size={16} /> Continuar
            </span>
            <span className="menu__continue-sub">Estágio {continueStage} · {api.run?.score.toLocaleString('pt-BR')} pts</span>
          </motion.button>
        )}

        <div className="menu__grid">
          <button type="button" className="menu__tile" onClick={() => api.goto('collection')}>
            <Icon name="collection" size={22} />
            <span>Coleção</span>
            <em>
              {meta.unlockedRelics.length}/{RELICS.length}
            </em>
          </button>
          <button type="button" className="menu__tile" onClick={() => api.goto('achievements')}>
            <Icon name="trophy" size={22} />
            <span>Conquistas</span>
            <em>
              {meta.achievements.length}/{ACHIEVEMENTS.length}
            </em>
          </button>
          <button type="button" className="menu__tile" onClick={() => api.goto('stats')}>
            <Icon name="chart" size={22} />
            <span>Estatísticas</span>
            <em>{meta.stats.runs} runs</em>
          </button>
        </div>
      </motion.section>

      <footer className="menu__foot">
        <span>
          <Icon name="trophy" size={13} /> Recorde {meta.stats.bestScore.toLocaleString('pt-BR')}
        </span>
        {meta.lastRun && (
          <span>
            Última run: {meta.lastRun.score.toLocaleString('pt-BR')} pts · estágio {meta.lastRun.stage}
          </span>
        )}
        <span className="menu__version">v1.0</span>
      </footer>
    </div>
  );
}
