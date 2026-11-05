import { Check, ChevronDown, CircleHelp, LoaderCircle, Monitor, RefreshCw } from 'lucide-react';
import { EVENTS, EVENT_IDS, formatTime } from '../shared/domain.js';
import { PuzzleIcon } from './components';
import type { EventId } from './types';
import type { useTimer } from './useTimer';
import type { useScreenWakeLock } from './useScreenWakeLock';

export function ScreenAwakeStatus({ screen }: { screen: ReturnType<typeof useScreenWakeLock> }) {
  return (
    <div className={`screen-awake ${screen.state === 'active' ? 'is-active' : ''}`} role="status">
      <Monitor size={14} aria-hidden="true" />
      {screen.state === 'active' ? (
        <span>Pantalla encendida durante el entrenamiento</span>
      ) : screen.state === 'unsupported' ? (
        <span>
          Para mantener la pantalla encendida, abre Cube por HTTPS con un navegador compatible.
        </span>
      ) : screen.state === 'unavailable' ? (
        <>
          <span>No se pudo mantener la pantalla encendida. Revisa el ahorro de batería.</span>
          <button type="button" className="text-button" onClick={screen.retry}>
            Reintentar
          </button>
        </>
      ) : (
        <span>Preparando la pantalla para entrenar…</span>
      )}
    </div>
  );
}

export function EventTabs({
  event,
  disabled,
  onChange,
}: {
  event: EventId;
  disabled: boolean;
  onChange: (event: EventId) => void;
}) {
  return (
    <div className="event-tabs" role="group" aria-label="Elige un puzzle">
      {(EVENT_IDS as EventId[]).map((id) => (
        <button
          key={id}
          className={`event-tab ${event === id ? 'selected' : ''}`}
          onClick={() => onChange(id)}
          disabled={disabled}
        >
          <PuzzleIcon event={id} />
          <span>
            <strong>{EVENTS[id].name}</strong>
            <small>{EVENTS[id].label}</small>
          </span>
          {event === id && <Check className="tab-check" size={17} />}
        </button>
      ))}
    </div>
  );
}

export function ScramblePanel({
  event,
  alg,
  loading,
  disabled,
  onGenerate,
  number,
}: {
  event: EventId;
  alg: string | null;
  loading: boolean;
  disabled: boolean;
  onGenerate: () => void;
  number?: number;
}) {
  return (
    <section className="panel scramble-panel">
      <div className="row between">
        <span className="section-label">
          <RefreshCw size={15} />{' '}
          {number === undefined ? 'TU MEZCLA' : `INTENTO #${number} · TU MEZCLA`}
        </span>
        <details className="legend">
          <summary>
            <CircleHelp size={15} />
            <span>¿Cómo se lee?</span>
            <ChevronDown size={13} />
          </summary>
          <div className="legend-content">
            <h3>Una letra, un movimiento</h3>
            {event === 'pyram' ? (
              <>
                <p>
                  <b>U</b> arriba · <b>L</b> izquierda · <b>R</b> derecha · <b>B</b> detrás.
                </p>
                <p>
                  Las mayúsculas giran una capa de 120°. Las minúsculas <b>u, l, r, b</b> giran solo
                  la punta.
                </p>
                <p>Empieza con verde delante, amarillo en la base y una punta arriba.</p>
              </>
            ) : (
              <>
                <div className="legend-grid">
                  {[
                    ['F', 'Frontal'],
                    ['U', 'Arriba'],
                    ['R', 'Derecha'],
                    ['B', 'Trasera'],
                    ['D', 'Abajo'],
                    ['L', 'Izquierda'],
                  ].map(([letter, label]) => (
                    <span key={letter}>
                      <b>{letter}</b>
                      {label}
                    </span>
                  ))}
                </div>
                <p>
                  Sin símbolo: 90° en sentido horario mirando esa cara de frente. <b>′</b> indica
                  sentido antihorario; <b>2</b> es media vuelta (180°).
                </p>
                <p>Empieza con blanco arriba y verde delante.</p>
              </>
            )}
            {event === 'pyram' && (
              <p>
                <b>′</b> indica sentido antihorario mirando de frente la punta que gira.
              </p>
            )}
          </div>
        </details>
      </div>
      <div className={`scramble-content ${loading ? 'loading' : ''}`}>
        {loading ? (
          <span className="row">
            <LoaderCircle className="spin" size={20} /> Preparando tu próxima mezcla…
          </span>
        ) : (
          <p className="alg" aria-label="Mezcla actual">
            {alg ?? 'No hay una mezcla disponible.'}
          </p>
        )}
      </div>
      <div className="row between">
        <span className="help">Mezcla de estado aleatorio</span>
        <button className="text-button" onClick={onGenerate} disabled={disabled || loading}>
          <RefreshCw size={14} /> Nueva mezcla
        </button>
      </div>
    </section>
  );
}

export function TimerFace({
  timer,
  disabled,
  lastTime = null,
  finishedTime = null,
}: {
  timer: ReturnType<typeof useTimer>;
  disabled: boolean;
  lastTime?: number | 'DNF' | null;
  finishedTime?: number | 'DNF' | null;
}) {
  return (
    <>
      <button
        data-timer
        className={`timer-face ${timer.phase === 'ready' ? 'ready' : ''} ${timer.phase === 'holding' ? 'holding' : ''}`}
        aria-label="Cronómetro: mantén pulsado y suelta para empezar; pulsa para detener"
        disabled={disabled && timer.phase !== 'running'}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          timer.press();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          timer.release();
        }}
        onPointerCancel={timer.cancelPress}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="timer-caption">
          {timer.inspecting
            ? timer.inspectionElapsed >= 17
              ? 'INSPECCIÓN · DNF'
              : timer.inspectionElapsed >= 15
                ? 'INSPECCIÓN · +2'
                : 'TIEMPO DE INSPECCIÓN'
            : timer.phase === 'running'
              ? 'A TU RITMO'
              : timer.phase === 'ready'
                ? '¡LISTO! SUELTA PARA EMPEZAR'
                : timer.phase === 'holding'
                  ? 'MANTÉN UN INSTANTE…'
                  : lastTime !== null || finishedTime !== null
                    ? 'ÚLTIMO TIEMPO'
                    : 'TU PRÓXIMO RETO EMPIEZA AQUÍ'}
        </span>
        <span className="timer-digits mono">
          {timer.inspecting
            ? String(Math.max(0, Math.ceil(15 - timer.inspectionElapsed)))
            : formatTime(
                timer.phase === 'stopped' && finishedTime !== null
                  ? finishedTime
                  : timer.phase === 'idle' && lastTime !== null
                    ? lastTime
                    : timer.elapsed,
              )}
        </span>
        <span className="timer-instruction">
          {timer.phase === 'running' ? (
            'Pulsa para parar'
          ) : timer.phase === 'ready' ? (
            <>
              <span className="ready-dot" /> Preparado
            </>
          ) : timer.phase === 'stopped' && finishedTime !== null ? (
            'Genera una nueva mezcla para continuar'
          ) : (
            <>
              <span className="keycap">espacio</span>
              <span>o mantén pulsado aquí y suelta</span>
            </>
          )}
        </span>
      </button>
      {timer.active && (
        <button className="text-button cancel-timer" onClick={timer.reset}>
          Cancelar intento <kbd>esc</kbd>
        </button>
      )}
    </>
  );
}
