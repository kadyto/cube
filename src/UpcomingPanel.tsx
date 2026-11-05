import { useEffect, useState } from 'react';
import { CalendarClock, RefreshCw } from 'lucide-react';
import { api, errorMessage } from './api';
import { UpcomingCompetitions, snapshotDate } from './UpcomingCompetitions';
import type { Profile, UpcomingStatus } from './types';

export function UpcomingPanel({ profile }: { profile: Profile }) {
  const [status, setStatus] = useState<UpcomingStatus | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const next = await api<UpcomingStatus>('/upcoming');
        if (mounted) setStatus(next);
      } catch {
        /* Retain the last snapshot during temporary connection failures. */
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30000);
    window.addEventListener('focus', load);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [profile.wcaId, profile.calculateForecasts, profile.showUpcoming]);
  const current = status?.id === profile.wcaId ? status : null;
  return (
    <section className="panel upcoming-settings">
      <h2 className="row">
        <CalendarClock size={20} /> Próximas competiciones
      </h2>
      <p className="help">
        Vista privada del ID guardado. Se revisa cada hora, aunque cierres la web. WCA permite
        consultar inscripciones aceptadas; las pendientes o en lista de espera no aparecen aquí.
      </p>
      <p className="help">
        {profile.showWca && profile.showUpcoming
          ? 'Visible en tu rincón público.'
          : 'Esta sección solo la ves tú.'}
      </p>
      <button
        className="button secondary small-button"
        type="button"
        disabled={busy || current?.refreshing || current?.forecast.refreshing}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            setStatus(await api<UpcomingStatus>('/upcoming/refresh', 'POST', {}));
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <RefreshCw
          size={14}
          className={busy || current?.refreshing || current?.forecast.refreshing ? 'spin' : ''}
        />{' '}
        Actualizar inscripciones
      </button>
      <p className="help">
        Este botón actualiza la lista. La comparación se calcula como máximo una vez cada 24 horas,
        incluso tras reinicios o errores.
      </p>
      {current?.forecast.enabled ? (
        <div className="info-box upcoming-cut-status" role="status">
          <div>
            <strong>Comparación diaria activada</strong>
            {current.forecast.refreshing ? (
              <p>Preparando el corte de marcas…</p>
            ) : current.forecast.lastAttemptAt ? (
              <p>
                Próximo corte disponible a partir de {snapshotDate(current.forecast.nextAllowedAt)}.
              </p>
            ) : (
              <p>El primer corte se preparará cuando haya una próxima inscripción pública.</p>
            )}
            {current.forecast.error && <p className="danger-text">{current.forecast.error}</p>}
          </div>
        </div>
      ) : (
        <p className="help">
          La comparación por marcas está desactivada. Puedes activarla en las opciones de WCA y
          guardar.
        </p>
      )}
      {(error || current?.error) && (
        <p className="help danger-text" role="alert">
          {error || current?.error} Se conservan los últimos datos disponibles.
        </p>
      )}
      {current && <UpcomingCompetitions data={current} embedded />}
    </section>
  );
}
