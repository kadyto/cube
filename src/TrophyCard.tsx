import { useId } from 'react';
import { Trophy } from 'lucide-react';
import { EVENTS, formatTime } from '../shared/domain.js';
import { MEDAL_LABELS } from '../shared/training.js';
import { SourceBadge } from './components';
import type { Achievement, Medal } from './types';

export const subLabel = (targetCs: number) =>
  `Sub-${(targetCs / 100).toLocaleString('es', { maximumFractionDigits: 2 })}`;

export function MedalLabel({ medal = 'gold' }: { medal?: Medal }) {
  return (
    <span className={`medal-label medal-${medal}`}>
      <span className="medal-dot" aria-hidden="true" /> {MEDAL_LABELS[medal]}
    </span>
  );
}

export function TrophyColorPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Medal;
  onChange: (value: Medal) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="trophy-color-picker" disabled={disabled}>
      <legend>Color del trofeo</legend>
      <div className="trophy-color-options">
        {(Object.keys(MEDAL_LABELS) as Medal[]).map((medal) => (
          <label
            className={`trophy-color-option medal-${medal} ${value === medal ? 'selected' : ''}`}
            key={medal}
          >
            <input
              type="radio"
              name={name}
              value={medal}
              checked={value === medal}
              onChange={() => onChange(medal)}
            />
            <Trophy size={20} aria-hidden="true" />
            <span>{MEDAL_LABELS[medal]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TrophyCard({ achievement }: { achievement: Achievement }) {
  return (
    <article className={`goal-card achieved medal-${achievement.medal ?? 'gold'}`}>
      <div className="goal-cup">
        <Trophy size={28} aria-hidden="true" />
      </div>
      <div>
        <strong className="goal-target">{subLabel(achievement.targetCs)}</strong>
        <p>
          {EVENTS[achievement.event].name} · {achievement.kind === 'single' ? 'Single' : 'ao5'}
        </p>
      </div>
      <MedalLabel medal={achievement.medal} />
      <strong className="mono">{formatTime(achievement.value)}</strong>
      <SourceBadge source={achievement.measurementSource} />
      <span className="help">
        Conseguido el {new Date(achievement.achievedAt).toLocaleDateString('es')}
      </span>
    </article>
  );
}
