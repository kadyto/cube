import { useState } from 'react';
import {
  Check,
  Download,
  ExternalLink,
  Globe2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { api, errorMessage } from './api';
import type { Profile } from './types';
import { WcaSyncStatus } from './WcaSyncStatus';

export function Settings({ profile, onSaved }: { profile: Profile; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(profile),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('');
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setMessage('');
  };
  const saveProfile = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api<Profile>('/profile', 'PUT', form);
      setForm(result);
      await onSaved();
      setMessage('Tu rincón se ha actualizado.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const importProfile = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/profile', 'PUT', form);
      const result = await api<Profile>('/wca/import', 'POST', { wcaId: form.wcaId });
      setForm(result);
      await onSaved();
      setMessage('Perfil WCA importado. Tú eliges qué mostrar en público.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A TU MANERA</p>
          <h1>
            Tu espacio, tus reglas<span className="green-dot">.</span>
          </h1>
          <p className="muted">Decide qué cuentas y qué te guardas para ti.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-title">
            <h2 className="row">
              <Globe2 size={20} /> Tu rincón público
            </h2>
          </div>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void saveProfile();
            }}
          >
            <label>
              Nombre o apodo
              <input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                maxLength={100}
                required
              />
              <span className="help">Será el título de tu página. Puede ser un apodo.</span>
            </label>
            <label>
              Unas palabras sobre ti
              <textarea
                value={form.bio}
                onChange={(e) => update('bio', e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </label>
            <fieldset className="form-section">
              <legend>
                Vincular perfil WCA <span className="optional">opcional</span>
              </legend>
              <p className="help">
                Importa tu nombre, marcas oficiales y competiciones desde la información pública de
                la WCA. No necesitas dar tu contraseña de WCA. Vincular un ID no verifica su
                titularidad.
              </p>
              <label>
                ID WCA
                <input
                  value={form.wcaId}
                  onChange={(e) => update('wcaId', e.target.value.toUpperCase())}
                  placeholder="2015BORR01"
                  pattern="[0-9]{4}[A-Z]{4}[0-9]{2}"
                  autoCapitalize="characters"
                  maxLength={10}
                />
              </label>
              <div className="row wrap">
                <button
                  className="button secondary small-button"
                  type="button"
                  onClick={() => void importProfile()}
                  disabled={busy || !/^\d{4}[A-Z]{4}\d{2}$/.test(form.wcaId)}
                >
                  {busy ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />}{' '}
                  Consultar WCA
                </button>
                {form.wcaId && (
                  <a
                    className="text-button"
                    href={`https://www.worldcubeassociation.org/persons/${encodeURIComponent(form.wcaId)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver en WCA <ExternalLink size={13} />
                  </a>
                )}
              </div>
              {form.wcaId && <WcaSyncStatus id={form.wcaId} importedAt={form.wca?.importedAt} />}
              {form.wca?.id === form.wcaId && (
                <div className="wca-preview">
                  <span className="section-label">PERFIL IMPORTADO</span>
                  <strong>{form.wca?.name}</strong>
                  <span className="help">
                    {form.wca?.competitions.length} competiciones · actualizado el{' '}
                    {new Date(form.wca!.importedAt).toLocaleDateString('es')}
                  </span>
                  {form.wca?.personalRecords && (
                    <span className="help">
                      Marcas oficiales en {form.wca.personalRecords.length} pruebas.
                    </span>
                  )}
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => update('name', form.wca!.name)}
                  >
                    Usar este nombre en mi rincón
                  </button>
                </div>
              )}
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.showWca}
                  onChange={(e) => update('showWca', e.target.checked)}
                />
                <span>Mostrar mi perfil WCA, mi nombre y mis marcas oficiales en público</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.showCompetitions}
                  disabled={!form.showWca}
                  onChange={(e) => update('showCompetitions', e.target.checked)}
                />
                <span>Mostrar también mis competiciones y puestos por ronda</span>
              </label>
            </fieldset>
            <div className="info-box">
              <ShieldCheck size={18} />
              <span>
                Los tiempos de entrenamiento nunca se publican desde aquí. Elige cada single o ao5
                desde tu historial.
              </span>
            </div>
            <button className="button primary" disabled={busy}>
              <Save size={16} /> Guardar mi rincón
            </button>
          </form>
        </section>
        <div className="settings-side">
          <section className="panel">
            <h2 className="row">
              <KeyRound size={20} /> Tu contraseña
            </h2>
            <p className="help">
              Elige una que te resulte fácil recordar. Sin requisitos de longitud ni complejidad.
            </p>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                setMessage('');
                if (password !== confirm) {
                  setError('Las contraseñas nuevas no coinciden.');
                  return;
                }
                setBusy(true);
                try {
                  await api('/password', 'PUT', { currentPassword, password });
                  setCurrentPassword('');
                  setPassword('');
                  setConfirm('');
                  setMessage('Contraseña actualizada. Las otras sesiones se han cerrado.');
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Contraseña actual
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </label>
              <label>
                Nueva contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </label>
              <label>
                Repite la nueva contraseña
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </label>
              <button className="button secondary" disabled={busy}>
                <LockKeyhole size={15} /> Cambiar contraseña
              </button>
            </form>
          </section>
          <section className="panel">
            <h2 className="row">
              <Download size={20} /> Tu historial, contigo
            </h2>
            <p className="help">
              Descarga tiempos, mezclas, notas, perfil y publicaciones en JSON. No incluye
              contraseñas ni sesiones.
            </p>
            <a className="button secondary" href="/api/export" download>
              <Download size={16} /> Exportar mis datos
            </a>
            <p className="help">
              Para restaurar toda la instalación, conserva una copia del volumen de datos. El JSON
              es una exportación para consulta; esta versión no lo importa.
            </p>
          </section>
        </div>
      </div>
      {error && (
        <div className="error-box settings-message" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="success-box settings-message" role="status">
          <Check size={17} />
          {message}
        </div>
      )}
    </>
  );
}
