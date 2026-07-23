import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import Login from './Login.tsx';
import CoinSelectPage from './CoinSelectPage.tsx';
import './index.css';

import logo from './assets/logo.png';

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
          // Backend explicitly rejected the token — the session really is invalid.
          logout();
          return;
        }
        setAuthState('authed');
      })
      .catch(() => {
        // Network/backend-offline error, not an auth rejection — keep the
        // session locally persisted unless the user explicitly logs out.
        setAuthState('authed');
      });

    return () => controller.abort();
  }, []);

  if (authState === 'checking') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#131722] text-[#d1d4dc]">
        <div className="text-[13px] text-[#787b86]">Checking login...</div>
      </div>
    );
  }

  if (authState !== 'authed') {
    return <Login onLoggedIn={() => {
      localStorage.setItem('startRoute', 'coin-select');
      setAuthState('authed');
      setRoute('coin-select');
    }} />;
  }

  if (route === 'coin-select') {
    return (
      <CoinSelectPage
        onOpenChart={({ selectedExchange, selectedCoin }) => {
          if (selectedExchange) localStorage.setItem('exchange', selectedExchange);
          if (selectedCoin) localStorage.setItem('selectedCoin', selectedCoin);
          localStorage.setItem('startRoute', 'chart');
          setRoute('chart');
        }}
        onLogout={logout}
      />
    );
  }

  return (
    <App 
      onLogout={logout} 
      onBackToCoins={() => {
        localStorage.setItem('startRoute', 'coin-select');
        setRoute('coin-select');
      }}
    />
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    try {
      console.error('ErrorBoundary caught:', error, info);
      // store last error for quick debugging
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
        <div style={{ minHeight: '100dvh', padding: 24, background: '#131722', color: '#d1d4dc', fontFamily: 'sans-serif' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', border: '1px solid #2a2e39', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Frontend crashed</div>
            <div style={{ fontSize: 13, color: '#787b86', marginBottom: 12 }}>
              An error occurred while rendering the page. Check browser console for full stack.
            </div>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('last_app_error');
                } catch {}
                window.location.reload();
              }}
              style={{ padding: '10px 14px', borderRadius: 10, background: '#2962FF', color: 'white', border: 0, fontWeight: 700 }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function installGlobalErrorHandlers() {
  if (window.__satyamAITerminalGlobalHandlersInstalled) return;
  window.__satyamAITerminalGlobalHandlersInstalled = true;

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
);
