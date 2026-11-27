import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { effectiveTime, formatTime } from '../../shared/domain.js';
import { ScramblePreview } from '../ScramblePreview';
import { EventTabs, ScramblePanel, TimerFace } from '../TrainingWidgets';
import type { EventId } from '../types';
import { useDemoTraining } from '../useDemoTraining';
import { useScreenWakeLock } from '../useScreenWakeLock';

async function localScramble(event: EventId, signal: AbortSignal) {
  try {
    const { randomScrambleForEvent } = await import('cubing/scramble');
    signal.throwIfAborted();
    return (await randomScrambleForEvent(event)).toString();
  } catch {
    throw new Error('No se pudo generar la mezcla. Vuelve a intentarlo o recarga la página.');
  }
}

export function WordPressTraining() {
  const scope = useRef<HTMLDivElement>(null);
  const {
    event,
    chooseEvent,
    alg,
    loading,
    error,
    inspection,
    setInspection,
    result,
    generate,
    timer,
  } = useDemoTraining(localScramble, scope);
  const screen = useScreenWakeLock();
  const finishedTime = result ? effectiveTime(result) : null;

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void generate();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [generate]);

  return (
    <div ref={scope}>
      <div className="cbt-toolbar">
        <EventTabs event={event} disabled={timer.active} onChange={chooseEvent} compact />
        <label className="cbt-inspection">
          <input
            type="checkbox"
            checked={inspection}
            disabled={timer.active}
            onChange={(event) => setInspection(event.target.checked)}
          />
          <span>Inspección de 15 s</span>
        </label>
      </div>
      <div className="cbt-grid">
        <div className="cbt-scramble">
          <ScramblePanel event={event} alg={alg} loading={loading} disabled={timer.active} />
          {error && (
            <p className="cbt-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <section className="cbt-timer" aria-label="Cronómetro de entrenamiento">
          <div className="cbt-stage" data-phase={timer.phase}>
            <TimerFace
              timer={timer}
              disabled={!alg || loading || timer.phase === 'stopped'}
              finishedTime={finishedTime}
              embedded
            />
          </div>
          <div className="cbt-timer-actions">
            <p className="cbt-sr-only" role="status">
              {result && `Tiempo ${formatTime(finishedTime)}.`}
            </p>
            <p className="cbt-status">
              {result?.penalty === '+2'
                ? '+2 de inspección'
                : screen.state === 'active' && 'Pantalla activa durante la práctica'}
            </p>
            <button
              type="button"
              className="cbt-next"
              onClick={() => {
                if (!loading) void generate();
              }}
              disabled={timer.active}
              aria-disabled={loading || undefined}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {error ? 'Reintentar mezcla' : result ? 'Siguiente mezcla' : 'Nueva mezcla'}
            </button>
          </div>
        </section>
        <div className="cbt-diagram">
          <ScramblePreview event={event} alg={alg} disabled={timer.active || loading} />
        </div>
      </div>
    </div>
  );
}
