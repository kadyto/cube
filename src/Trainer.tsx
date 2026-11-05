import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Keyboard,
  LoaderCircle,
  Monitor,
  Plus,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  EVENTS,
  EVENT_IDS,
  effectiveTime,
  formatTime,
  parseTime,
  statistics,
  nextAttemptNumber,
  consecutiveWindow,
} from '../shared/domain.js';
import { api, errorMessage } from './api';
import { Empty, ProgressChart, PuzzleIcon, SolveTime } from './components';
import { useTimer } from './useTimer';
import { useScreenWakeLock } from './useScreenWakeLock';
import { SolveEditor } from './SolveEditor';
import { ScramblePreview } from './ScramblePreview';
import type { EventId, Penalty, Scramble, Solve } from './types';

type Pending = { scramble: Scramble; timeCs: number; penalty: Penalty; source: 'manual' | 'timer' };
const PENDING_KEY = 'cube-pending-v1';
function restoredPending(): Pending | null {
  try {
    const item = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null');
    return item?.scramble?.id && Number.isInteger(item.timeCs) ? item : null;
  } catch {
    return null;
  }
}

export function Trainer({
  solves,
  onSaved,
  onPublish,
  onHistory,
}: {
  solves: Solve[];
  onSaved: () => Promise<void>;
  onPublish: (solve: Solve, kind: 'single' | 'ao5') => void;
  onHistory: () => void;
}) {
  const screen = useScreenWakeLock();
  const [pending, setPending] = useState<Pending | null>(restoredPending);
  const [event, setEvent] = useState<EventId>(
    () =>
      restoredPending()?.scramble.event ??
      ((localStorage.getItem('cube-event') as EventId) in EVENTS
        ? (localStorage.getItem('cube-event') as EventId)
        : '333'),
  );
  const [mode, setMode] = useState<'timer' | 'manual'>('timer');
  const [inspection, setInspection] = useState(
    () => localStorage.getItem('cube-inspection') === 'true',
  );
  const [scramble, setScramble] = useState<Scramble | null>(
    () => restoredPending()?.scramble ?? null,
  );
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const [manual, setManual] = useState(''),
    [penalty, setPenalty] = useState<Penalty>('none');
  const [lastSaved, setLastSaved] = useState<Solve | null>(null);
  const [selected, setSelected] = useState<Solve | null>(null),
    [deleting, setDeleting] = useState(false);
  const requestRef = useRef(0),
    savingRef = useRef(false);
  const eventSolves = useMemo(
    () => solves.filter((s) => s.event === event).sort((a, b) => a.number - b.number),
    [solves, event],
  );
  const stats = useMemo(() => statistics(eventSolves), [eventSolves]);
  const nextNumber = useMemo(() => nextAttemptNumber(eventSolves), [eventSolves]);
  const recentSolves = useMemo(
    () =>
      solves
        .filter((s) => s.event === event)
        .slice(-4)
        .reverse(),
    [solves, event],
  );
  const generate = async (selected: EventId = event) => {
    const request = ++requestRef.current;
    setLoading(true);
    setError('');
    setScramble(null);
    try {
      const next = await api<Scramble>('/scramble', 'POST', { event: selected });
      if (request === requestRef.current) setScramble(next);
    } catch (e) {
      if (request === requestRef.current) setError(errorMessage(e));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  };
  const persist = async (attempt: Pending) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    setPending(attempt);
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(attempt));
    } catch {
      /* Still save to the server if browser storage is unavailable. */
    }
    let saved: Solve;
    try {
      saved = await api<Solve>('/solves', 'POST', {
        timeCs: attempt.timeCs,
        penalty: attempt.penalty,
        source: attempt.source,
        scrambleId: attempt.scramble.id,
      });
    } catch (e) {
      setError(`${errorMessage(e)} El intento queda pendiente; pulsa Reintentar guardado.`);
      savingRef.current = false;
      setSaving(false);
      return;
    }
    setLastSaved(saved);
    setPending(null);
    setManual('');
    setPenalty('none');
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* A stale retry is still safe: the server is idempotent. */
    }
    timer.reset();
    try {
      await onSaved();
      await generate(attempt.scramble.event);
    } catch (e) {
      setScramble(null);
      setError(`Tu tiempo está guardado. No se pudo actualizar el historial: ${errorMessage(e)}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const timer = useTimer({
    disabled: !scramble || loading || saving || !!pending || mode !== 'timer',
    inspection,
    onFinish: (timeCs, resultPenalty) => {
      if (scramble) void persist({ scramble, timeCs, penalty: resultPenalty, source: 'timer' });
    },
  });
  useEffect(() => {
    if (!restoredPending()) void generate(event);
    return () => {
      requestRef.current++;
    };
  }, [event]); // eslint-disable-line react-hooks/exhaustive-deps
  const changeEvent = (next: EventId) => {
    if (timer.active || pending || saving) return;
    setEvent(next);
    localStorage.setItem('cube-event', next);
    setLastSaved(null);
    timer.reset();
  };
  const busy = timer.active || saving || !!pending;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">UN POCO MEJOR, MEZCLA A MEZCLA</p>
          <h1>
            Hora de resolver<span className="green-dot">.</span>
          </h1>
          <p className="muted">Concéntrate en tu cubo. Nosotros contamos el tiempo.</p>
        </div>
        <span className="private-pill">
          <ShieldCheck size={15} /> Solo para ti
        </span>
      </div>
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
      <div className="event-tabs" role="group" aria-label="Elige un puzzle">
        {(EVENT_IDS as EventId[]).map((id) => (
          <button
            key={id}
            className={`event-tab ${event === id ? 'selected' : ''}`}
            onClick={() => changeEvent(id)}
            disabled={busy}
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
      <section className="panel scramble-panel">
        <div className="row between">
          <span className="section-label">
            <RefreshCw size={15} /> INTENTO #{nextNumber} · TU MEZCLA
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
                    Las mayúsculas giran una capa de 120°. Las minúsculas <b>u, l, r, b</b> giran
                    solo la punta.
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
              {scramble?.alg ?? 'No hay una mezcla disponible.'}
            </p>
          )}
        </div>
        <div className="row between">
          <span className="help">Mezcla de estado aleatorio</span>
          <button
            className="text-button"
            onClick={() => void generate()}
            disabled={busy || loading}
          >
            <RefreshCw size={14} /> Nueva mezcla
          </button>
        </div>
      </section>
      <section className={`panel timer-panel ${timer.phase === 'running' ? 'is-running' : ''}`}>
        <div className="timer-toolbar">
          <div className="segmented" aria-label="Modo de registro">
            <button
              className={mode === 'timer' ? 'active' : ''}
              onClick={() => {
                setMode('timer');
                timer.reset();
              }}
              disabled={busy}
            >
              <Timer size={16} /> Cronómetro
            </button>
            <button
              className={mode === 'manual' ? 'active' : ''}
              onClick={() => {
                setMode('manual');
                timer.reset();
              }}
              disabled={busy}
            >
              <Keyboard size={16} /> A mano
            </button>
          </div>
          <label className="switch-label">
            <input
              type="checkbox"
              checked={inspection}
              disabled={busy || mode === 'manual'}
              onChange={(e) => {
                setInspection(e.target.checked);
                localStorage.setItem('cube-inspection', String(e.target.checked));
              }}
            />
            <span>Inspección 15 s</span>
          </label>
        </div>
        {mode === 'timer' ? (
          <>
            <button
              data-timer
              className={`timer-face ${timer.phase === 'ready' ? 'ready' : ''} ${timer.phase === 'holding' ? 'holding' : ''}`}
              aria-label="Cronómetro: mantén pulsado y suelta para empezar; pulsa para detener"
              disabled={(!scramble || loading || saving || !!pending) && timer.phase !== 'running'}
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
                        : lastSaved
                          ? 'ÚLTIMO TIEMPO'
                          : 'TU PRÓXIMO RETO EMPIEZA AQUÍ'}
              </span>
              <span className="timer-digits mono">
                {timer.inspecting
                  ? String(Math.max(0, Math.ceil(15 - timer.inspectionElapsed)))
                  : formatTime(
                      timer.phase === 'idle' && lastSaved
                        ? effectiveTime(lastSaved)
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
        ) : (
          <form
            className="manual-form"
            onSubmit={(e) => {
              e.preventDefault();
              const timeCs = parseTime(manual);
              if (!timeCs) {
                setError('Escribe un tiempo válido: 12.34, 12,34 o 1:02.45.');
                return;
              }
              if (scramble) void persist({ scramble, timeCs, penalty, source: 'manual' });
            }}
          >
            <label htmlFor="manual-time">Tu tiempo, con tu cronómetro</label>
            <div className="manual-entry">
              <input
                id="manual-time"
                className="mono"
                placeholder="0.00"
                inputMode="decimal"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                disabled={saving || !!pending}
                autoComplete="off"
              />
              <span>s</span>
            </div>
            <p className="help">Segundos o minutos:segundos. Por ejemplo, 12.34 o 1:02.45.</p>
            <div className="row manual-actions">
              <div className="segmented" aria-label="Penalización">
                {(['none', '+2', 'DNF'] as Penalty[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={penalty === p ? 'active' : ''}
                    onClick={() => setPenalty(p)}
                    disabled={saving || !!pending}
                  >
                    {p === 'none' ? 'Sin penalización' : p}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="button primary"
                disabled={!scramble || saving || !!pending}
              >
                <Plus size={16} /> Guardar tiempo
              </button>
            </div>
          </form>
        )}
        <div className="timer-footer">
          <span className="row">
            {saving ? (
              <>
                <LoaderCircle className="spin" size={14} /> Guardando tu tiempo…
              </>
            ) : pending ? (
              <>
                <Clock3 size={14} /> Tiempo pendiente de guardar
              </>
            ) : lastSaved ? (
              <>
                <Check size={14} /> {formatTime(effectiveTime(lastSaved))} guardado en privado
              </>
            ) : (
              <>
                <ShieldCheck size={14} /> Tus tiempos se guardan en privado
              </>
            )}
          </span>
          {lastSaved && !busy && (
            <div className="row wrap last-solve-actions">
              <button
                className="text-button"
                onClick={() => {
                  setDeleting(false);
                  setSelected(lastSaved);
                }}
              >
                <Pencil size={14} /> Editar último tiempo
              </button>
              <button
                className="text-button danger-text"
                onClick={() => {
                  setDeleting(true);
                  setSelected(lastSaved);
                }}
              >
                <Trash2 size={14} /> Borrar último tiempo
              </button>
              <button className="text-button" onClick={() => onPublish(lastSaved, 'single')}>
                <Upload size={14} /> Publicar este single
              </button>
            </div>
          )}
        </div>
      </section>
      <ScramblePreview
        event={event}
        alg={!loading && scramble?.event === event ? scramble.alg : null}
        disabled={busy}
      />
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {pending && !saving && (
        <div className="info-box row between">
          <span>
            Tienes un intento pendiente:{' '}
            <strong>
              <SolveTime solve={pending} />
            </strong>
            . Guárdalo antes de continuar.
          </span>
          <button className="button secondary small-button" onClick={() => void persist(pending)}>
            Reintentar guardado
          </button>
        </div>
      )}
      <div className="stat-grid">
        <Stat
          label="MEJOR SINGLE"
          value={formatTime(stats.best)}
          icon={<Trophy size={17} />}
          accent
        />
        <Stat
          label="AO5 ACTUAL"
          value={formatTime(stats.ao5)}
          hint={
            stats.count < 5
              ? `${stats.count}/5 resoluciones`
              : stats.ao5 === null
                ? 'Hay un hueco por completar'
                : 'Sin el mejor ni el peor'
          }
        />
        <Stat label="MEJOR AO5" value={formatTime(stats.bestAo5)} icon={<Sparkles size={17} />} />
        <Stat
          label="RESOLUCIONES"
          value={String(stats.count)}
          hint={`Con tu ${EVENTS[event].name}`}
        />
      </div>
      <div className="training-bottom">
        <section className="panel">
          <div className="panel-title">
            <h2>Tu progreso</h2>
            <span className="help">Últimas 30 · {EVENTS[event].name}</span>
          </div>
          <ProgressChart solves={eventSolves} />
        </section>
        <section className="panel recent-panel">
          <div className="panel-title">
            <h2>Últimos tiempos</h2>
            <button className="text-button" onClick={onHistory}>
              Ver todos <ArrowRight size={14} />
            </button>
          </div>
          {eventSolves.length ? (
            <div className="recent-list">
              {recentSolves.map((solve) => (
                <div key={solve.id} className="row between">
                  <span className="muted">#{solve.number}</span>
                  <button
                    className="time-button"
                    onClick={() => {
                      setDeleting(false);
                      setSelected(solve);
                    }}
                  >
                    <SolveTime solve={solve} />
                  </button>
                  <span className="help">
                    {new Date(solve.createdAt).toLocaleTimeString('es', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Todo empieza con un intento">Tu primera resolución aparecerá aquí.</Empty>
          )}
        </section>
      </div>
      {selected && (
        <SolveEditor
          solve={selected}
          initialDeleting={deleting}
          hasAo5={
            consecutiveWindow(
              eventSolves,
              eventSolves.findIndex((s) => s.id === selected.id),
            ).length === 5
          }
          onClose={() => setSelected(null)}
          onSave={async (timeCs, penalty, note) => {
            const updated = await api<Solve>(`/solves/${selected.id}`, 'PATCH', {
              timeCs,
              penalty,
              note,
            });
            if (lastSaved?.id === selected.id) setLastSaved(updated);
            await onSaved();
            setSelected(null);
          }}
          onDelete={async () => {
            await api(`/solves/${selected.id}`, 'DELETE', {});
            await onSaved();
            if (lastSaved?.id === selected.id) {
              setLastSaved(null);
              timer.reset();
              setScramble({
                id: selected.scrambleId,
                event: selected.event,
                alg: selected.scramble,
                createdAt: selected.createdAt,
              });
            }
            setSelected(null);
          }}
          onPublish={(kind) => {
            setSelected(null);
            onPublish(selected, kind);
          }}
        />
      )}
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`stat-card ${accent ? 'accent' : ''}`}>
      <div className="row between">
        <span className="section-label">{label}</span>
        {icon}
      </div>
      <strong className="mono">{value}</strong>
      {hint && <span className="help">{hint}</span>}
    </div>
  );
}
