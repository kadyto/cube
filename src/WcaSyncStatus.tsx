import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from './api';
import type { WcaSyncStatus as SyncStatus } from './types';

export function WcaSyncStatus({ id, importedAt }: { id: string; importedAt?: string }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const next = await api<SyncStatus>('/wca/status');
        if (mounted) setStatus(next);
      } catch {
        /* Keep the last status if the connection is temporarily unavailable. */
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60000);
    window.addEventListener('focus', load);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, [id, importedAt]);
  const current = status?.id === id && status.enabled ? status : null;
  const date = (value: string) =>
    new Date(value).toLocaleString('es', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <div className="info-box wca-sync-info">
      <RefreshCw size={18} className={current?.refreshing ? 'spin' : ''} />
      <div>
        <strong>Actualización automática cada hora</strong>
        <p>
          El servidor revisa las marcas, competiciones y puestos aunque cierres la web. Se
          incorporan cuando WCA publica sus resultados.
        </p>
        {current?.lastSuccessAt && <p>Última actualización: {date(current.lastSuccessAt)}.</p>}
        {current?.refreshing ? (
          <p>Actualizando los datos de WCA…</p>
        ) : (
          current?.nextRefreshAt && <p>Próxima comprobación: {date(current.nextRefreshAt)}.</p>
        )}
        {current?.error && (
          <p className="danger-text">
            {current.error} Reintentaremos automáticamente; se conservan los últimos datos
            disponibles.
          </p>
        )}
        <p>Puedes usar «Consultar WCA» para actualizar ahora.</p>
      </div>
    </div>
  );
}
