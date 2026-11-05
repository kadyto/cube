import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Expand, LoaderCircle } from 'lucide-react';
import { EVENTS } from '../shared/domain.js';
import { Modal } from './components';
import type { EventId } from './types';

const orientation = (event: EventId) =>
  event === 'pyram'
    ? 'Verde delante y amarillo en la base. Incluye los giros de las puntas.'
    : 'Empieza con blanco arriba y verde delante.';

const ScramblePicture = memo(function ScramblePicture({
  event,
  alg,
}: {
  event: EventId;
  alg: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const fit = useRef<(() => void) | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useLayoutEffect(() => {
    if (state === 'ready') fit.current?.();
  }, [state]);
  useEffect(() => {
    let current = true;
    const element = host.current!;
    // Isolate SVG definition IDs so the preview and enlarged drawing cannot interfere.
    const shadow = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
    const draw = async () => {
      try {
        const { createScrambleDiagram, fitScrambleDiagram } = await import('./scrambleDiagram');
        const svg = await createScrambleDiagram(event, alg);
        if (!current) return;
        shadow.replaceChildren(svg);
        fit.current = () => fitScrambleDiagram(svg);
        setState('ready');
      } catch {
        if (current) {
          shadow.replaceChildren();
          setState('error');
        }
      }
    };
    void draw();
    return () => {
      current = false;
      fit.current = null;
      shadow.replaceChildren();
    };
  }, [event, alg]);
  return (
    <div className="scramble-picture" data-event={event} data-alg={alg} data-state={state}>
      <div
        ref={host}
        className="scramble-picture-canvas"
        role="img"
        aria-label={`Estado de ${EVENTS[event].name} después de aplicar la mezcla: ${alg}`}
        hidden={state !== 'ready'}
      />
      {state === 'loading' && (
        <p className="help row" role="status">
          <LoaderCircle size={16} className="spin" aria-hidden="true" /> Dibujando la mezcla…
        </p>
      )}
      {state === 'error' && (
        <p className="help" role="status">
          No se pudo dibujar esta mezcla. Puedes seguir usando su secuencia y el cronómetro.
        </p>
      )}
    </div>
  );
});

export const ScramblePreview = memo(function ScramblePreview({
  event,
  alg,
  disabled,
}: {
  event: EventId;
  alg: string | null;
  disabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <section className="panel scramble-preview" aria-label="Dibujo de la mezcla">
        <div className="scramble-preview-drawing">
          {alg ? (
            <ScramblePicture key={`${event}:${alg}`} event={event} alg={alg} />
          ) : (
            <p className="help">El dibujo aparecerá con tu mezcla.</p>
          )}
        </div>
        <div className="scramble-preview-copy">
          <h2>Así queda tu mezcla</h2>
          <p className="help">{orientation(event)}</p>
          <button
            type="button"
            className="text-button"
            onClick={() => setExpanded(true)}
            disabled={!alg || disabled}
          >
            <Expand size={14} aria-hidden="true" /> Ampliar dibujo
          </button>
        </div>
      </section>
      {expanded && alg && (
        <Modal title={`Mezcla de ${EVENTS[event].name}`} onClose={() => setExpanded(false)} wide>
          <div className="scramble-preview-expanded">
            <ScramblePicture key={`${event}:${alg}`} event={event} alg={alg} />
          </div>
          <p className="help">{orientation(event)}</p>
          <p className="alg small">{alg}</p>
        </Modal>
      )}
    </>
  );
});
