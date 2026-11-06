import { useEffect, useState } from 'react';
import { ChevronDown, Plus, Trash2, Trophy, Upload } from 'lucide-react';
import { EVENTS, EVENT_IDS, formatTime, parseTime } from '../shared/domain.js';
import { api, errorMessage } from './api';
import { Modal, SourceBadge } from './components';
import { subLabel } from './TrophyCard';
import type { EventId, Goal, Solve } from './types';

export function GoalsPanel({
  solves,
  onPublicChanged,
}: {
  solves: Solve[];
  onPublicChanged: () => Promise<void>;
}) {
  const [goals, setGoals] = useState<Goal[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [event, setEvent] = useState<EventId>('333'),
    [kind, setKind] = useState('single'),
    [source, setSource] = useState('all'),
    [target, setTarget] = useState('25');
  const [action, setAction] = useState<{
    goal: Goal;
    kind: 'publish' | 'withdraw' | 'delete';
  } | null>(null);
  const load = async () => setGoals(await api<Goal[]>('/goals'));
  useEffect(() => {
    let current = true;
    api<Goal[]>('/goals')
      .then((value) => {
        if (current) setGoals(value);
      })
      .catch((e) => {
        if (current) setError(errorMessage(e));
      });
    return () => {
      current = false;
    };
  }, [solves]);
  const act = async (run: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await run();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <details className="panel goals-panel">
        <summary>
          <span className="row">
            <Trophy size={20} /> Mis objetivos y trofeos
          </span>
          <span className="help">
            {goals.filter((goal) => goal.achieved).length}/{goals.length} conseguidos{' '}
            <ChevronDown size={14} />
          </span>
        </summary>
        <p className="help">
          Un sub-25 exige menos de 25,00 s. Single y ao5 son objetivos distintos. Se cuentan tus
          tiempos privados ya guardados, con +2 y DNF; puedes elegir qué cronómetro cuenta.
        </p>
        <div className="goal-grid">
          {goals.map((goal) => (
            <article className={`goal-card ${goal.achieved ? 'achieved' : ''}`} key={goal.id}>
              <div className="goal-cup">
                <Trophy size={28} aria-hidden="true" />
              </div>
              <div>
                <strong className="goal-target">{subLabel(goal.targetCs)}</strong>
                <p>
                  {EVENTS[goal.event].name} · {goal.kind === 'single' ? 'Single' : 'ao5'}
                </p>
              </div>
              <span className="help">
                {goal.source === 'all'
                  ? 'Cualquier cronómetro'
                  : goal.source === 'manual'
                    ? 'Sólo tiempos a mano'
                    : 'Sólo cronómetro web'}
              </span>
              <strong className="goal-status">
                {goal.achieved ? 'Trofeo conseguido' : 'Objetivo pendiente'}
              </strong>
              <p className="help">
                Mejor marca: <b className="mono">{formatTime(goal.best?.value)}</b>
              </p>
              {goal.best && <SourceBadge source={goal.best.measurementSource} />}
              <div className="row wrap goal-actions">
                {goal.publicationId ? (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => setAction({ goal, kind: 'withdraw' })}
                  >
                    Retirar trofeo público
                  </button>
                ) : (
                  goal.achieved && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setAction({ goal, kind: 'publish' })}
                    >
                      <Upload size={13} /> Publicar trofeo
                    </button>
                  )
                )}
                <button
                  className="text-button"
                  aria-label={`Eliminar objetivo ${subLabel(goal.targetCs)} ${goal.kind}`}
                  disabled={busy}
                  onClick={() => setAction({ goal, kind: 'delete' })}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
        <form
          className="goal-form"
          onSubmit={(e) => {
            e.preventDefault();
            const targetCs = parseTime(target);
            if (!targetCs) {
              setError('Escribe un objetivo válido, por ejemplo 25 o 12,50.');
              return;
            }
            void act(async () => {
              await api('/goals', 'POST', { event, kind, source, targetCs });
            });
          }}
        >
          <label>
            Puzzle del objetivo
            <select value={event} onChange={(e) => setEvent(e.target.value as EventId)}>
              {EVENT_IDS.map((id) => (
                <option key={id} value={id}>
                  {EVENTS[id as EventId].name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo de objetivo
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="single">Single</option>
              <option value="ao5">ao5</option>
            </select>
          </label>
          <label>
            Objetivo sub… (segundos)
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              inputMode="decimal"
              required
            />
          </label>
          <label>
            Contar tiempos
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">Cualquier cronómetro</option>
              <option value="manual">Sólo introducidos a mano</option>
              <option value="timer">Sólo cronómetro web</option>
            </select>
          </label>
          <button className="button secondary small-button" disabled={busy}>
            <Plus size={15} /> Añadir objetivo
          </button>
        </form>
        <p className="help">
          Los trofeos son privados hasta que elijas publicarlos. Al editar o borrar tiempos se
          recalculan los objetivos; los trofeos ya publicados conservan su copia hasta que los
          retires.
        </p>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
      </details>
      {action && (
        <Modal
          title={
            action.kind === 'publish'
              ? 'Compartir este trofeo'
              : action.kind === 'withdraw'
                ? 'Retirar este trofeo'
                : 'Eliminar este objetivo'
          }
          onClose={() => {
            if (!busy) setAction(null);
          }}
        >
          <div className="result-hero">
            <Trophy size={36} />
            <strong>{subLabel(action.goal.targetCs)}</strong>
          </div>
          <p>
            {EVENTS[action.goal.event].name} · {action.goal.kind === 'single' ? 'Single' : 'ao5'} ·{' '}
            {formatTime(action.goal.best?.value)}
          </p>
          {action.goal.best && <SourceBadge source={action.goal.best.measurementSource} />}
          <p className="help">
            {action.kind === 'publish'
              ? 'Se compartirán el objetivo, la marca, su fecha y el origen del tiempo. Los intentos y notas privados no se publican.'
              : action.kind === 'withdraw'
                ? 'El trofeo dejará de verse en la página pública. Tu objetivo y tus tiempos se conservan.'
                : 'Se eliminará este objetivo y se retirará su trofeo público si lo habías compartido. Tus tiempos se conservan.'}
          </p>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="button secondary" disabled={busy} onClick={() => setAction(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  if (action.kind === 'publish')
                    await api(`/goals/${action.goal.id}/publish`, 'POST', {});
                  else if (action.kind === 'withdraw')
                    await api(`/goal-publications/${action.goal.publicationId}`, 'DELETE', {});
                  else await api(`/goals/${action.goal.id}`, 'DELETE', {});
                  await onPublicChanged();
                  setAction(null);
                })
              }
            >
              {action.kind === 'publish'
                ? 'Publicar este trofeo'
                : action.kind === 'withdraw'
                  ? 'Retirar trofeo'
                  : 'Eliminar objetivo'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
