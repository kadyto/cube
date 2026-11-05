import { useCallback, useEffect, useRef, useState } from 'react';
import { Github, Play, RefreshCw, Timer } from 'lucide-react';
import { effectiveTime } from '../shared/domain.js';
import { errorMessage } from './api';
import { ScramblePreview } from './ScramblePreview';
import { EventTabs, ScramblePanel, ScreenAwakeStatus, TimerFace } from './TrainingWidgets';
import { useScreenWakeLock } from './useScreenWakeLock';
import { useTimer } from './useTimer';
import type { EventId, Penalty } from './types';

export function Demo() {
  // This view keeps only the current attempt in memory. It never reads or writes browser storage.
  const [event, setEvent] = useState<EventId>('333');
  const [alg, setAlg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [inspection, setInspection] = useState(false);
  const [result, setResult] = useState<{ timeCs: number; penalty: Penalty } | null>(null);
  const request = useRef<AbortController | null>(null);
  const screen = useScreenWakeLock();
  const timer = useTimer({
    disabled: loading || !alg,
    inspection,
    onFinish: (timeCs, penalty) => setResult({ timeCs, penalty }),
  });
  const generate = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    setAlg(null);
    setResult(null);
    timer.reset();
    try {
      const response = await fetch('/api/demo/scramble', {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-Cube-Request': '1' },
        body: JSON.stringify({ event }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? 'No se pudo generar la mezcla. Vuelve a intentarlo.');
      if (data.event !== event || typeof data.alg !== 'string' || !data.alg.trim())
        throw new Error('No se pudo leer la mezcla. Vuelve a intentarlo.');
      if (!controller.signal.aborted) setAlg(data.alg);
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [event, timer.reset]);
  useEffect(() => {
    void generate();
    return () => request.current?.abort();
  }, [generate]);
  const cancel = () => {
    timer.reset();
    setResult(null);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRUEBA A TU RITMO</p>
          <h1>
            Demo<span className="green-dot">.</span>
          </h1>
          <p className="muted">Genera una mezcla y pon en marcha el cronómetro. Sin contraseña.</p>
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
      <EventTabs
        event={event}
        disabled={timer.active}
        onChange={(next) => {
          if (!timer.active && next !== event) {
            cancel();
            setEvent(next);
          }
        }}
      />
      <ScramblePanel
        event={event}
        alg={alg}
        loading={loading}
        disabled={timer.active}
        onGenerate={() => void generate()}
      />
      {error && (
        <div className="error-box row between" role="alert">
          <span>{error}</span>
          <button className="text-button" onClick={() => void generate()}>
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
          timer={{ ...timer, reset: cancel }}
          disabled={!alg || loading || timer.phase === 'stopped'}
          finishedTime={result ? effectiveTime(result) : null}
        />
        <div className="timer-footer demo-timer-footer">
          <span>
            {result
              ? `Intento terminado${result.penalty === '+2' ? ' · +2 de inspección' : result.penalty === 'DNF' ? ' · DNF de inspección' : ''}. Este tiempo no se guarda.`
              : 'Sólo mezclar y cronometrar, sin historial.'}
          </span>
          <button
            className="text-button"
            onClick={() => void generate()}
            disabled={timer.active || loading}
          >
            <RefreshCw size={14} /> Siguiente mezcla
          </button>
        </div>
      </section>
      <ScramblePreview event={event} alg={alg} disabled={timer.active || loading} />
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
