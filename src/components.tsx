import { useEffect, useRef, type ReactNode } from 'react';
import { X, ArrowUpRight, Triangle, Box, Keyboard, Timer } from 'lucide-react';
import { EVENTS, effectiveTime, formatTime } from '../shared/domain.js';
import type { EventId, Solve, Publication } from './types';
import { measurementSource, SOURCE_LABELS } from '../shared/training.js';

export function SourceBadge({ source }: { source?: string }) {
  const label = SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] ?? SOURCE_LABELS.unknown;
  return (
    <span
      className={`source-badge source-${source ?? 'unknown'}`}
      title={
        source === 'manual'
          ? 'Tiempo introducido a mano, por ejemplo desde un cronómetro externo.'
          : source === 'timer'
            ? 'Tiempo medido con el cronómetro de Cube.'
            : label
      }
    >
      {source === 'manual' ? (
        <Keyboard size={12} aria-hidden="true" />
      ) : source === 'timer' ? (
        <Timer size={12} aria-hidden="true" />
      ) : null}
      {label}
    </span>
  );
}

export function PuzzleIcon({ event = '333', size = 36 }: { event?: EventId; size?: number }) {
  if (event === 'pyram') return <Triangle size={size} strokeWidth={1.5} />;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="m24 4 18 10v20L24 44 6 34V14Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m6 14 18 10 18-10M24 24v20" stroke="currentColor" strokeWidth="1.6" />
      {event === '333' ? (
        <path
          d="m12 10.7 18 10v20M18 7.3l18 10v20M12 17.3v20l18-10M18 20.7v20l18-10M6 20.7l18 10 18-10M6 27.3l18 10 18-10"
          stroke="currentColor"
          strokeWidth="1.1"
        />
      ) : (
        <path
          d="m15 9 18 10v20M15 19v20l18-10M6 24l18 10 18-10"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      )}
    </svg>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    const element = ref.current;
    return () => {
      element?.close();
      const target =
        previouslyFocused?.isConnected &&
        previouslyFocused !== document.body &&
        !previouslyFocused.classList.contains('skip-link') &&
        !element?.contains(previouslyFocused)
          ? previouslyFocused
          : document.getElementById('main-content');
      target?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Empty({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <Box size={28} />}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function SolveTime({ solve }: { solve: Pick<Solve, 'timeCs' | 'penalty'> }) {
  return (
    <span className="mono">
      {formatTime(effectiveTime(solve))}
      {solve.penalty === '+2' && <small className="penalty-label"> +2</small>}
    </span>
  );
}

export function PublicationCard({
  publication,
  onOpen,
}: {
  publication: Publication;
  onOpen: () => void;
}) {
  return (
    <button className="publication-card" onClick={onOpen}>
      <div className="row between">
        <span className="puzzle-tag">
          <PuzzleIcon event={publication.event} size={19} />
          {EVENTS[publication.event].name}
        </span>
        <span className="badge">{publication.kind === 'single' ? 'Single' : 'Media de 5'}</span>
      </div>
      <div className="publication-time mono">
        {formatTime(publication.result)}
        <span>s</span>
      </div>
      <h3>
        {publication.title ||
          (publication.kind === 'single'
            ? 'Una resolución para recordar'
            : 'Cinco intentos, un logro')}
      </h3>
      <SourceBadge source={measurementSource(publication.solves)} />
      <div className="row between muted">
        <span>
          {new Date(publication.createdAt).toLocaleDateString('es', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
        <ArrowUpRight size={18} />
      </div>
    </button>
  );
}

export function PublicationDetails({
  publication,
  onClose,
}: {
  publication: Publication;
  onClose: () => void;
}) {
  return (
    <Modal
      title={
        publication.title ||
        `${EVENTS[publication.event].name} · ${publication.kind === 'single' ? 'Single' : 'ao5'}`
      }
      onClose={onClose}
      wide
    >
      <div className="result-hero mono">
        {formatTime(publication.result)}
        <small>s</small>
      </div>
      {publication.kind === 'ao5' && (
        <p className="help">
          Se descartan el mejor y el peor resultado. Se hace la media de los tres restantes. Un DNF
          se descarta; dos o más hacen que la media sea DNF.
        </p>
      )}
      <SourceBadge source={measurementSource(publication.solves)} />
      <div className="publication-solves">
        {publication.solves.map((solve, i) => (
          <div key={i} className="solve-detail">
            <div className="row between">
              <span className="muted">Resolución {i + 1}</span>
              <strong>
                <SolveTime solve={solve} />
              </strong>
            </div>
            <SourceBadge source={solve.source} />
            <p className="alg small">{solve.scramble}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function ProgressChart({ solves }: { solves: Solve[] }) {
  const recent = solves.slice(-30),
    valid = recent.map(effectiveTime).filter(Number.isFinite);
  if (valid.length < 2)
    return <div className="chart-empty">Tu evolución aparecerá con las primeras resoluciones.</div>;
  const min = Math.min(...valid),
    max = Math.max(...valid),
    range = Math.max(max - min, 100);
  const points = recent.map((s, i) =>
    Number.isFinite(effectiveTime(s))
      ? `${25 + (i / Math.max(recent.length - 1, 1)) * 650},${125 - ((effectiveTime(s) - min) / range) * 95}`
      : null,
  );
  const segments: string[][] = [[]];
  for (const point of points) {
    if (point) segments[segments.length - 1].push(point);
    else segments.push([]);
  }
  return (
    <div className="chart">
      <svg
        viewBox="0 0 700 155"
        role="img"
        aria-label={`Últimas ${recent.length} resoluciones. Mejor ${formatTime(min)} segundos; peor ${formatTime(max)} segundos. Los DNF se muestran como huecos.`}
      >
        <path d="M25 30H675M25 78H675M25 125H675" stroke="var(--line)" strokeDasharray="4 5" />
        {segments
          .filter((s) => s.length)
          .map((s, i) => (
            <polyline
              key={i}
              points={s.join(' ')}
              fill="none"
              stroke="var(--green)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          ))}
        {points.map(
          (point, i) =>
            point && (
              <circle
                key={i}
                cx={point.split(',')[0]}
                cy={point.split(',')[1]}
                r="4"
                fill="var(--green)"
              >
                <title>{formatTime(effectiveTime(recent[i]))} s</title>
              </circle>
            ),
        )}
      </svg>
      <div className="row between help">
        <span>Hace {recent.length} resoluciones</span>
        <span>Ahora</span>
      </div>
    </div>
  );
}
