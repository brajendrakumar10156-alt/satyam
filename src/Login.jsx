import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, KeyRound, Lock, Mail, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import logo from './assets/logo.png';

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? '/api';

function isGmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function getApiError(data, fallback) {
  return data?.detail || data?.error || fallback;
}

function deliveryText(delivery) {
  if (!delivery?.channel) return 'OTP ready. Check Email or backend terminal.';
  if (delivery.channel === 'gmail_smtp') return `OTP sent to ${delivery.target || 'your Email'}.`;
  if (delivery.channel === 'telegram') return 'OTP sent to configured Telegram chat.';
  if (delivery.channel === 'backend_console') return 'OTP printed in backend terminal.';
  return 'OTP sent.';
}

function getFetchFailureMessage(error, endpoint) {
  const message = String(error?.message || error || '');
  if (/Failed to fetch|NetworkError|ERR|ECONNREFUSED|ECONNRESET/i.test(message)) {
    return `Backend reachable nahi ho raha. Tried: ${API_BASE}${endpoint}. Run: npm run backend`;
  }
  if (/Unexpected token|JSON/i.test(message)) {
    return `Backend response invalid while calling ${API_BASE}${endpoint}.`;
  }
  return message || `Request failed while calling ${API_BASE}${endpoint}`;
}

async function apiPost(endpoint, body) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(getApiError(data, `Request failed (${response.status})`));
  }
  return data;
}

