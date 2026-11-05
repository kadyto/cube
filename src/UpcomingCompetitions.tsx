import { CalendarClock, ExternalLink, MapPin } from 'lucide-react';
import { WCA_EVENTS, formatWcaResult } from '../shared/wca.js';
import type { UpcomingData } from './types';

export const snapshotDate = (value: string) =>
  new Date(value).toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const competitionDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
const eventName = (event: string) => WCA_EVENTS[event as keyof typeof WCA_EVENTS] ?? event;

export function UpcomingCompetitions({
  data,
  embedded = false,
}: {
  data: UpcomingData;
  embedded?: boolean;
}) {
  const hasEstimates = data.competitions.some(
    (competition) => competition.forecast?.estimates?.length,
  );
  return (
    <section
      className={embedded ? 'upcoming-preview' : 'panel upcoming-panel'}
      aria-label="Próximas competiciones"
    >
      {!embedded && (
        <div className="timeline-heading">
          <div>
            <h2>
              <CalendarClock size={19} /> Próximas competiciones
            </h2>
            <p className="help">Inscripciones aceptadas en WCA.</p>
          </div>
        </div>
      )}
      {!data.competitions.length && (
        <p className="help upcoming-empty">
          {data.fetchedAt
            ? 'No hay próximas competiciones con inscripción aceptada en la información pública de WCA.'
            : 'Las próximas inscripciones aún no están disponibles.'}
        </p>
      )}
      <ul className="upcoming-list">
        {data.competitions.map((competition) => (
          <li key={competition.id} className="upcoming-card">
            <time className="upcoming-date" dateTime={competition.date}>
              {competitionDate(competition.date)}
              {competition.endDate !== competition.date &&
                ` – ${competitionDate(competition.endDate)}`}
            </time>
            <h3>
              <a
                href={`https://www.worldcubeassociation.org/competitions/${competition.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {competition.name} <ExternalLink size={13} />
              </a>
            </h3>
            {competition.city && (
              <p className="help row">
                <MapPin size={13} /> {competition.city}
                {competition.country && ` · ${competition.country}`}
              </p>
            )}
            {!!competition.forecast?.estimates?.length && (
              <div className="forecast-list">
                <p className="section-label">REFERENCIA POR MARCAS</p>
                {competition.forecast.estimates.map((estimate) => (
                  <div className="forecast-event" key={estimate.event}>
                    <div className="forecast-result">
                      <strong>{eventName(estimate.event)}</strong>
                      {estimate.positionMin !== null && (
                        <span className="forecast-position">
                          {estimate.positionMin}.º
                          {estimate.positionMax !== estimate.positionMin &&
                            `–${estimate.positionMax}.º`}
                          <small> de {estimate.total}</small>
                        </span>
                      )}
                    </div>
                    {estimate.ownBest !== null && (
                      <p className="help">
                        Tu {estimate.basis === 'average' ? 'media' : 'single'} oficial:{' '}
                        <strong>
                          {formatWcaResult(
                            estimate.event,
                            estimate.ownBest,
                            estimate.basis === 'average',
                          )}
                        </strong>
                      </p>
                    )}
                    <p className="help">
                      {estimate.comparable} de {estimate.total} inscritos con marca comparable ·{' '}
                      {estimate.missing} sin referencia
                      {estimate.tied > 0 && ` · ${estimate.tied} con tu misma marca`}
                    </p>
                    {estimate.reason && <p className="help">{estimate.reason}</p>}
                  </div>
                ))}
              </div>
            )}
            {competition.forecast?.notice && <p className="help">{competition.forecast.notice}</p>}
            {competition.forecast?.calculatedAt && (
              <p className="help forecast-date">
                Corte de marcas: {snapshotDate(competition.forecast.calculatedAt)}.
              </p>
            )}
            {competition.forecast?.error && (
              <p className="help danger-text">{competition.forecast.error}</p>
            )}
          </li>
        ))}
      </ul>
      {hasEstimates && (
        <p className="help forecast-explanation">
          Compara mejores marcas oficiales de la lista pública, usando media o single según la
          primera ronda. Los empates comparten puesto; el intervalo contempla a quienes no tienen
          marca. No predice el resultado real.
        </p>
      )}
      {data.fetchedAt && (
        <p className="help upcoming-checked">
          Inscripciones consultadas: {snapshotDate(data.fetchedAt)}.
        </p>
      )}
    </section>
  );
}
