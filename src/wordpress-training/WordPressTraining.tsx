import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { effectiveTime, formatTime } from '../../shared/domain.js';
import { CaseSetup, PracticeMode } from '../CasePractice';
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
    casePractice,
    chooseMode,
    chooseCase,
    setShowingAlgorithm,
    alg,
    loading,
    error,
    inspection,
    setInspection,
    result,
    restart,
    timer,
  } = useDemoTraining(localScramble, scope);
  const screen = useScreenWakeLock();
  const finishedTime = result ? effectiveTime(result) : null;

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) restart();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [restart]);

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
      <PracticeMode byCase={!!casePractice} disabled={timer.active} onChange={chooseMode} />
      <div className="cbt-grid">
        <div className="cbt-scramble">
          {casePractice ? (
            <CaseSetup
              practice={casePractice}
              disabled={timer.active}
              onChooseCase={chooseCase}
              onShowAlgorithm={setShowingAlgorithm}
            />
          ) : (
            <ScramblePanel event={event} alg={alg} loading={loading} disabled={timer.active} />
          )}
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
              finishedInstruction={casePractice ? 'Pulsa «Repetir caso» para continuar' : undefined}
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
                if (!loading) restart();
              }}
              disabled={timer.active}
              aria-disabled={loading || undefined}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {casePractice
                ? 'Repetir caso'
                : error
                  ? 'Reintentar mezcla'
                  : result
                    ? 'Siguiente mezcla'
                    : 'Nueva mezcla'}
            </button>
          </div>
        </section>
        <div className="cbt-diagram">
          <ScramblePreview
            event={event}
            alg={alg}
            disabled={timer.active || loading}
            caseOrientation={!!casePractice}
          />
        </div>
      </div>
    </div>
  );
}
