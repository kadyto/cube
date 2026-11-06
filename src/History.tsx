import { useState } from 'react';
import { Download, ListFilter, Pencil, Search, Trash2 } from 'lucide-react';
import {
  EVENTS,
  EVENT_IDS,
  averageOfFive,
  consecutiveWindow,
  nextAttemptNumber,
  formatTime,
  statistics,
} from '../shared/domain.js';
import { api, errorMessage } from './api';
import { Empty, PuzzleIcon, SolveTime, SourceBadge } from './components';
import { SolveEditor } from './SolveEditor';
import type { EventId, Solve } from './types';

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
  const [source, setSource] = useState('all');
  const [selected, setSelected] = useState<Solve | null>(null),
    [error, setError] = useState(''),
    [deleting, setDeleting] = useState(false);
  const eventSolves = solves.filter((s) => s.event === event).sort((a, b) => a.number - b.number),
    stats = statistics(
      source === 'all' ? eventSolves : eventSolves.filter((solve) => solve.source === source),
    );
  const filtered = eventSolves
    .map((solve, index) => ({ solve, index }))
    .reverse()
    .filter(({ solve }) => source === 'all' || solve.source === source)
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
      <label className="source-filter">
        Filtrar por cronómetro
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">Todos los tiempos</option>
          <option value="manual">Introducidos a mano</option>
          <option value="timer">Cronómetro web</option>
        </select>
      </label>
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
      <p className="help next-attempt">
        Próximo intento: <strong>#{nextAttemptNumber(eventSolves)}</strong>. Si hay huecos, se
        completa primero el de menor número.
      </p>
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
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ solve, index }) => (
                  <tr key={solve.id}>
                    <td className="muted">{solve.number}</td>
                    <td>
                      <button
                        className="time-button"
                        onClick={() => {
                          setDeleting(false);
                          setSelected(solve);
                        }}
                      >
                        <SolveTime solve={solve} />
                      </button>
                      <SourceBadge source={solve.source} />
                      {solve.roundId && (
                        <span className="round-badge">Ronda de 5 · {solve.roundSlot}/5</span>
                      )}
                      <div className="solve-row-actions">
                        <button
                          className="text-button"
                          aria-label={`Editar intento ${solve.number}`}
                          onClick={() => {
                            setDeleting(false);
                            setSelected(solve);
                          }}
                        >
                          <Pencil size={13} /> Editar
                        </button>
                        <button
                          className="text-button danger-text"
                          aria-label={`Borrar intento ${solve.number}`}
                          onClick={() => {
                            setDeleting(true);
                            setSelected(solve);
                          }}
                        >
                          <Trash2 size={13} /> Borrar
                        </button>
                      </div>
                    </td>
                    <td className="mono muted">
                      {formatTime(
                        averageOfFive(
                          source === 'all' ||
                            consecutiveWindow(eventSolves, index).every(
                              (item: Solve) => item.source === source,
                            )
                            ? consecutiveWindow(eventSolves, index)
                            : [],
                        ),
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
          hasAo5={
            consecutiveWindow(
              eventSolves,
              eventSolves.findIndex((s) => s.id === selected.id),
            ).length === 5
          }
          initialDeleting={deleting}
          onClose={() => setSelected(null)}
          onSave={async (timeCs, penalty, note) => {
            try {
              await api(`/solves/${selected.id}`, 'PATCH', { timeCs, penalty, note });
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
