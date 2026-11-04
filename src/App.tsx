import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Globe2,
  Heart,
  History as HistoryIcon,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  Settings2,
  ShieldCheck,
  Timer,
  Upload,
  X,
} from 'lucide-react';
import { EVENTS, averageOfFive, effectiveTime, formatTime } from '../shared/domain.js';
import { api, errorMessage } from './api';
import { Modal, PublicationDetails, PuzzleIcon, SolveTime } from './components';
import { Trainer } from './Trainer';
import { History } from './History';
import { PublicPage } from './PublicPage';
import { Settings } from './Settings';
import type { Profile, PublicData, Publication, Solve } from './types';

type View = 'public' | 'train' | 'history' | 'settings';
const paths: Record<View, string> = {
  public: '',
  train: 'entrenar',
  history: 'historial',
  settings: 'ajustes',
};
const currentView = (): View =>
  (Object.entries(paths).find(([, path]) => window.location.hash === `#/${path}`)?.[0] as View) ??
  'public';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [view, setView] = useState<View>(currentView),
    [loginFor, setLoginFor] = useState<View | null>(null);
  const [publicData, setPublicData] = useState<PublicData | null>(null),
    [solves, setSolves] = useState<Solve[]>([]),
    [profile, setProfile] = useState<Profile | null>(null);
  const [publication, setPublication] = useState<Publication | null>(null),
    [publish, setPublish] = useState<{ solve: Solve; kind: 'single' | 'ao5' } | null>(null);
  const refreshPublic = useCallback(async () => {
    setPublicData(await api<PublicData>('/public'));
  }, []);
  const refreshPrivate = useCallback(async () => {
    const [nextSolves, nextProfile] = await Promise.all([
      api<Solve[]>('/solves'),
      api<Profile>('/profile'),
    ]);
    setSolves(nextSolves);
    setProfile(nextProfile);
  }, []);
  const refresh = useCallback(async () => {
    await Promise.all([refreshPublic(), refreshPrivate()]);
  }, [refreshPublic, refreshPrivate]);
  const initialize = async () => {
    setLoading(true);
    setError('');
    try {
      const auth = await api<{ authenticated: boolean }>('/auth');
      setAuthenticated(auth.authenticated);
      await refreshPublic();
      if (auth.authenticated) await refreshPrivate();
      else if (currentView() !== 'public') {
        setLoginFor(currentView());
        setView('public');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void initialize();
  }, []);
  useEffect(() => {
    const expired = () => {
      setAuthenticated(false);
      setSolves([]);
      setProfile(null);
      setLoginFor(currentView() === 'public' ? 'train' : currentView());
      setView('public');
    };
    window.addEventListener('cube-auth-expired', expired);
    return () => window.removeEventListener('cube-auth-expired', expired);
  }, []);
  useEffect(() => {
    const listener = () => {
      const next = currentView();
      if (next !== 'public' && !authenticated) {
        setLoginFor(next);
        setView('public');
      } else setView(next);
    };
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, [authenticated]);
  const navigate = (next: View) => {
    if (next !== 'public' && !authenticated) {
      setLoginFor(next);
      return;
    }
    setView(next);
    window.location.hash = `/${paths[next]}`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const logout = async () => {
    try {
      await api('/logout', 'POST', {});
      setAuthenticated(false);
      setSolves([]);
      setProfile(null);
      navigate('public');
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const navigation = [
    { id: 'train' as View, label: 'Entrenamiento', icon: Timer },
    { id: 'history' as View, label: 'Mi historial', icon: HistoryIcon },
    { id: 'public' as View, label: 'Mi rincón', icon: Globe2 },
    { id: 'settings' as View, label: 'Ajustes', icon: Settings2 },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('public')} aria-label="Cube, inicio">
          <span className="brand-icon">
            <PuzzleIcon size={29} />
          </span>
          <span>
            cube<span className="brand-point">.</span>
          </span>
        </button>
        <p className="sidebar-caption">TU ESPACIO DE SPEEDCUBING</p>
        <nav aria-label="Navegación principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? 'active' : ''}`}
              onClick={() => navigate(id)}
            >
              <Icon size={20} />
              <span>{label}</span>
              {view === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-mark">✳</span>
            <p>
              Disfruta cada giro.
              <br />
              Tu próxima marca empieza aquí.
            </p>
          </div>
          {authenticated ? (
            <div className="account-row">
              <span className="avatar">{(profile?.name ?? 'C').slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>Mi espacio privado</strong>
                <small>Todo a tu ritmo</small>
              </div>
              <button
                className="icon-button"
                onClick={() => void logout()}
                aria-label="Cerrar sesión"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button className="button sidebar-login" onClick={() => setLoginFor('train')}>
              <LogIn size={16} /> Entrar a mi espacio
            </button>
          )}
          <span className="sidebar-version">HECHO PARA DISFRUTAR · CUBE 1.0</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Mi espacio</span>
            <ChevronRight size={14} />
            <strong>{navigation.find((n) => n.id === view)?.label}</strong>
          </div>
          <div className="row">
            <span className="topbar-tag">
              <span className="live-dot" /> Un giro cada vez
            </span>
            {!authenticated && (
              <button
                className="mobile-login icon-button"
                onClick={() => setLoginFor('train')}
                aria-label="Entrar"
              >
                <LogIn size={20} />
              </button>
            )}
            {authenticated && (
              <button
                className="mobile-login icon-button"
                onClick={() => void logout()}
                aria-label="Cerrar sesión"
              >
                <LogOut size={20} />
              </button>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {error && (
            <div className="error-box row between" role="alert">
              <span>{error}</span>
              <button className="text-button" onClick={() => void initialize()}>
                Reintentar
              </button>
              <button
                className="icon-button"
                onClick={() => setError('')}
                aria-label="Cerrar aviso"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="app-loading">
              <LoaderCircle className="spin" size={28} />
              <p>Preparando tu rincón…</p>
            </div>
          ) : (
            <>
              {view === 'public' && publicData && (
                <PublicPage
                  data={publicData}
                  authenticated={authenticated}
                  onTrain={() => navigate('train')}
                  onSettings={() => navigate('settings')}
                  onOpen={setPublication}
                  onRemove={async (id) => {
                    await api(`/publications/${id}`, 'DELETE', {});
                    await refreshPublic();
                  }}
                />
              )}{' '}
              {view === 'train' && authenticated && (
                <Trainer
                  solves={solves}
                  onSaved={refreshPrivate}
                  onPublish={(solve, kind) => setPublish({ solve, kind })}
                  onHistory={() => navigate('history')}
                />
              )}{' '}
              {view === 'history' && authenticated && (
                <History
                  solves={solves}
                  onSaved={refreshPrivate}
                  onPublish={(solve, kind) => setPublish({ solve, kind })}
                />
              )}{' '}
              {view === 'settings' && authenticated && profile && (
                <Settings profile={profile} onSaved={refresh} />
              )}
            </>
          )}
          <footer className="page-footer">
            <span className="row">
              <PuzzleIcon size={16} /> Una mezcla, un reto.
            </span>
            <span>
              Hecho con calma y muchos giros <Heart size={12} />
            </span>
          </footer>
        </main>
      </div>
      {loginFor && (
        <Login
          onClose={() => setLoginFor(null)}
          onSuccess={async () => {
            const target = loginFor;
            setAuthenticated(true);
            await refreshPrivate();
            setLoginFor(null);
            setView(target);
            window.location.hash = `/${paths[target]}`;
          }}
        />
      )}{' '}
      {publication && (
        <PublicationDetails publication={publication} onClose={() => setPublication(null)} />
      )}{' '}
      {publish && (
        <PublishDialog
          solve={publish.solve}
          initialKind={publish.kind}
          solves={solves}
          onClose={() => setPublish(null)}
          onPublished={async () => {
            await refreshPublic();
            setPublish(null);
            navigate('public');
          }}
        />
      )}
    </div>
  );
}

function Login({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => Promise<void> }) {
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      title="Un espacio solo para ti"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="login-icon">
        <LockKeyhole size={27} />
      </div>
      <p className="muted">Entra para entrenar, guardar tus tiempos y elegir qué compartir.</p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api('/login', 'POST', { password });
            await onSuccess();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Tu contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            autoFocus
          />
        </label>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />} Entrar
        </button>
        <p className="help">
          La contraseña inicial la elige quien instala Cube. Después puedes cambiarla en Ajustes.
        </p>
      </form>
    </Modal>
  );
}

function PublishDialog({
  solve,
  initialKind,
  solves,
  onClose,
  onPublished,
}: {
  solve: Solve;
  initialKind: 'single' | 'ao5';
  solves: Solve[];
  onClose: () => void;
  onPublished: () => Promise<void>;
}) {
  const [kind, setKind] = useState(initialKind),
    [title, setTitle] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const eventSolves = solves.filter((s) => s.event === solve.event),
    index = eventSolves.findIndex((s) => s.id === solve.id);
  const window = eventSolves.slice(Math.max(0, index - 4), index + 1),
    selected = kind === 'single' ? [solve] : window;
  const result = kind === 'single' ? effectiveTime(solve) : averageOfFive(window);
  return (
    <Modal
      title="Un logro para tu vitrina"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="muted">Solo se compartirá lo que ves aquí. Puedes retirarlo después.</p>
      <div className="segmented">
        <button className={kind === 'single' ? 'active' : ''} onClick={() => setKind('single')}>
          Single
        </button>
        <button
          className={kind === 'ao5' ? 'active' : ''}
          onClick={() => setKind('ao5')}
          disabled={window.length < 5}
        >
          ao5 · media de 5
        </button>
      </div>
      <div className="result-hero mono">
        {formatTime(result)}
        <small>s</small>
      </div>
      <p className="center help">
        {EVENTS[solve.event].name}
        {kind === 'ao5' ? ' · Los 5 intentos consecutivos que terminan en el seleccionado' : ''}
      </p>
      <div className="publish-preview">
        {selected.map((s, i) => (
          <div className="row between" key={s.id}>
            <span className="help">Intento {i + 1}</span>
            <SolveTime solve={s} />
          </div>
        ))}
      </div>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api('/publications', 'POST', { kind, solveId: solve.id, title });
            await onPublished();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Título <span className="optional">opcional</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="¡Mi primer sub-20!"
          />
        </label>
        <div className="info-box">
          <ShieldCheck size={18} />
          <span>
            Se publicarán el resultado, la fecha y las mezclas. Las notas privadas se quedan
            contigo.
          </span>
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Mejor lo guardo
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />} Publicar
            ahora
          </button>
        </div>
      </form>
    </Modal>
  );
}
