import { Check, ChevronDown, CircleHelp, LoaderCircle, Monitor, RefreshCw } from 'lucide-react';
import { EVENTS, EVENT_IDS, formatTime } from '../shared/domain.js';
import { PuzzleIcon } from './components';
import type { EventId } from './types';
import type { useTimer } from './useTimer';
import type { useScreenWakeLock } from './useScreenWakeLock';

export function ScreenAwakeStatus({ screen }: { screen: ReturnType<typeof useScreenWakeLock> }) {
  const unavailableMessage =
    'No se pudo mantener la pantalla encendida. Revisa el ahorro de batería.';
  const retryLabel = 'Reintentar';
  const active = screen.state === 'active';
  const unavailable = screen.state === 'unavailable';
  const message = active
    ? 'Pantalla encendida durante el entrenamiento'
    : screen.state === 'unsupported'
      ? 'Para mantener la pantalla encendida, abre Cube por HTTPS con un navegador compatible.'
      : unavailable
        ? unavailableMessage
        : 'Preparando la pantalla para entrenar…';

  return (
    <div className="screen-awake-slot">
      {/* Keep the controls below in place when pointerdown starts a retry. */}
      <div className="screen-awake-reserve" aria-hidden="true">
        <Monitor size={14} />
        <span className="screen-awake-message">{unavailableMessage}</span>
        <span className="text-button">{retryLabel}</span>
      </div>
      <div className={`screen-awake ${active ? 'is-active' : ''}`} role="status">
        <Monitor size={14} aria-hidden="true" />
        <span className="screen-awake-message">{message}</span>
        {unavailable && (
          <button type="button" className="text-button" onClick={screen.retry}>
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function EventTabs({
  event,
  disabled,
  onChange,
  compact = false,
}: {
  event: EventId;
  disabled: boolean;
  onChange: (event: EventId) => void;
  compact?: boolean;
}) {
  return (
    <div className="event-tabs" role="group" aria-label="Elige un puzzle">
      {EVENT_IDS.map((id) => (
        <button
          type="button"
          key={id}
          className={`event-tab ${event === id ? 'selected' : ''}`}
          onClick={() => onChange(id)}
          disabled={disabled}
          aria-pressed={event === id}
        >
          <PuzzleIcon event={id} size={compact ? 22 : 36} />
          <span>
            <strong>{compact ? EVENTS[id].name.replace(/×[23]$/, '') : EVENTS[id].name}</strong>
            {!compact && <small>{EVENTS[id].label}</small>}
          </span>
          {!compact && event === id && <Check className="tab-check" size={17} />}
        </button>
      ))}
    </div>
  );
}

export function SkewbNotation() {
  return (
    <>
      <p>
        <b>R</b> abajo detrás a la derecha · <b>L</b> abajo delante a la izquierda · <b>B</b> abajo
        detrás a la izquierda · <b>U</b> arriba detrás a la izquierda.
      </p>
      <p>
        Gira 120° en sentido horario mirando ese vértice. <b>′</b> invierte el giro.
      </p>
    </>
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
  onGenerate?: () => void;
  number?: number;
}) {
  return (
    <section className="panel scramble-panel">
      <div className="row between">
        <span className="section-label">
          <RefreshCw size={15} />{' '}
          {onGenerate
            ? number === undefined
              ? 'TU MEZCLA'
              : `INTENTO #${number} · TU MEZCLA`
            : 'Mezcla'}
        </span>
        <details className="legend">
          <summary>
            <CircleHelp size={15} />
            <span>¿Cómo se lee?</span>
            <ChevronDown size={13} />
          </summary>
          <div className="legend-content">
            <h3>Una letra, un movimiento</h3>
            {event === 'skewb' ? (
              <>
                <p>Empieza con blanco arriba y verde delante.</p>
                <SkewbNotation />
              </>
            ) : event === 'pyram' ? (
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
          <span className="row" role="status">
            <LoaderCircle className="spin" size={20} /> Preparando tu próxima mezcla…
          </span>
        ) : (
          <p className="alg" aria-label="Mezcla actual">
            {alg ?? 'No hay una mezcla disponible.'}
          </p>
        )}
      </div>
      {onGenerate && (
        <div className="row between">
          <span className="help">Mezcla de estado aleatorio</span>
          <button className="text-button" onClick={onGenerate} disabled={disabled || loading}>
            <RefreshCw size={14} /> Nueva mezcla
          </button>
        </div>
      )}
    </section>
  );
}

export function TimerFace({
  timer,
  disabled,
  lastTime = null,
  finishedTime = null,
  finishedInstruction = 'Genera una nueva mezcla para continuar',
  embedded = false,
}: {
  timer: ReturnType<typeof useTimer>;
  disabled: boolean;
  lastTime?: number | 'DNF' | null;
  finishedTime?: number | 'DNF' | null;
  finishedInstruction?: string;
  embedded?: boolean;
}) {
  const captions = embedded
    ? {
        running: 'En marcha',
        ready: 'Suelta para empezar',
        result: 'Intento actual',
        idle: 'Cronómetro',
      }
    : {
        running: 'A TU RITMO',
        ready: '¡LISTO! SUELTA PARA EMPEZAR',
        result: 'ÚLTIMO TIEMPO',
        idle: 'TU PRÓXIMO RETO EMPIEZA AQUÍ',
      };
  return (
    <>
      <button
        type="button"
        data-timer
        className={`timer-face ${timer.phase === 'ready' ? 'ready' : ''} ${timer.phase === 'holding' ? 'holding' : ''}`}
        aria-label="Cronómetro: mantén pulsado y suelta para empezar; pulsa para detener"
        disabled={disabled && timer.phase !== 'running'}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          if (embedded) e.currentTarget.focus({ preventScroll: true });
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
              ? captions.running
              : timer.phase === 'ready'
                ? captions.ready
                : timer.phase === 'holding'
                  ? 'MANTÉN UN INSTANTE…'
                  : lastTime !== null || finishedTime !== null
                    ? captions.result
                    : captions.idle}
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
            finishedInstruction
          ) : embedded ? (
            <>
              <span>Mantén pulsado y suelta</span>
              <span className="keycap">Espacio</span>
            </>
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
