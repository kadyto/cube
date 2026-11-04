import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  Globe2,
  Medal,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import { EVENTS, EVENT_IDS, formatTime } from '../shared/domain.js';
import { WCA_EVENTS, formatWcaResult } from '../shared/wca.js';
import { JB_CUBE_FACES } from '../shared/jb-cube.js';
import { Empty, Modal, PublicationCard, PuzzleIcon } from './components';
import { CompetitionTimeline } from './CompetitionTimeline';
import type { EventId, PublicData, Publication } from './types';

export function PublicPage({
  data,
  authenticated,
  onTrain,
  onSettings,
  onOpen,
  onRemove,
}: {
  data: PublicData;
  authenticated: boolean;
  onTrain: () => void;
  onSettings: () => void;
  onOpen: (p: Publication) => void;
  onRemove: (id: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<EventId | 'all'>('all'),
    [removing, setRemoving] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const profile = data.profile,
    publications = data.publications.filter((p) => filter === 'all' || p.event === filter);
  const singles = data.publications.filter(
    (p) => p.kind === 'single' && typeof p.result === 'number',
  );
  const best = (event: EventId) => {
    const times = singles.filter((p) => p.event === event).map((p) => p.result as number);
    return times.length ? Math.min(...times) : null;
  };
  return (
    <>
      <section className="profile-hero">
        <div className="profile-copy">
          <span className="hero-kicker">
            <span className="live-dot" /> MI MUNDO, EN SEIS CARAS
          </span>
          <h1>{profile.name}</h1>
          <p>{profile.bio}</p>
          <div className="row wrap">
            {profile.wcaId && (
              <a
                className="hero-link"
                href={`https://www.worldcubeassociation.org/persons/${profile.wcaId}`}
                target="_blank"
                rel="noreferrer"
              >
                WCA · {profile.wcaId}
                <ArrowUpRight size={15} />
              </a>
            )}
            <button className="hero-button" onClick={onTrain}>
              {authenticated ? 'Seguir entrenando' : 'Entrar a entrenar'}
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="big-cube" data-case="Jb" title="PLL Jb · amarillo arriba, verde delante">
            <div className="cube-face top">
              {JB_CUBE_FACES.U.map((color, i) => (
                <i key={i} data-color={color} />
              ))}
            </div>
            <div className="cube-face front">
              {JB_CUBE_FACES.F.map((color, i) => (
                <i key={i} data-color={color} />
              ))}
            </div>
            <div className="cube-face right">
              {JB_CUBE_FACES.R.map((color, i) => (
                <i key={i} data-color={color} />
              ))}
            </div>
          </div>
          <span className="art-spark spark-one">✳</span>
          <span className="art-spark spark-two">+</span>
          <span className="art-caption">UNA MEZCLA, UN RETO.</span>
        </div>
      </section>
      <div className="public-layout">
        <div className="public-main">
          {!!profile.wca?.competitions.length && (
            <CompetitionTimeline
              competitions={profile.wca.competitions}
              authenticated={authenticated}
              onSettings={onSettings}
            />
          )}
          <div className="panel-title section-title">
            <div>
              <h2>
                En mi vitrina <Sparkles size={18} />
              </h2>
              <p className="muted">Momentos que merecen quedarse.</p>
            </div>
            <span className="count-pill">
              {data.publications.length}{' '}
              {data.publications.length === 1 ? 'publicación' : 'publicaciones'}
            </span>
          </div>
          <div className="filter-tabs" role="group" aria-label="Filtrar publicaciones">
            <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>
              Todos
            </button>
            {(EVENT_IDS as EventId[]).map((event) => (
              <button
                className={filter === event ? 'selected' : ''}
                key={event}
                onClick={() => setFilter(event)}
              >
                {EVENTS[event].name}
              </button>
            ))}
          </div>
          {publications.length ? (
            <div className="publication-grid">
              {publications.map((p) => (
                <div className="publication-wrap" key={p.id}>
                  <PublicationCard publication={p} onOpen={() => onOpen(p)} />
                  {authenticated && (
                    <button
                      className="text-button remove-publication"
                      onClick={() => setRemoving(p.id)}
                    >
                      <Trash2 size={13} /> Retirar de la vitrina
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <section className="panel">
              <Empty
                title={
                  filter === 'all'
                    ? 'Los grandes momentos están por llegar'
                    : 'Todavía no hay publicaciones de este puzzle'
                }
                icon={<Trophy size={30} />}
              >
                {authenticated
                  ? 'Entrena a tu ritmo y publica los singles o ao5 que tú elijas. Aquí nunca se comparte nada automáticamente.'
                  : 'Este espacio se llenará con los tiempos que su protagonista decida compartir.'}
              </Empty>
              {authenticated && (
                <div className="empty-action">
                  <button className="button primary" onClick={onTrain}>
                    Vamos a entrenar <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
        <aside className="public-aside">
          {profile.wcaId && (
            <section className="panel wca-records-panel">
              <h2 className="row">
                <Globe2 size={18} /> Mi perfil WCA
              </h2>
              {profile.wca && <p className="wca-name">{profile.wca.name}</p>}
              <a
                className="text-button"
                href={`https://www.worldcubeassociation.org/persons/${profile.wcaId}`}
                target="_blank"
                rel="noreferrer"
              >
                {profile.wcaId}
                <ExternalLink size={14} />
              </a>
              {profile.wca && (
                <>
                  <h3 className="wca-records-title">Marcas oficiales WCA</h3>
                  {profile.wca.personalRecords?.length ? (
                    <table className="wca-records-table" aria-label="Marcas oficiales WCA">
                      <thead>
                        <tr>
                          <th scope="col">Prueba</th>
                          <th scope="col">Single</th>
                          <th scope="col">Media</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.wca.personalRecords.map((record) => (
                          <tr key={record.event}>
                            <th scope="row">
                              {WCA_EVENTS[record.event as keyof typeof WCA_EVENTS] ?? record.event}
                            </th>
                            <td className="mono">{formatWcaResult(record.event, record.single)}</td>
                            <td className="mono">
                              {formatWcaResult(record.event, record.average, true)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="help">
                      {profile.wca.personalRecords == null
                        ? authenticated
                          ? 'Consulta de nuevo el perfil en Ajustes para importar tus marcas WCA.'
                          : 'Las marcas oficiales todavía no se han importado.'
                        : 'Este perfil todavía no tiene marcas oficiales WCA.'}
                    </p>
                  )}
                  <p className="help">
                    Mejores resultados en competición · actualizado el{' '}
                    {new Date(profile.wca.importedAt).toLocaleDateString('es')}.
                  </p>
                </>
              )}
            </section>
          )}
          <section className="panel">
            <h2 className="row">
              <Medal size={19} /> Marcas compartidas
            </h2>
            <p className="help">Solo cuentan los singles publicados.</p>
            <div className="records-list">
              {(EVENT_IDS as EventId[]).map((event) => (
                <div className="row between" key={event}>
                  <span className="row">
                    <PuzzleIcon event={event} size={26} />
                    {EVENTS[event].name}
                  </span>
                  <strong className="mono">{formatTime(best(event))}</strong>
                </div>
              ))}
            </div>
          </section>
          {authenticated && (
            <button className="text-button" onClick={onSettings}>
              Personalizar mi rincón <ArrowRight size={15} />
            </button>
          )}
        </aside>
      </div>
      {removing && (
        <Modal
          title="¿Retirar esta publicación?"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <p>
            Dejará de verse en la página pública. Tus tiempos privados seguirán en el historial.
          </p>
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setRemoving(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onRemove(removing);
                  setRemoving(null);
                } catch {
                  setError('No se pudo retirar. Vuelve a intentarlo.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Retirar publicación
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
