import { useId, useState } from 'react';
import { ArrowUpRight, ChevronDown, TrendingDown } from 'lucide-react';
import { WCA_EVENTS, WCA_EVENT_IDS, WCA_ROUNDS, formatWcaRoundResult } from '../shared/wca.js';
import { officialProgress, progressValue } from '../shared/wca-progress.js';
import type { Competition } from './types';

type Result = { value: number; round: string; format?: string | null };
type Point = {
  id: string;
  name: string;
  date: string;
  single: Result | null;
  average: Result | null;
};
const eventName = (event: string) => WCA_EVENTS[event as keyof typeof WCA_EVENTS] ?? event;
const roundName = (round: string) => WCA_ROUNDS[round as keyof typeof WCA_ROUNDS]?.name ?? 'Ronda';
const dateLabel = (date: string, year = true) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    ...(year ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  });
const formatLabel = (format?: string | null) =>
  format === 'a' ? 'ao5' : format === 'm' ? 'mo3' : 'Media';

export function WcaProgress({ competitions }: { competitions: Competition[] }) {
  const events = WCA_EVENT_IDS.filter((id) =>
    competitions.some((c) => c.results?.some((r) => r.event === id)),
  );
  const [chosenEvent, setEvent] = useState('333');
  const event = events.includes(chosenEvent) ? chosenEvent : events[0];
  const [chosenPoint, setPoint] = useState('');
  const points: Point[] = event ? officialProgress(competitions, event) : [];
  const selected = points.find((point) => point.id === chosenPoint) ?? points.at(-1);
  const formats = points.flatMap((point) => (point.average ? [point.average.format] : []));
  const averageLabel =
    formats.length && formats.every((format) => format === 'a')
      ? 'ao5 oficial'
      : formats.length && formats.every((format) => format === 'm')
        ? 'mo3 oficial'
        : 'Media oficial';
  const legacy = competitions.some((competition) => competition.results == null);
  return (
    <section className="panel official-progress" aria-labelledby="wca-progress-title">
      <div className="official-progress-heading">
        <div>
          <h2 id="wca-progress-title" className="row">
            <TrendingDown size={20} /> Mi progreso oficial
          </h2>
          <p className="help">El mejor single y la mejor media oficial de cada competición.</p>
        </div>
        {!!events.length && (
          <label className="official-progress-filter">
            Prueba
            <select
              aria-label="Prueba de las gráficas oficiales"
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setPoint('');
              }}
            >
              {events.map((id) => (
                <option value={id} key={id}>
                  {eventName(id)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {legacy && (
        <p className="info-box">
          Los resultados pendientes se cargarán en la próxima actualización automática de WCA.
        </p>
      )}
      {!points.length ? (
        <p className="help">
          Todavía no hay resultados oficiales con fecha para dibujar la evolución.
        </p>
      ) : (
        <>
          {event === '333mbf' ? (
            <p className="info-box">
              Multiciego combina cubos resueltos, fallos y tiempo. Sus puntuaciones oficiales se
              muestran en la tabla.
            </p>
          ) : (
            <>
              <div className="official-progress-charts">
                <ProgressChart
                  event={event}
                  points={points}
                  metric="single"
                  title="Single oficial"
                  selected={selected?.id}
                  onSelect={setPoint}
                />
                <ProgressChart
                  event={event}
                  points={points}
                  metric="average"
                  title={averageLabel}
                  selected={selected?.id}
                  onSelect={setPoint}
                />
              </div>
              <p className="help official-progress-hint">
                Menos {event === '333fm' ? 'movimientos' : 'tiempo'}, mejor. Toca un punto para ver
                su competición y ronda.{' '}
                {points.length === 1
                  ? 'La evolución aparecerá al añadir más competiciones.'
                  : 'Los huecos indican resultados sin marca válida.'}
              </p>
            </>
          )}
          {selected && (
            <article className="official-progress-detail" aria-live="polite">
              <div className="row between wrap">
                <div>
                  <time dateTime={selected.date} className="section-label">
                    {dateLabel(selected.date)}
                  </time>
                  <h3>{selected.name}</h3>
                </div>
                <a
                  className="text-button"
                  href={`https://www.worldcubeassociation.org/competitions/${selected.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver resultados en WCA <ArrowUpRight size={14} />
                </a>
              </div>
              <div className="official-progress-marks">
                <ResultDetail event={event} result={selected.single} />
                <ResultDetail event={event} result={selected.average} average />
              </div>
            </article>
          )}
          <details className="official-progress-history">
            <summary>
              Ver todos los resultados oficiales <ChevronDown size={14} />
            </summary>
            <div className="official-progress-table-wrap">
              <table aria-label="Historial de progreso oficial">
                <thead>
                  <tr>
                    <th scope="col">Competición</th>
                    <th scope="col">Single</th>
                    <th scope="col">Media</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.id}>
                      <th scope="row">
                        <time dateTime={point.date}>{dateLabel(point.date)}</time>
                        <span>{point.name}</span>
                      </th>
                      <td>
                        <span className="mono">
                          {formatWcaRoundResult(event, point.single?.value)}
                        </span>
                        {point.single && <small>{roundName(point.single.round)}</small>}
                      </td>
                      <td>
                        <span className="mono">
                          {formatWcaRoundResult(event, point.average?.value, true)}
                        </span>
                        {point.average && (
                          <small>
                            {formatLabel(point.average.format)} · {roundName(point.average.round)}
                          </small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="help official-progress-footnote">
            Fuente: resultados oficiales WCA. El single y la media pueden proceder de rondas
            distintas. Se usa la fecha de inicio de cada competición; los ao5 y mo3 se toman tal
            como los publica la WCA.
          </p>
        </>
      )}
    </section>
  );
}

function ResultDetail({
  event,
  result,
  average = false,
}: {
  event: string;
  result: Result | null;
  average?: boolean;
}) {
  return (
    <div>
      <span className="help">
        {average ? `${formatLabel(result?.format)} oficial` : 'Single oficial'}
      </span>
      <strong className="mono">{formatWcaRoundResult(event, result?.value, average)}</strong>
      <span className="help">{result ? roundName(result.round) : 'Sin resultado publicado'}</span>
    </div>
  );
}

function ProgressChart({
  event,
  points,
  metric,
  title,
  selected,
  onSelect,
}: {
  event: string;
  points: Point[];
  metric: 'single' | 'average';
  title: string;
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const id = useId();
  const values = points.map((point) =>
    progressValue(event, point[metric]?.value, metric === 'average'),
  );
  const valid = values.filter((value): value is number => value !== null);
  const low = Math.min(...valid),
    high = Math.max(...valid);
  const padding = Math.max((high - low) * 0.15, high * 0.04, 0.1);
  const min = Math.max(0, low - padding),
    max = high + padding;
  const left = 50,
    right = 382,
    top = 25,
    bottom = 194;
  const dates = points.map((point) => Date.parse(`${point.date}T12:00:00Z`));
  const start = dates[0],
    end = dates.at(-1)!;
  const x = (index: number) =>
    start === end
      ? (left + right) / 2
      : left + ((dates[index] - start) / (end - start)) * (right - left);
  const y = (value: number) => bottom - ((value - min) / (max - min)) * (bottom - top);
  const segments: string[][] = [];
  values.forEach((value, index) => {
    if (value === null) {
      segments.push([]);
      return;
    }
    if (!segments.length) segments.push([]);
    segments.at(-1)!.push(`${x(index)},${y(value)}`);
  });
  const ticks = [
    ...new Map(
      [0, Math.floor((points.length - 1) / 2), points.length - 1].map((index) => [
        dates[index],
        index,
      ]),
    ).values(),
  ];
  return (
    <div className={`official-progress-chart ${metric}`}>
      <h3 id={id}>{title}</h3>
      {valid.length ? (
        <svg
          viewBox="0 0 400 238"
          role="group"
          aria-label={`Evolución ${metric === 'single' ? 'del single' : 'de la media'} oficial de ${eventName(event)}`}
        >
          <title>
            {title} · {eventName(event)}
          </title>
          <desc>
            Resultados por competición, desde {dateLabel(points[0].date)} hasta{' '}
            {dateLabel(points.at(-1)!.date)}. Menor puntuación es mejor.
          </desc>
          {[0, 1, 2, 3].map((tick) => {
            const value = min + ((max - min) * tick) / 3;
            return (
              <g key={tick} className="official-progress-axis">
                <line x1={left} x2={right} y1={y(value)} y2={y(value)} />
                <text x={left - 9} y={y(value) + 4} textAnchor="end">
                  {value.toLocaleString('es', { maximumFractionDigits: 2 })}
                </text>
              </g>
            );
          })}
          <text x={left} y={11} className="official-progress-unit">
            {event === '333fm' ? 'movimientos' : 'segundos'}
          </text>
          {ticks.map((index) => (
            <text
              className="official-progress-axis"
              key={index}
              x={x(index)}
              y={222}
              textAnchor={
                ticks.length === 1
                  ? 'middle'
                  : index === 0
                    ? 'start'
                    : index === points.length - 1
                      ? 'end'
                      : 'middle'
              }
            >
              {dateLabel(points[index].date, false)}
            </text>
          ))}
          {segments
            .filter((segment) => segment.length > 1)
            .map((segment, index) => (
              <polyline key={index} className="official-progress-line" points={segment.join(' ')} />
            ))}
          {values.map((value, index) => {
            if (value === null) return null;
            const point = points[index],
              result = point[metric]!;
            const label = `${point.name}, ${metric === 'single' ? 'single' : 'media'} ${formatWcaRoundResult(event, result.value, metric === 'average')} · ${roundName(result.round)}`;
            return (
              <g
                key={point.id}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={point.id === selected}
                data-competition={point.id}
                data-value={result.value}
                className={`official-progress-point ${point.id === selected ? 'selected' : ''}`}
                onClick={() => onSelect(point.id)}
                onFocus={() => onSelect(point.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(point.id);
                  }
                }}
              >
                <title>
                  {label} · {dateLabel(point.date)}
                </title>
                <circle cx={x(index)} cy={y(value)} r={18} className="official-progress-hit" />
                <circle cx={x(index)} cy={y(value)} r={5} className="official-progress-dot" />
              </g>
            );
          })}
        </svg>
      ) : (
        <p className="help official-progress-no-values">
          Todavía no hay marcas válidas para esta gráfica. Los DNF, DNS y resultados ausentes se
          conservan en el historial oficial.
        </p>
      )}
    </div>
  );
}
