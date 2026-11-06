import { useEffect, useRef, useState } from 'react';
import { Flag, Keyboard, RefreshCw, Timer, Trophy, Upload } from 'lucide-react';
import { effectiveTime, formatTime, parseTime } from '../shared/domain.js';
import { api, errorMessage } from './api';
import { Modal, SolveTime, SourceBadge } from './components';
import { EventTabs, ScramblePanel, ScreenAwakeStatus, TimerFace } from './TrainingWidgets';
import { ScramblePreview } from './ScramblePreview';
import { SolveEditor } from './SolveEditor';
import { useTimer } from './useTimer';
import { useScreenWakeLock } from './useScreenWakeLock';
import type { EventId, Penalty, Solve, TrainingRound } from './types';

const KEY = 'cube-round-pending-v1';
type Pending = {
  roundId: string;
  event: EventId;
  scrambleId: string;
  timeCs: number;
  penalty: Penalty;
  source: 'manual' | 'timer';
};
function restored(): Pending | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return value?.roundId && value.scrambleId && Number.isInteger(value.timeCs) ? value : null;
  } catch {
    return null;
  }
}
export function CompetitionMode({
  onSaved,
  onPublicChanged,
  onPublish,
  onBusy,
}: {
  solves: Solve[];
  onSaved: () => Promise<void>;
  onPublicChanged: () => Promise<void>;
  onPublish: (solve: Solve, kind: 'single' | 'ao5') => void;
  onBusy: (value: boolean) => void;
}) {
  const [event, setEvent] = useState<EventId>(() => restored()?.event ?? '333');
  const [round, setRound] = useState<TrainingRound | null>(null),
    [rounds, setRounds] = useState<TrainingRound[]>([]);
  const [pending, setPending] = useState<Pending | null>(restored);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const [mode, setMode] = useState<'manual' | 'timer'>('manual'),
    [inspection, setInspection] = useState(true);
  const [manual, setManual] = useState(''),
    [penalty, setPenalty] = useState<Penalty>('none');
  const [selected, setSelected] = useState<Solve | null>(null),
    [confirm, setConfirm] = useState<'publish' | 'abandon' | 'discard' | null>(null),
    [title, setTitle] = useState('');
  const savingRef = useRef(false),
    screen = useScreenWakeLock();
  const next = round && !round.cancelledAt ? round.slots.find((slot) => !slot.solve) : undefined;
  const timer = useTimer({
    disabled: loading || saving || !!pending || !next || mode !== 'timer',
    inspection,
    onFinish: (timeCs, resultPenalty) => {
      if (round && next)
        void persist({
          roundId: round.id,
          event,
          scrambleId: next.scramble.id,
          timeCs,
          penalty: resultPenalty,
          source: 'timer',
        });
    },
  });
  const busy = timer.active || saving || !!pending || loading;
  useEffect(() => {
    onBusy(busy);
  }, [busy, onBusy]);
  function remember(value: TrainingRound) {
    setRound(value);
    setRounds((previous) => [value, ...previous.filter((item) => item.id !== value.id)]);
    try {
      localStorage.setItem(`cube-round-${value.event}`, value.id);
    } catch {
      /* Server state remains available. */
    }
  }
  async function refresh(id = round?.id) {
    if (!id) return;
    const value = await api<TrainingRound>(`/rounds/${id}`);
    remember(value);
    return value;
  }
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setRound(null);
    api<TrainingRound[]>(`/rounds?event=${event}`)
      .then((values) => {
        if (!current) return;
        setRounds(values);
        let cached: string | null = null;
        try {
          cached = localStorage.getItem(`cube-round-${event}`);
        } catch {
          /* Use the newest server round. */
        }
        const pendingId = restored()?.roundId;
        const chosen =
          values.find((item) => item.id === pendingId) ??
          values.find((item) => item.id === cached) ??
          values.find((item) => !item.cancelledAt && item.completed < 5) ??
          values[0];
        if (chosen) remember(chosen);
      })
      .catch((e) => {
        if (current) setError(errorMessage(e));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [event]);
  async function persist(attempt: Pending) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    setPending(attempt);
    try {
      localStorage.setItem(KEY, JSON.stringify(attempt));
    } catch {
      /* Retry remains available in memory. */
    }
    try {
      await api('/solves', 'POST', {
        scrambleId: attempt.scrambleId,
        timeCs: attempt.timeCs,
        penalty: attempt.penalty,
        source: attempt.source,
      });
      await refresh(attempt.roundId);
      setPending(null);
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* An old retry is idempotent. */
      }
      setManual('');
      setPenalty('none');
      timer.reset();
      await onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  async function act(run: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await run();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  const start = () =>
    act(async () => {
      remember(await api<TrainingRound>('/rounds', 'POST', { event }));
      setManual('');
      setPenalty('none');
      timer.reset();
    });
  const discarded =
    round?.completed === 5
      ? [...round.slots].sort(
          (a, b) => effectiveTime(a.solve!) - effectiveTime(b.solve!) || a.slot - b.slot,
        )
      : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CINCO INTENTOS, UNA MEDIA</p>
          <h1>
            Modo competición<span className="green-dot">.</span>
          </h1>
          <p className="muted">Una ronda de cinco resoluciones con sus propias mezclas y ao5.</p>
        </div>
        <span className="private-pill">
          <Flag size={15} /> Ronda privada
        </span>
      </div>
      <ScreenAwakeStatus screen={screen} />
      <EventTabs
        event={event}
        disabled={busy}
        onChange={(value) => {
          timer.reset();
          setEvent(value);
        }}
      />
      <section className="panel round-panel" aria-label="Ronda de cinco">
        <div className="row between wrap">
          <h2 className="row">
            <Flag size={19} /> {round ? `${round.completed}/5 resoluciones` : 'Tu próxima ronda'}
          </h2>
          <div className="row wrap">
            {rounds.length > 1 && (
              <label className="help">
                Revisar una ronda
                <select
                  aria-label="Elegir ronda"
                  disabled={busy}
                  value={round?.id ?? ''}
                  onChange={(e) =>
                    void act(async () => {
                      await refresh(e.target.value);
                      timer.reset();
                    })
                  }
                >
                  {rounds.map((item) => (
                    <option key={item.id} value={item.id}>
                      {new Date(item.createdAt).toLocaleString('es')} · {item.completed}/5
                      {item.cancelledAt ? ' · abandonada' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="text-button"
              disabled={busy || !round}
              onClick={() =>
                void act(async () => {
                  await refresh();
                  await onSaved();
                })
              }
            >
              <RefreshCw size={14} /> Actualizar ronda
            </button>
          </div>
        </div>
        <p className="help">
          Las cinco mezclas se preparan al empezar y se siguen en orden. Cada intento también queda
          en tu historial. Puedes pausar y retomar esta ronda; sólo se publica si tú lo eliges.
        </p>
        {round && (
          <div className="round-slots">
            {round.slots.map((slot) => (
              <div
                key={slot.slot}
                className={`round-slot ${slot.solve ? 'filled' : ''} ${slot.slot === next?.slot ? 'current' : ''}`}
              >
                <span className="section-label">INTENTO {slot.slot}</span>
                {slot.solve ? (
                  <>
                    <button
                      className="time-button"
                      onClick={() => setSelected(slot.solve)}
                      disabled={busy}
                    >
                      <SolveTime solve={slot.solve} />
                    </button>
                    <SourceBadge source={slot.solve.source} />
                    {round.completed === 5 &&
                      [discarded[0]?.slot, discarded[4]?.slot].includes(slot.slot) && (
                        <span className="help">Descartado en ao5</span>
                      )}
                  </>
                ) : (
                  <strong>—</strong>
                )}
              </div>
            ))}
          </div>
        )}
        {!round || round.cancelledAt || round.completed === 5 ? (
          <>
            {round?.completed === 5 && (
              <div className="round-result">
                <Trophy size={26} />
                <span>ao5 de esta ronda</span>
                <strong className="mono">{formatTime(round.average)}</strong>
              </div>
            )}
            {round?.cancelledAt && (
              <p className="help">
                Ronda abandonada. Los tiempos registrados siguen en el historial.
              </p>
            )}
            <div className="row wrap">
              <button className="button primary" disabled={busy} onClick={() => void start()}>
                <Flag size={15} /> {round ? 'Empezar otra ronda' : 'Empezar ronda de 5'}
              </button>
              {round?.completed === 5 && !round.cancelledAt && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setTitle('');
                    setConfirm('publish');
                  }}
                >
                  <Upload size={15} /> Publicar ao5 de esta ronda
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="row between">
            <strong>Ahora: intento {next?.slot} de 5</strong>
            <button className="text-button" disabled={busy} onClick={() => setConfirm('abandon')}>
              Abandonar ronda
            </button>
          </div>
        )}
      </section>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {pending && (
        <div className="info-box round-pending">
          <p>Intento pendiente de confirmar. Reintentar no duplica el tiempo.</p>
          <button
            className="button secondary small-button"
            disabled={saving}
            onClick={() => void persist(pending)}
          >
            Reintentar guardado de ronda
          </button>
          <button className="text-button" disabled={saving} onClick={() => setConfirm('discard')}>
            Descartar pendiente local
          </button>
        </div>
      )}
      {next && (
        <>
          <ScramblePanel
            event={event}
            alg={next.scramble.alg}
            loading={loading}
            disabled
            onGenerate={() => {}}
          />
          <section className={`panel timer-panel ${timer.phase === 'running' ? 'is-running' : ''}`}>
            <div className="timer-toolbar">
              <div className="segmented" aria-label="Modo de registro de ronda">
                <button
                  className={mode === 'timer' ? 'active' : ''}
                  disabled={busy}
                  onClick={() => {
                    timer.reset();
                    setMode('timer');
                  }}
                >
                  <Timer size={15} /> Cronómetro web
                </button>
                <button
                  className={mode === 'manual' ? 'active' : ''}
                  disabled={busy}
                  onClick={() => {
                    timer.reset();
                    setMode('manual');
                  }}
                >
                  <Keyboard size={15} /> A mano
                </button>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={inspection}
                  disabled={busy || mode === 'manual'}
                  onChange={(e) => setInspection(e.target.checked)}
                />
                <span>Inspección 15 s</span>
              </label>
            </div>
            {mode === 'timer' ? (
              <TimerFace timer={timer} disabled={loading || saving || !!pending} />
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
                  if (round)
                    void persist({
                      roundId: round.id,
                      event,
                      scrambleId: next.scramble.id,
                      timeCs,
                      penalty,
                      source: 'manual',
                    });
                }}
              >
                <label htmlFor="round-time">Tiempo del intento {next.slot}</label>
                <div className="manual-entry">
                  <input
                    id="round-time"
                    className="mono"
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={saving || !!pending}
                  />
                  <span>s</span>
                </div>
                <p className="help">
                  Introduce el tiempo de tu cronómetro externo. Controla allí la inspección y añade
                  la penalización que corresponda.
                </p>
                <div className="row manual-actions">
                  <div className="segmented" aria-label="Penalización de ronda">
                    {(['none', '+2', 'DNF'] as Penalty[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={penalty === value ? 'active' : ''}
                        disabled={saving || !!pending}
                        onClick={() => setPenalty(value)}
                      >
                        {value === 'none' ? 'Sin penalización' : value}
                      </button>
                    ))}
                  </div>
                  <button className="button primary" disabled={saving || !!pending}>
                    Guardar intento {next.slot}
                  </button>
                </div>
              </form>
            )}
            <div className="timer-footer">
              <span>Privado · {round?.completed}/5 guardados · sin publicación automática</span>
            </div>
          </section>
          <ScramblePreview event={event} alg={next.scramble.alg} disabled={busy} />
        </>
      )}
      {selected && (
        <SolveEditor
          solve={selected}
          hasAo5={false}
          onClose={() => setSelected(null)}
          onSave={async (timeCs, penalty, note) => {
            await api(`/solves/${selected.id}`, 'PATCH', { timeCs, penalty, note });
            await refresh();
            await onSaved();
            setSelected(null);
          }}
          onDelete={async () => {
            await api(`/solves/${selected.id}`, 'DELETE', {});
            await refresh();
            await onSaved();
            setSelected(null);
            timer.reset();
          }}
          onPublish={() => {
            setSelected(null);
            onPublish(selected, 'single');
          }}
        />
      )}
      {confirm && (
        <Modal
          title={
            confirm === 'publish'
              ? 'Compartir el ao5 de esta ronda'
              : confirm === 'abandon'
                ? 'Abandonar esta ronda'
                : 'Descartar el intento pendiente local'
          }
          onClose={() => {
            if (!saving) setConfirm(null);
          }}
        >
          {confirm === 'publish' ? (
            <>
              <div className="result-hero mono">{formatTime(round?.average)}</div>
              <div className="publish-preview">
                {round?.slots.map((slot) => (
                  <div key={slot.slot} className="row between">
                    <span>Intento {slot.slot}</span>
                    {slot.solve && (
                      <>
                        <SolveTime solve={slot.solve} />
                        <SourceBadge source={slot.solve.source} />
                      </>
                    )}
                  </div>
                ))}
              </div>
              <label>
                Título de la ronda
                <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <p className="help">
                Se publicarán estos cinco resultados, sus mezclas, fechas y origen. Las notas
                privadas no se comparten.
              </p>
            </>
          ) : (
            <p>
              {confirm === 'abandon'
                ? 'Se cerrará esta ronda. Sus tiempos ya guardados se conservan en el historial.'
                : 'Sólo se quitará el pendiente de este navegador. Revisa la ronda: el servidor podría haber recibido ya el tiempo.'}
            </p>
          )}
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="button secondary" disabled={saving} onClick={() => setConfirm(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={saving}
              onClick={() =>
                void act(async () => {
                  if (confirm === 'publish' && round) {
                    await api('/publications', 'POST', { kind: 'ao5', roundId: round.id, title });
                    await onPublicChanged();
                  } else if (confirm === 'abandon' && round)
                    remember(await api<TrainingRound>(`/rounds/${round.id}/abandon`, 'POST', {}));
                  else if (confirm === 'discard') {
                    localStorage.removeItem(KEY);
                    setPending(null);
                    await refresh();
                    await onSaved();
                  }
                  setConfirm(null);
                  timer.reset();
                })
              }
            >
              {confirm === 'publish'
                ? 'Publicar esta ronda'
                : confirm === 'abandon'
                  ? 'Sí, abandonar'
                  : 'Descartar pendiente local'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
