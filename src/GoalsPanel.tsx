import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Palette,
  Plus,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';
import { EVENTS, EVENT_IDS, formatTime, parseTime } from '../shared/domain.js';
import { api, errorMessage } from './api';
import { Modal, SourceBadge } from './components';
import { MedalLabel, subLabel, TrophyColorPicker } from './TrophyCard';
import type { EventId, Goal, Medal, Solve } from './types';

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
  const [medal, setMedal] = useState<Medal>('gold'),
    [editedMedal, setEditedMedal] = useState<Medal>('gold');
  const [action, setAction] = useState<{
    goal: Goal;
    kind: 'publish' | 'withdraw' | 'delete' | 'color';
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
        <p className="help">
          Bronce, plata y oro son colores que eliges tú. Cada tarjeta indica por separado si el
          objetivo está pendiente o conseguido; el color no cambia la marca necesaria.
        </p>
        <div className="goal-grid">
          {goals.map((goal) => (
            <article
              className={`goal-card medal-${goal.medal} ${goal.achieved ? 'achieved' : ''}`}
              key={goal.id}
            >
              <div className="goal-cup">
                <Trophy size={28} aria-hidden="true" />
              </div>
              <MedalLabel medal={goal.medal} />
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
              <strong className="goal-status row">
                {goal.achieved ? (
                  <CheckCircle2 size={14} aria-hidden="true" />
                ) : (
                  <Circle size={14} aria-hidden="true" />
                )}
                {goal.achieved ? 'Trofeo conseguido' : 'Objetivo pendiente'}
              </strong>
              <p className="help">
                Mejor marca: <b className="mono">{formatTime(goal.best?.value)}</b>
              </p>
              {goal.best && <SourceBadge source={goal.best.measurementSource} />}
              <div className="row wrap goal-actions">
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setEditedMedal(goal.medal);
                    setAction({ goal, kind: 'color' });
                  }}
                >
                  <Palette size={13} /> Cambiar color
                </button>
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
              await api('/goals', 'POST', { event, kind, source, targetCs, medal });
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
          <TrophyColorPicker value={medal} onChange={setMedal} disabled={busy} />
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
                : action.kind === 'color'
                  ? 'Cambiar color del trofeo'
                  : 'Eliminar este objetivo'
          }
          onClose={() => {
            if (!busy) setAction(null);
          }}
        >
          <div
            className={`result-hero trophy-preview medal-${action.kind === 'color' ? editedMedal : action.goal.medal}`}
          >
            <Trophy size={36} />
            <strong>{subLabel(action.goal.targetCs)}</strong>
          </div>
          <MedalLabel medal={action.kind === 'color' ? editedMedal : action.goal.medal} />
          <p>
            {EVENTS[action.goal.event].name} · {action.goal.kind === 'single' ? 'Single' : 'ao5'} ·{' '}
            {formatTime(action.goal.best?.value)}
          </p>
          {action.goal.best && <SourceBadge source={action.goal.best.measurementSource} />}
          {action.kind === 'color' && (
            <TrophyColorPicker value={editedMedal} onChange={setEditedMedal} disabled={busy} />
          )}
          <p className="help">
            {action.kind === 'publish'
              ? 'Se compartirán el objetivo, el color del trofeo, la marca, su fecha y el origen del tiempo. Los intentos y notas privados no se publican.'
              : action.kind === 'withdraw'
                ? 'El trofeo dejará de verse en la página pública. Tu objetivo y tus tiempos se conservan.'
                : action.kind === 'color'
                  ? action.goal.publicationId
                    ? 'El color también cambiará en el trofeo que ya has publicado. Su marca y su fecha se conservan.'
                    : 'El color es una elección tuya y no cambia los tiempos necesarios. Este objetivo seguirá en privado.'
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
                  else if (action.kind === 'color')
                    await api(`/goals/${action.goal.id}`, 'PATCH', { medal: editedMedal });
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
                  : action.kind === 'color'
                    ? 'Guardar color'
                    : 'Eliminar objetivo'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
