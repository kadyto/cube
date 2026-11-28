import { Github, Play, RefreshCw, Timer } from 'lucide-react';
import { effectiveTime } from '../shared/domain.js';
import { CaseSetup, PracticeMode } from './CasePractice';
import { ScramblePreview } from './ScramblePreview';
import { EventTabs, ScramblePanel, ScreenAwakeStatus, TimerFace } from './TrainingWidgets';
import { useDemoTraining } from './useDemoTraining';
import { useScreenWakeLock } from './useScreenWakeLock';
import type { EventId } from './types';

async function fetchDemoScramble(event: EventId, signal: AbortSignal) {
  const response = await fetch('/api/demo/scramble', {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    signal,
    headers: { 'Content-Type': 'application/json', 'X-Cube-Request': '1' },
    body: JSON.stringify({ event }),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? 'No se pudo generar la mezcla. Vuelve a intentarlo.');
  if (data.event !== event || typeof data.alg !== 'string' || !data.alg.trim())
    throw new Error('No se pudo leer la mezcla. Vuelve a intentarlo.');
  return data.alg;
}

export function Demo() {
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
  } = useDemoTraining(fetchDemoScramble);
  const screen = useScreenWakeLock();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRUEBA A TU RITMO</p>
          <h1>
            Demo<span className="green-dot">.</span>
          </h1>
          <p className="muted">Practica con una mezcla completa o un caso. Sin contraseña.</p>
        </div>
        <span className="private-pill">
          <Play size={15} /> Modo demo
        </span>
      </div>
      <p className="demo-notice">
        Aquí no se guardan ni se comparten tiempos. El intento actual desaparece al salir o
        recargar.
      </p>
      <ScreenAwakeStatus screen={screen} />
      <EventTabs event={event} disabled={timer.active} onChange={chooseEvent} />
      <PracticeMode byCase={!!casePractice} disabled={timer.active} onChange={chooseMode} />
      {casePractice ? (
        <CaseSetup
          practice={casePractice}
          disabled={timer.active}
          onChooseCase={chooseCase}
          onShowAlgorithm={setShowingAlgorithm}
        />
      ) : (
        <ScramblePanel
          event={event}
          alg={alg}
          loading={loading}
          disabled={timer.active}
          onGenerate={restart}
        />
      )}
      {error && (
        <div className="error-box row between" role="alert">
          <span>{error}</span>
          <button className="text-button" onClick={restart}>
            Reintentar mezcla
          </button>
        </div>
      )}
      <section
        className={`panel timer-panel demo-timer-panel ${timer.phase === 'running' ? 'is-running' : ''}`}
      >
        <div className="timer-toolbar">
          <span className="row help">
            <Timer size={16} /> Cronómetro demo
          </span>
          <label className="switch-label">
            <input
              type="checkbox"
              checked={inspection}
              disabled={timer.active}
              onChange={(e) => setInspection(e.target.checked)}
            />
            <span>Inspección 15 s</span>
          </label>
        </div>
        <TimerFace
          timer={timer}
          disabled={!alg || loading || timer.phase === 'stopped'}
          finishedTime={result ? effectiveTime(result) : null}
          finishedInstruction={casePractice ? 'Pulsa «Repetir caso» para continuar' : undefined}
        />
        <div className="timer-footer demo-timer-footer">
          <span>
            {result
              ? `Intento terminado${result.penalty === '+2' ? ' · +2 de inspección' : result.penalty === 'DNF' ? ' · DNF de inspección' : ''}. Este tiempo no se guarda.`
              : 'Cronómetro sin historial.'}
          </span>
          <button className="text-button" onClick={restart} disabled={timer.active || loading}>
            <RefreshCw size={14} /> {casePractice ? 'Repetir caso' : 'Siguiente mezcla'}
          </button>
        </div>
      </section>
      <ScramblePreview
        event={event}
        alg={alg}
        disabled={timer.active || loading}
        caseOrientation={!!casePractice}
      />
      <div className="demo-install">
        <p>¿Quieres instalar tu propio Cube?</p>
        <a
          className="text-button"
          href="https://github.com/kadyto/cube"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github size={16} aria-hidden="true" /> Código e instalación en GitHub
        </a>
      </div>
    </>
  );
}
