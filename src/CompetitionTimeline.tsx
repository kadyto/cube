import { useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronDown, MapPin, Trophy } from 'lucide-react';
import {
  WCA_EVENTS,
  WCA_EVENT_IDS,
  WCA_ROUNDS,
  formatWcaRoundResult,
  isWcaPodium,
} from '../shared/wca.js';
import type { Competition, WcaRound } from './types';

const eventName = (event: string) => WCA_EVENTS[event as keyof typeof WCA_EVENTS] ?? event;
const roundName = (round: string) => WCA_ROUNDS[round as keyof typeof WCA_ROUNDS]?.name ?? 'Ronda';
const PAGE_SIZE = 3;

export function CompetitionTimeline({
  competitions,
  authenticated,
  onSettings,
}: {
  competitions: Competition[];
  authenticated: boolean;
  onSettings: () => void;
}) {
  const [event, setEvent] = useState('all'),
    [visible, setVisible] = useState(PAGE_SIZE);
  const ordered = [...competitions].sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
  const events = WCA_EVENT_IDS.filter((id) =>
    ordered.some((c) => c.results?.some((result) => result.event === id)),
  );
  const filtered =
    event === 'all'
      ? ordered
      : ordered.filter((c) => c.results?.some((result) => result.event === event));
  const legacy = competitions.some((c) => c.results == null);
  return (
    <section className="panel competition-timeline" aria-labelledby="competition-timeline-title">
      <div className="timeline-heading">
        <div>
          <h2 id="competition-timeline-title">
            <CalendarDays size={19} /> Mi recorrido en competición
          </h2>
          <p className="help">Puestos en cada ronda y resultados oficiales WCA.</p>
        </div>
        {!!events.length && (
          <label className="timeline-filter">
            <span>Prueba</span>
            <select
              aria-label="Filtrar competiciones por prueba"
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setVisible(PAGE_SIZE);
              }}
            >
              <option value="all">Todas</option>
              {events.map((id) => (
                <option key={id} value={id}>
                  {eventName(id)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {legacy && (
        <p className="info-box timeline-notice">
          {authenticated
            ? 'Los puestos pendientes se cargarán automáticamente. Puedes adelantarlo desde Ajustes.'
            : 'Los puestos de estas competiciones se actualizarán automáticamente.'}
          {authenticated && (
            <button className="text-button" onClick={onSettings}>
              Ir a Ajustes <ArrowUpRight size={13} />
            </button>
          )}
        </p>
      )}
      <ol className="timeline-list">
        {filtered.slice(0, visible).map((competition) => {
          const results =
            competition.results?.filter((result) => event === 'all' || result.event === event) ??
            [];
          return (
            <li key={competition.id} className="timeline-item">
              <span className="timeline-dot" aria-hidden="true" />
              <div className="timeline-date">
                {competition.date && (
                  <time dateTime={competition.date}>
                    {new Date(`${competition.date}T12:00:00`).toLocaleDateString('es', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                )}
              </div>
              <article className="timeline-card">
                <h3>
                  <a
                    href={`https://www.worldcubeassociation.org/competitions/${competition.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {competition.name}
                    <ArrowUpRight size={14} />
                  </a>
                </h3>
                {competition.city && (
                  <p className="timeline-city">
                    <MapPin size={12} />
                    {competition.city}
                  </p>
                )}
                {results.length ? (
                  <div className="timeline-events">
                    {results.map((result) => {
                      const latest = result.rounds.at(-1);
                      if (!latest) return null;
                      return (
                        <div className="timeline-event" key={result.event}>
                          <div className="timeline-event-heading">
                            <strong>{eventName(result.event)}</strong>
                            <span
                              className={
                                isWcaPodium(latest) ? 'position-pill podium' : 'position-pill'
                              }
                            >
                              {isWcaPodium(latest) && <Trophy size={13} />}
                              {latest.position ? `${latest.position}.º` : 'Sin puesto'}
                              <span>· {roundName(latest.round)}</span>
                            </span>
                          </div>
                          <RoundTimes event={result.event} round={latest} />
                          {result.rounds.length > 1 && (
                            <details className="timeline-rounds">
                              <summary>
                                Ver las {result.rounds.length} rondas <ChevronDown size={13} />
                              </summary>
                              <ul>
                                {result.rounds.map((round, i) => (
                                  <li key={`${round.round}-${i}`}>
                                    <div className="row between">
                                      <span>{roundName(round.round)}</span>
                                      <strong>
                                        {round.position ? `Puesto ${round.position}` : 'Sin puesto'}
                                      </strong>
                                    </div>
                                    <RoundTimes event={result.event} round={round} />
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="help">
                    {competition.results == null
                      ? 'Puestos pendientes de importar.'
                      : 'No hay rondas disponibles para las pruebas de este perfil.'}
                  </p>
                )}
              </article>
            </li>
          );
        })}
      </ol>
      {filtered.length > visible && (
        <button
          className="button secondary small-button timeline-more"
          onClick={() => setVisible((count) => count + PAGE_SIZE)}
        >
          Ver más competiciones ({filtered.length - visible}) <ChevronDown size={14} />
        </button>
      )}
      <p className="help timeline-footnote">
        Cada puesto corresponde a su ronda. Los trofeos indican podios en finales.
      </p>
    </section>
  );
}

function RoundTimes({ event, round }: { event: string; round: WcaRound }) {
  return (
    <p className="timeline-times">
      <span>
        Single <strong className="mono">{formatWcaRoundResult(event, round.best)}</strong>
      </span>
      <span>
        Media <strong className="mono">{formatWcaRoundResult(event, round.average, true)}</strong>
      </span>
    </p>
  );
}
