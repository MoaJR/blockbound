import { useState } from 'react';
import type { GameApi } from '../hooks/useGame';
import { Modal } from '../components/Modal';
import { Icon } from '../ui/icons';
import type { IconName } from '../ui/icons';
import type { VisualQuality } from '../engine/types';
import { sfx } from '../audio/sfx';
import { useQualityLevel } from '../fx/useQuality';

export interface SettingsModalProps {
  api: GameApi;
}

interface ToggleProps {
  label: string;
  desc: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function Toggle({ label, desc, value, onChange }: ToggleProps) {
  return (
    <label className="toggle">
      <span className="toggle__text">
        <strong>{label}</strong>
        <em>{desc}</em>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
      <span className={`toggle__track ${value ? 'is-on' : ''}`} aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </label>
  );
}

interface SliderProps {
  label: string;
  desc: string;
  icon: IconName;
  value: number;
  onChange: (value: number) => void;
  onPreview?: () => void;
}

function Slider({ label, desc, icon, value, onChange, onPreview }: SliderProps) {
  return (
    <div className="setting">
      <div className="setting__head">
        <span>
          <Icon name={icon} size={16} /> {label}
        </span>
        <em>{Math.round(value * 100)}%</em>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        onPointerUp={onPreview}
        aria-label={label}
      />
      <p className="setting__hint">{desc}</p>
    </div>
  );
}

const QUALITY_OPTIONS: { id: VisualQuality; label: string }[] = [
  { id: 'auto', label: 'Automática' },
  { id: 'high', label: 'Alta' },
  { id: 'economy', label: 'Econômica' },
];

export function SettingsModal({ api }: SettingsModalProps) {
  const settings = api.meta.settings;
  const quality = useQualityLevel();
  const [confirm, setConfirm] = useState(false);

  return (
    <Modal
      title="Configurações"
      subtitle="Áudio, feedback e desempenho"
      onClose={api.closeSettings}
      footer={
        <button type="button" className="btn btn--primary btn--sm" onClick={api.closeSettings}>
          Fechar
        </button>
      }
    >
      <div className="settings__section">
        <span className="rail-label">
          <Icon name="sound" size={14} /> Áudio
        </span>
        <Slider
          label="Volume geral"
          desc="Equilibra música e efeitos juntos."
          icon={settings.muted ? 'mute' : 'sound'}
          value={settings.volume}
          onChange={(value) => api.patchSettings({ volume: value })}
        />
        <Slider
          label="Música"
          desc="Trilha adaptativa e camadas de ambiente."
          icon="star"
          value={settings.musicVolume}
          onChange={(value) => api.patchSettings({ musicVolume: value })}
        />
        <Slider
          label="Efeitos"
          desc="Encaixes, combos, relíquias e interface."
          icon="wand"
          value={settings.sfxVolume}
          onChange={(value) => api.patchSettings({ sfxVolume: value })}
          onPreview={() => sfx.play('uiSelect')}
        />
        <div className="settings__test-row">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            data-sfx="none"
            onClick={() => sfx.play('relic', 2)}
          >
            <Icon name="sound" size={14} /> Testar áudio
          </button>
          <span className="setting__hint">O áudio só inicia após seu primeiro toque.</span>
        </div>
      </div>

      <Toggle
        label="Som geral"
        desc="Música e efeitos sonoros"
        value={!settings.muted}
        onChange={(value) => api.patchSettings({ muted: !value })}
      />
      <Toggle
        label="Vibração"
        desc="Feedback tátil em dispositivos compatíveis"
        value={settings.haptics}
        onChange={(value) => api.patchSettings({ haptics: value })}
      />

      <div className="settings__section">
        <span className="rail-label">
          <Icon name="eye" size={14} /> Qualidade visual
        </span>
        <div className="segmented" role="group" aria-label="Qualidade visual">
          {QUALITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`segmented__btn ${settings.quality === option.id ? 'is-active' : ''}`}
              aria-pressed={settings.quality === option.id}
              onClick={() => api.patchSettings({ quality: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="setting__hint">
          {settings.quality === 'auto'
            ? `Automática: ajustando para ${quality === 'low' ? 'econômica' : 'alta'} conforme o dispositivo.`
            : settings.quality === 'economy'
              ? 'Menos partículas, menos brilho e menos blur — ideal para aparelhos intermediários.'
              : 'Partículas completas, brilhos e animações cinematográficas.'}
        </p>
      </div>

      <Toggle
        label="Movimento reduzido"
        desc="Mantém o feedback essencial e reduz animações intensas"
        value={settings.reducedMotion}
        onChange={(value) => api.patchSettings({ reducedMotion: value })}
      />

      <div className="settings__danger">
        {!confirm ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(true)}>
            <Icon name="refresh" size={14} /> Zerar progresso
          </button>
        ) : (
          <div className="settings__confirm">
            <span>Apagar todo o progresso?</span>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => {
                api.resetProgress();
                setConfirm(false);
              }}
            >
              Apagar
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
