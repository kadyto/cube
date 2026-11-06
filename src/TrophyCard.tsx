import { Trophy } from 'lucide-react';
import { EVENTS, formatTime } from '../shared/domain.js';
import { SourceBadge } from './components';
import type { Achievement } from './types';

export const subLabel = (targetCs: number) =>
  `Sub-${(targetCs / 100).toLocaleString('es', { maximumFractionDigits: 2 })}`;
export function TrophyCard({ achievement }: { achievement: Achievement }) {
  return (
    <article className="goal-card achieved">
      <div className="goal-cup">
        <Trophy size={28} aria-hidden="true" />
      </div>
      <div>
        <strong className="goal-target">{subLabel(achievement.targetCs)}</strong>
        <p>
          {EVENTS[achievement.event].name} · {achievement.kind === 'single' ? 'Single' : 'ao5'}
        </p>
      </div>
      <strong className="mono">{formatTime(achievement.value)}</strong>
      <SourceBadge source={achievement.measurementSource} />
      <span className="help">
        Conseguido el {new Date(achievement.achievedAt).toLocaleDateString('es')}
      </span>
    </article>
  );
}
