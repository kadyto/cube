import { useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { EVENTS, parseTime } from '../shared/domain.js';
import { errorMessage } from './api';
import { Modal, SolveTime } from './components';
import type { Penalty, Solve } from './types';

export function SolveEditor({
  solve,
  hasAo5,
  onClose,
  onSave,
  onDelete,
  onPublish,
  initialDeleting = false,
}: {
  solve: Solve;
  hasAo5: boolean;
  onClose: () => void;
  onSave: (timeCs: number, penalty: Penalty, note: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onPublish: (kind: 'single' | 'ao5') => void;
  initialDeleting?: boolean;
}) {
  const [penalty, setPenalty] = useState(solve.penalty),
    [time, setTime] = useState((solve.timeCs / 100).toFixed(2)),
    [note, setNote] = useState(solve.note),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(initialDeleting),
    [error, setError] = useState('');
  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (deleting)
    return (
      <Modal
        title={`Borrar intento #${solve.number}`}
        onClose={() => {
          if (!busy) onClose();
        }}
      >
        <div className="result-hero">
          <SolveTime solve={solve} />
          <small>s</small>
        </div>
        <p>El siguiente tiempo de {EVENTS[solve.event].name} ocupará el primer hueco disponible.</p>
        <p className="help">
          Las publicaciones existentes se conservan hasta que las retires desde Mi rincón.
        </p>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              if (initialDeleting) onClose();
              else setDeleting(false);
            }}
          >
            Cancelar
          </button>
          <button className="button danger" disabled={busy} onClick={() => void act(onDelete)}>
            Sí, borrar
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal
      title={`${EVENTS[solve.event].name} · Intento #${solve.number}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="result-hero">
        <SolveTime solve={{ ...solve, timeCs: parseTime(time) ?? solve.timeCs, penalty }} />
        <small>s</small>
      </div>
      <p className="alg small boxed">{solve.scramble}</p>
      <p className="help">
        {new Date(solve.createdAt).toLocaleString('es')} ·{' '}
        {solve.source === 'timer' ? 'Cronómetro de Cube' : 'Introducido a mano'}
      </p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const timeCs = parseTime(time);
          if (!timeCs) {
            setError('Escribe un tiempo válido: 12.34, 12,34 o 1:02.45.');
            return;
          }
          void act(() => onSave(timeCs, penalty, note));
        }}
      >
        <label>
          Tiempo sin penalización
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            inputMode="decimal"
            required
            disabled={busy}
          />
          <span className="help">
            Segundos o minutos:segundos. La penalización +2 se añade aparte.
          </span>
        </label>
        <fieldset>
          <legend>Penalización</legend>
          <div className="segmented">
            {(['none', '+2', 'DNF'] as Penalty[]).map((p) => (
              <button
                type="button"
                className={penalty === p ? 'active' : ''}
                onClick={() => setPenalty(p)}
                key={p}
                disabled={busy}
              >
                {p === 'none' ? 'Sin penalización' : p}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          Nota privada
          <textarea
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ese F2L ha salido genial…"
            rows={2}
            disabled={busy}
          />
        </label>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <button className="button primary" disabled={busy}>
          Guardar cambios
        </button>
      </form>
      <div className="form-section">
        <p className="help">
          Para publicar un cambio, guárdalo primero. Las publicaciones anteriores conservan su
          resultado; puedes retirarlas en Mi rincón.
        </p>
        <div className="row wrap">
          <button
            className="button secondary small-button"
            onClick={() => onPublish('single')}
            disabled={
              busy ||
              parseTime(time) !== solve.timeCs ||
              penalty !== solve.penalty ||
              note !== solve.note
            }
          >
            <Upload size={15} /> Publicar single
          </button>
          <button
            className="button secondary small-button"
            onClick={() => onPublish('ao5')}
            disabled={
              !hasAo5 ||
              busy ||
              parseTime(time) !== solve.timeCs ||
              penalty !== solve.penalty ||
              note !== solve.note
            }
          >
            <Upload size={15} /> Publicar ao5
          </button>
        </div>
        {!hasAo5 && (
          <p className="help">
            El ao5 necesita cinco números consecutivos sin intentos pendientes.
          </p>
        )}
      </div>
      <div className="form-section">
        <button
          className="text-button danger-text"
          disabled={busy}
          onClick={() => setDeleting(true)}
        >
          <Trash2 size={15} /> Borrar intento
        </button>
      </div>
    </Modal>
  );
}
