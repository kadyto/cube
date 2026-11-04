import { useState } from 'react';
import { Download, ListFilter, MoreHorizontal, Search, Trash2, Upload } from 'lucide-react';
import { EVENTS, EVENT_IDS, averageOfFive, formatTime, statistics } from '../shared/domain.js';
import { api, errorMessage } from './api';
import { Empty, Modal, PuzzleIcon, SolveTime } from './components';
import type { EventId, Penalty, Solve } from './types';

export function History({
  solves,
  onSaved,
  onPublish,
}: {
  solves: Solve[];
  onSaved: () => Promise<void>;
  onPublish: (solve: Solve, kind: 'single' | 'ao5') => void;
}) {
  const [event, setEvent] = useState<EventId>('333'),
    [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Solve | null>(null),
    [error, setError] = useState('');
  const eventSolves = solves.filter((s) => s.event === event),
    stats = statistics(eventSolves);
  const filtered = eventSolves
    .map((solve, index) => ({ solve, index }))
    .reverse()
    .filter(({ solve }) =>
      `${solve.scramble} ${solve.note} ${formatTime(solve.timeCs)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CADA INTENTO CUENTA</p>
          <h1>
            Tu historial<span className="green-dot">.</span>
          </h1>
          <p className="muted">Un lugar para ver cuánto has avanzado.</p>
        </div>
        <a className="button secondary" href="/api/export" download>
          <Download size={16} /> Exportar JSON
        </a>
      </div>
      <div className="history-toolbar">
        <div className="segmented">
          {(EVENT_IDS as EventId[]).map((id) => (
            <button className={event === id ? 'active' : ''} key={id} onClick={() => setEvent(id)}>
              <PuzzleIcon size={20} event={id} />
              {EVENTS[id].name}
            </button>
          ))}
        </div>
        <label className="search-input">
          <Search size={16} />
          <input
            placeholder="Buscar tiempo, nota o mezcla"
            aria-label="Buscar en el historial"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="history-overview">
        <span>
          <strong>{stats.count}</strong> resoluciones
        </span>
        <span>
          Mejor single <strong className="mono">{formatTime(stats.best)}</strong>
        </span>
        <span>
          Mejor ao5 <strong className="mono">{formatTime(stats.bestAo5)}</strong>
        </span>
      </div>
      <section className="panel history-panel">
        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tiempo</th>
                  <th>ao5</th>
                  <th>Fecha</th>
                  <th>Mezcla</th>
                  <th>
                    <span className="sr-only">Opciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ solve, index }) => (
                  <tr key={solve.id}>
                    <td className="muted">{index + 1}</td>
                    <td>
                      <button className="time-button" onClick={() => setSelected(solve)}>
                        <SolveTime solve={solve} />
                      </button>
                    </td>
                    <td className="mono muted">
                      {formatTime(
                        averageOfFive(eventSolves.slice(Math.max(0, index - 4), index + 1)),
                      )}
                    </td>
                    <td className="date-cell">
                      {new Date(solve.createdAt).toLocaleDateString('es', {
                        day: '2-digit',
                        month: 'short',
                      })}
                      <small>
                        {new Date(solve.createdAt).toLocaleTimeString('es', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </td>
                    <td>
                      <span className="table-alg">{solve.scramble}</span>
                      {solve.note && <small className="note-preview">{solve.note}</small>}
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => setSelected(solve)}
                        aria-label={`Opciones del tiempo ${formatTime(solve.timeCs)}`}
                      >
                        <MoreHorizontal size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={search ? 'No hay coincidencias' : 'Tu historia está por empezar'}
            icon={<ListFilter size={28} />}
          >
            {search
              ? 'Prueba con otra búsqueda.'
              : 'Guarda tiempos con el cronómetro o introdúcelos a mano en Entrenamiento.'}
          </Empty>
        )}
      </section>
      <p className="help privacy-note">
        Todo este historial es privado. Solo se ve en tu rincón lo que publiques expresamente.
      </p>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {selected && (
        <SolveEditor
          solve={selected}
          hasAo5={eventSolves.findIndex((s) => s.id === selected.id) >= 4}
          onClose={() => setSelected(null)}
          onSave={async (penalty, note) => {
            try {
              await api(`/solves/${selected.id}`, 'PATCH', { penalty, note });
              await onSaved();
              setSelected(null);
            } catch (e) {
              setError(errorMessage(e));
              throw e;
            }
          }}
          onDelete={async () => {
            try {
              await api(`/solves/${selected.id}`, 'DELETE', {});
              await onSaved();
              setSelected(null);
            } catch (e) {
              setError(errorMessage(e));
              throw e;
            }
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

function SolveEditor({
  solve,
  hasAo5,
  onClose,
  onSave,
  onDelete,
  onPublish,
}: {
  solve: Solve;
  hasAo5: boolean;
  onClose: () => void;
  onSave: (penalty: Penalty, note: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onPublish: (kind: 'single' | 'ao5') => void;
}) {
  const [penalty, setPenalty] = useState(solve.penalty),
    [note, setNote] = useState(solve.note),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
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
  return (
    <Modal
      title={`${EVENTS[solve.event].name} · Tu resolución`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="result-hero">
        <SolveTime solve={{ ...solve, penalty }} />
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
          void act(() => onSave(penalty, note));
        }}
      >
        <fieldset>
          <legend>Penalización</legend>
          <div className="segmented">
            {(['none', '+2', 'DNF'] as Penalty[]).map((p) => (
              <button
                type="button"
                className={penalty === p ? 'active' : ''}
                onClick={() => setPenalty(p)}
                key={p}
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
            disabled={busy || penalty !== solve.penalty || note !== solve.note}
          >
            <Upload size={15} /> Publicar single
          </button>
          <button
            className="button secondary small-button"
            onClick={() => onPublish('ao5')}
            disabled={!hasAo5 || busy || penalty !== solve.penalty || note !== solve.note}
          >
            <Upload size={15} /> Publicar ao5
          </button>
        </div>
        {!hasAo5 && (
          <p className="help">
            El ao5 estará disponible a partir del quinto intento de este puzzle.
          </p>
        )}
      </div>
      <div className="form-section">
        {deleting ? (
          <div>
            <p>
              ¿Eliminar este intento del historial? Las publicaciones existentes se conservarán
              hasta que las retires.
            </p>
            <div className="row">
              <button
                className="button danger small-button"
                disabled={busy}
                onClick={() => void act(onDelete)}
              >
                Sí, eliminar
              </button>
              <button className="button secondary small-button" onClick={() => setDeleting(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button className="text-button danger-text" onClick={() => setDeleting(true)}>
            <Trash2 size={15} /> Eliminar intento
          </button>
        )}
      </div>
    </Modal>
  );
}
