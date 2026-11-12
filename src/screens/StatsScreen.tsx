import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { GameApi } from '../hooks/useGame';
import { Modal } from '../components/Modal';
import { Icon } from '../ui/icons';

export interface StatsScreenProps {
  api: GameApi;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

export function StatsScreen({ api }: StatsScreenProps) {
  const { stats } = api.meta;
  const [confirm, setConfirm] = useState(false);

  const rows = [
    { label: 'Runs jogadas', value: stats.runs, icon: 'play' as const },
    { label: 'Vitórias', value: stats.wins, icon: 'crown' as const },
    { label: 'Melhor pontuação', value: stats.bestScore.toLocaleString('pt-BR'), icon: 'star' as const },
    { label: 'Estágio máximo', value: stats.bestStage, icon: 'flag' as const },
    { label: 'Melhor combo', value: `${stats.bestCombo}×`, icon: 'bolt' as const },
    { label: 'Linhas destruídas', value: stats.totalLines, icon: 'rows' as const },
    { label: 'Máx. linhas simultâneas', value: stats.bestSimultaneous, icon: 'cross' as const },
    { label: 'Chefes derrotados', value: stats.bossesDefeated, icon: 'skull' as const },
    { label: 'Poderes usados', value: stats.powersUsed, icon: 'wand' as const },
    { label: 'Corrompidas purificadas', value: stats.corruptDestroyed, icon: 'virus' as const },
    { label: 'Bombas desarmadas', value: stats.bombsDefused, icon: 'bomb' as const },
    { label: 'Relíquias encontradas', value: stats.totalRelicsFound, icon: 'collection' as const },
    { label: 'Cristais ganhos', value: stats.crystalsEarned.toLocaleString('pt-BR'), icon: 'crystal' as const },
    { label: 'Tempo de jogo', value: formatTime(stats.playSeconds), icon: 'clock' as const },
  ];

  return (
    <div className="subscreen stats-screen screen">
      <header className="subscreen__head">
        <button type="button" className="icon-btn" aria-label="Voltar" onClick={api.goMenu}>
          <Icon name="back" size={20} />
        </button>
        <div className="subscreen__title">
          <h1>Estatísticas</h1>
          <p>Seus recordes e o histórico da conta.</p>
        </div>
        <span className="crystal-pill">
          <Icon name="crystal" size={16} /> {api.meta.crystals.toLocaleString('pt-BR')}
        </span>
      </header>

      <div className="stat-grid">
        {rows.map((row) => (
          <div className="stat-tile" key={row.label}>
            <span className="stat-tile__icon">
              <Icon name={row.icon} size={18} />
            </span>
            <strong>{row.value}</strong>
            <span>{row.label}</span>
          </div>
        ))}
      </div>

      <div className="stats-last">
        <h2>Última run</h2>
        {api.meta.lastRun ? (
          <p>
            {api.meta.lastRun.won ? 'Vitória' : 'Derrota'} · estágio {api.meta.lastRun.stage} ·{' '}
            {api.meta.lastRun.score.toLocaleString('pt-BR')} pontos ·{' '}
            {new Date(api.meta.lastRun.at).toLocaleDateString('pt-BR')}
          </p>
        ) : (
          <p>Nenhuma run registrada ainda.</p>
        )}
        <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirm(true)}>
          <Icon name="refresh" size={15} /> Zerar progresso
        </button>
      </div>

      <AnimatePresence>
        {confirm && (
          <Modal
            title="Zerar progresso"
            subtitle="Isso apaga cristais, relíquias, talentos, conquistas e recordes. Não pode ser desfeito."
            onClose={() => setConfirm(false)}
            footer={
              <>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => {
                    api.resetProgress();
                    setConfirm(false);
                  }}
                >
                  Apagar tudo
                </button>
              </>
            }
          >
            <p className="modal__text">Tem certeza que quer recomeçar do zero?</p>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
