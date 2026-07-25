import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import '../src/index.css';
import logo from '../src/assets/logo.png';

// Code splitting routes for fast initial load
const App = lazy(() => import('../src/App.tsx'));
const Login = lazy(() => import('../src/Login.tsx'));
const CoinSelectPage = lazy(() => import('../src/CoinSelectPage.tsx'));

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? `http://${window.location.hostname}:8000`;

function setFavicon() {
  try {
    const link = document.querySelector("link[rel='icon']") || document.createElement('link');
    link.setAttribute('rel', 'icon');
    link.setAttribute('href', logo);
    if (!link.parentNode) document.head.appendChild(link);
  } catch {}
}

function getStartRoute() {
  try {
    const savedRoute = localStorage.getItem('startRoute');
    return savedRoute === 'chart' ? 'chart' : (savedRoute || 'coin-select');
  } catch {
    return 'coin-select';
  }
}

function LoadingFallback({ label }: { label: string }) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#0B0E14] text-[#E2E8F0] font-sans">
      <div className="flex items-center gap-3 bg-[#0F1117] px-6 py-4 rounded-xl border border-[rgba(255,255,255,0.08)] shadow-2xl">
        <div className="w-4 h-4 border-2 border-[#2962FF] border-t-transparent rounded-full animate-spin"></div>
        <div className="text-xs font-mono tracking-widest uppercase text-[#94A3B8]">{label}</div>
      </div>
    </div>
  );
}

function Root() {
  React.useEffect(() => {
    setFavicon();
  }, []);

  const [route, setRoute] = React.useState(getStartRoute);
  const [authState, setAuthState] = React.useState(() => (
    localStorage.getItem('accessToken') ? 'authed' : 'guest'
  ));

  const logout = React.useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('authUser');
    localStorage.removeItem('authPersisted');
    localStorage.setItem('startRoute', 'coin-select');
    setAuthState('guest');
    setRoute('coin-select');
  }, []);

  React.useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      Promise.resolve().then(() => {
        setAuthState('guest');
      });
      return undefined;
    }

    Promise.resolve().then(() => {
      setAuthState('authed');
    });
    const controller = new AbortController();
    fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        setAuthState('authed');
      })
      .catch(() => {
        setAuthState('authed');
      });

    return () => controller.abort();
  }, [logout]);

  if (authState === 'checking') {
    return <LoadingFallback label="Verifying Session..." />;
  }

  if (authState !== 'authed') {
    return (
      <Suspense fallback={<LoadingFallback label="Loading Auth..." />}>
        <Login onLoggedIn={() => {
          localStorage.setItem('startRoute', 'coin-select');
          setAuthState('authed');
          setRoute('coin-select');
        }} />
      </Suspense>
    );
  }

  if (route === 'coin-select') {
    return (
      <Suspense fallback={<LoadingFallback label="Loading Markets..." />}>
        <CoinSelectPage
          onOpenChart={({ selectedExchange, selectedCoin }) => {
            if (selectedExchange) localStorage.setItem('exchange', selectedExchange);
            if (selectedCoin) localStorage.setItem('selectedCoin', selectedCoin);
            localStorage.setItem('startRoute', 'chart');
            setRoute('chart');
          }}
          onLogout={logout}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback label="Loading Terminal Engine..." />}>
      <App 
        onLogout={logout} 
        onBackToCoins={() => {
          localStorage.setItem('startRoute', 'coin-select');
          setRoute('coin-select');
        }}
      />
    </Suspense>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    try {
      console.error('ErrorBoundary caught:', error, info);
      localStorage.setItem(
        'last_app_error',
        JSON.stringify({
          message: String(error?.message || error),
          stack: String(error?.stack || ''),
          info: String(info?.componentStack || ''),
          at: Date.now(),
        })
      );
    } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100dvh', padding: 24, background: '#0B0E14', color: '#E2E8F0', fontFamily: 'sans-serif' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Frontend Error</div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 12 }}>
              An error occurred while rendering the page. Check browser console for stack trace.
            </div>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('last_app_error');
                } catch {}
                window.location.reload();
              }}
              style={{ padding: '10px 14px', borderRadius: 10, background: '#2962FF', color: 'white', border: 0, fontWeight: 700, cursor: 'pointer' }}
            >
              Reload Terminal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function installGlobalErrorHandlers() {
  if ((window as any).__satyamAITerminalGlobalHandlersInstalled) return;
  (window as any).__satyamAITerminalGlobalHandlersInstalled = true;

  window.addEventListener('error', (event) => {
    try {
      const payload = {
        type: 'window.error',
        message: String(event?.message || ''),
        filename: String(event?.filename || ''),
        lineno: event?.lineno ?? null,
        colno: event?.colno ?? null,
        stack: String(event?.error?.stack || ''),
        at: Date.now(),
      };
      console.error('[GlobalError]', payload);
      localStorage.setItem('last_app_error', JSON.stringify(payload));
    } catch {}
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event?.reason;
      const payload = {
        type: 'unhandledrejection',
        message: String(reason?.message || reason || ''),
        stack: String(reason?.stack || ''),
        at: Date.now(),
      };
      console.error('[GlobalUnhandledRejection]', payload);
      localStorage.setItem('last_app_error', JSON.stringify(payload));
    } catch {}
  });
}

installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
