import { useState } from 'react';
import { Flag, Timer } from 'lucide-react';
import { Trainer } from './Trainer';
import { CompetitionMode } from './CompetitionMode';
import { GoalsPanel } from './GoalsPanel';
import type { Solve } from './types';

export function TrainingPage(props: {
  solves: Solve[];
  onSaved: () => Promise<void>;
  onPublicChanged: () => Promise<void>;
  onPublish: (solve: Solve, kind: 'single' | 'ao5') => void;
  onHistory: () => void;
}) {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('cube-round-pending-v1') ||
        localStorage.getItem('cube-training-view') === 'competition'
        ? 'competition'
        : 'free';
    } catch {
      return 'free';
    }
  });
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="segmented training-mode" aria-label="Tipo de entrenamiento">
        <button
          className={mode === 'free' ? 'active' : ''}
          disabled={busy}
          onClick={() => {
            setMode('free');
            localStorage.setItem('cube-training-view', 'free');
          }}
        >
          <Timer size={16} /> Entrenamiento libre
        </button>
        <button
          className={mode === 'competition' ? 'active' : ''}
          disabled={busy}
          onClick={() => {
            setMode('competition');
            localStorage.setItem('cube-training-view', 'competition');
          }}
        >
          <Flag size={16} /> Competición · 5
        </button>
      </div>
      <GoalsPanel solves={props.solves} onPublicChanged={props.onPublicChanged} />
      {mode === 'free' ? (
        <Trainer {...props} onBusy={setBusy} />
      ) : (
        <CompetitionMode {...props} onBusy={setBusy} />
      )}
    </>
  );
}