export default function Login({ onLoggedIn }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [sessionId]);

  const secondsLeft = Math.max(0, Math.ceil(((expiresAt || 0) - now) / 1000));
  const emailOk = isGmailAddress(email);
  const passwordOk = password.trim().length >= 8;
  const newPasswordOk = newPassword.trim().length >= 8;

  const canSubmit = useMemo(() => {
    if (loading || !emailOk) return false;
    if (mode === 'login') return passwordOk;
    if (mode === 'signup') return passwordOk && password === confirmPassword;
    if (mode === 'otp') return sessionId ? otp.trim().length === 6 && secondsLeft > 0 : true;
    if (mode === 'reset') {
      return sessionId
        ? otp.trim().length === 6 && newPasswordOk && secondsLeft > 0
        : true;
    }
    return false;
  }, [confirmPassword, emailOk, loading, mode, newPasswordOk, otp, password, passwordOk, secondsLeft, sessionId]);

  function completeLogin(data) {
    if (!data?.accessToken) throw new Error('Missing access token');
    const user = data.user || { identifier: email.trim(), method: 'password' };
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('authUser', JSON.stringify(user));
    localStorage.setItem('authPersisted', '1');
    localStorage.setItem('startRoute', 'coin-select');
    onLoggedIn?.(data);
  }

  function resetTransient(nextMode = mode) {
    setMode(nextMode);
    setError('');
    setOtp('');
    setSessionId(null);
    setDelivery(null);
    setExpiresAt(null);
  }

  async function submitPasswordLogin() {
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/auth/login-password', {
        email: email.trim(),
        password: password.trim(),
      });
      completeLogin(data);
    } catch (e) {
      setError(getFetchFailureMessage(e, '/auth/login-password'));
    } finally {
      setLoading(false);
    }
  }

  async function submitSignup() {
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost('/auth/signup-password', {
        email: email.trim(),
        password: password.trim(),
      });
      completeLogin(data);
    } catch (e) {
      setError(getFetchFailureMessage(e, '/auth/signup-password'));
    } finally {
      setLoading(false);
    }
  }

  async function startOtp() {
    setError('');
    setLoading(true);
    try {
      const health = await fetch(`${API_BASE}/health`);
      if (!health.ok) throw new Error('Backend offline. Run: npm run backend');
      const data = await apiPost('/auth/start', { email: email.trim() });
      setSessionId(data.sessionId);
      setDelivery(data.delivery || null);
      setExpiresAt(Date.now() + Number(data.expiresIn || 600) * 1000);
      setOtp('');
    } catch (e) {
      setError(getFetchFailureMessage(e, '/auth/start'));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtpLogin() {
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/auth/verify', {
        sessionId,
        otp: otp.trim(),
      });
      completeLogin(data);
    } catch (e) {
      setError(getFetchFailureMessage(e, '/auth/verify'));
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/auth/reset-password', {
        email: email.trim(),
        sessionId,
        otp: otp.trim(),
        newPassword: newPassword.trim(),
      });
      completeLogin(data);
    } catch (e) {
      setError(getFetchFailureMessage(e, '/auth/reset-password'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    if (mode === 'login') return submitPasswordLogin();
    if (mode === 'signup') return submitSignup();
    if (mode === 'otp') return sessionId ? verifyOtpLogin() : startOtp();
    if (mode === 'reset') return sessionId ? resetPassword() : startOtp();
    return undefined;
  }

  const modeTitle = {
    login: 'Welcome back',
    signup: 'Create account',
    otp: sessionId ? 'Enter OTP' : 'Email OTP login',
    reset: sessionId ? 'Reset password' : 'Password recovery',
  }[mode];

  const submitText = {
    login: loading ? 'Logging in...' : 'Login',
    signup: loading ? 'Creating...' : 'Create account',
    otp: loading ? (sessionId ? 'Verifying...' : 'Sending...') : (sessionId ? 'Verify OTP' : 'Send OTP'),
    reset: loading ? (sessionId ? 'Resetting...' : 'Sending...') : (sessionId ? 'Reset & login' : 'Send OTP'),
  }[mode];

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#080b12] text-[#d1d4dc] flex">
      <div className="hidden lg:flex flex-1 relative overflow-hidden border-r border-[#1f2937]">
        <img src={logo} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#080b12] via-[#080b12]/80 to-[#111827]/70" />
        <div className="relative z-10 flex flex-col justify-between p-10 max-w-[620px]">
          <div className="flex items-center gap-3">
            <img src={logo} alt="SATYAM AI" className="h-11 w-11 rounded-lg object-cover bg-white" />
            <div>
              <div className="text-[18px] font-black text-white">SATYAM AI</div>
              <div className="text-[12px] text-[#8b94a7]">Trading terminal</div>
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#243047] bg-[#111827]/80 px-3 py-1 text-[12px] text-[#9ca3af]">
              <ShieldCheck size={14} className="text-[#22c55e]" />
              Secure Email access
            </div>
            <h1 className="mt-6 text-[44px] leading-tight font-black tracking-normal text-white">
              Charts, scripts, and backtests in one workspace.
            </h1>
            <p className="mt-4 max-w-[500px] text-[14px] leading-6 text-[#9ca3af]">
              Login karke market list se pair choose karo, chart kholo, aur Python strategy run karke report dekho.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-[12px]">
            {['Live candles', 'Python backtest', 'Trade report'].map((item) => (
              <div key={item} className="rounded-lg border border-[#243047] bg-[#111827]/70 px-3 py-3 text-[#cbd5e1]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[460px] flex flex-col justify-start md:justify-center items-center px-4 py-8 overflow-y-auto dark-scrollbar">
        <form onSubmit={handleSubmit} className="w-full max-w-[390px] rounded-xl border border-[#243047] bg-[#111827]/95 shadow-2xl overflow-hidden my-auto shrink-0">
          <div className="p-5 border-b border-[#243047]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[12px] text-[#8b94a7]">SATYAM AI Terminal login</div>
                <div className="text-[22px] font-black text-white mt-1">{modeTitle}</div>
              </div>
              <img src={logo} alt="logo" className="h-10 w-10 rounded-lg object-cover bg-white" />
            </div>
          </div>

          <div className="p-5 space-y-4">
            <label className="block">
              <span className="text-[12px] text-[#8b94a7] mb-1.5 block">Email address</span>
              <span className="relative block">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-3 py-3 rounded-lg border border-[#243047] bg-[#0b1020] text-[13px] outline-none focus:border-[#2962FF]"
                />
              </span>
            </label>

            {(mode === 'login' || mode === 'signup') && (
              <label className="block">
                <span className="text-[12px] text-[#8b94a7] mb-1.5 block">Password</span>
                <span className="relative block">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full pl-10 pr-3 py-3 rounded-lg border border-[#243047] bg-[#0b1020] text-[13px] outline-none focus:border-[#2962FF]"
                  />
                </span>
              </label>
            )}

            {mode === 'signup' && (
              <label className="block">
                <span className="text-[12px] text-[#8b94a7] mb-1.5 block">Confirm password</span>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  type="password"
                  autoComplete="new-password"
                  className="w-full px-3 py-3 rounded-lg border border-[#243047] bg-[#0b1020] text-[13px] outline-none focus:border-[#2962FF]"
                />
              </label>
            )}

            {(mode === 'otp' || mode === 'reset') && sessionId && (
              <>
                <div className="rounded-lg border border-[#243047] bg-[#0b1020] px-3 py-2">
                  <div className="text-[12px] text-[#cbd5e1]">{deliveryText(delivery)}</div>
                  <div className="text-[11px] text-[#8b94a7] mt-1">
                    {secondsLeft > 0 ? `Expires in ${secondsLeft}s` : 'OTP expired. Send a new code.'}
                  </div>
                </div>
                <label className="block">
                  <span className="text-[12px] text-[#8b94a7] mb-1.5 block">6 digit OTP</span>
                  <span className="relative block">
                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                      placeholder="123456"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="w-full pl-10 pr-3 py-3 rounded-lg border border-[#243047] bg-[#0b1020] text-[13px] tracking-[0.2em] outline-none focus:border-[#2962FF]"
                    />
                  </span>
                </label>
              </>
            )}

            {mode === 'reset' && sessionId && (
              <label className="block">
                <span className="text-[12px] text-[#8b94a7] mb-1.5 block">New password</span>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  type="password"
                  autoComplete="new-password"
                  className="w-full px-3 py-3 rounded-lg border border-[#243047] bg-[#0b1020] text-[13px] outline-none focus:border-[#2962FF]"
                />
              </label>
            )}

            {error && (
              <div className="text-[12px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-11 rounded-lg bg-[#2962FF] text-white font-black text-[13px] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {submitText}
            </button>

            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <button type="button" onClick={() => resetTransient('login')} className={`py-2 rounded-lg border border-[#243047] ${mode === 'login' ? 'text-white bg-[#1f2937]' : 'text-[#8b94a7]'}`}>
                Login
              </button>
              <button type="button" onClick={() => resetTransient('signup')} className={`py-2 rounded-lg border border-[#243047] flex items-center justify-center gap-1 ${mode === 'signup' ? 'text-white bg-[#1f2937]' : 'text-[#8b94a7]'}`}>
                <UserPlus size={13} /> Sign up
              </button>
              <button type="button" onClick={() => resetTransient('otp')} className={`py-2 rounded-lg border border-[#243047] col-span-1 ${mode === 'otp' ? 'text-white bg-[#1f2937]' : 'text-[#8b94a7]'}`}>
                OTP login
              </button>
              <button type="button" onClick={() => resetTransient('reset')} className={`py-2 rounded-lg border border-[#243047] col-span-1 ${mode === 'reset' ? 'text-white bg-[#1f2937]' : 'text-[#8b94a7]'}`}>
                Reset
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
