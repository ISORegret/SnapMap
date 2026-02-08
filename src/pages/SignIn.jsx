import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, hasSupabase } from '../api/supabase';

function getAuthParamsFromHash() {
  const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  const qIndex = hash.indexOf('?');
  const search = qIndex >= 0 ? hash.slice(qIndex + 1) : hash;
  const params = new URLSearchParams(search);
  return { access_token: params.get('access_token'), refresh_token: params.get('refresh_token') };
}

export default function SignIn({ onSuccess, currentUser }) {
  const [mode, setMode] = useState('password'); // 'password' | 'link'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [signUpConfirm, setSignUpConfirm] = useState(false); // sign up done, confirm email
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exchanging, setExchanging] = useState(true);
  const navigate = useNavigate();

  // When user lands from magic link, URL has access_token (and refresh_token) in hash – exchange for session and go to Feed
  useEffect(() => {
    if (!hasSupabase || !supabase) return;
    const { access_token, refresh_token } = getAuthParamsFromHash();
    if (!access_token) {
      setExchanging(false);
      return;
    }
    supabase.auth
      .setSession({ access_token, refresh_token: refresh_token || '' })
      .then(() => {
        window.history.replaceState(null, '', window.location.pathname + '#/');
        navigate('/', { replace: true });
      })
      .catch(() => setExchanging(false))
      .finally(() => setExchanging(false));
  }, [hasSupabase, navigate]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!hasSupabase || !supabase || !email.trim() || !password) return;
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (err) {
      if (err.message?.includes('Invalid login')) {
        setError('Wrong email or password.');
      } else {
        setError(err.message || 'Sign in failed.');
      }
      return;
    }
    navigate('/', { replace: true });
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!hasSupabase || !supabase || !email.trim() || !password) return;
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message || 'Sign up failed.');
      return;
    }
    setError('');
    if (data?.session) {
      navigate('/', { replace: true });
    } else {
      setSignUpConfirm(true);
    }
  };

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    if (!hasSupabase || !email.trim()) return;
    setError('');
    setLoading(true);
    let redirectTo = window.location.origin + (window.location.pathname || '') + '#/';
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) redirectTo = 'snapmap://auth/callback';
    } catch (_) {}
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (err) {
      setError(err.message || 'Something went wrong.');
      return;
    }
    setSent(true);
  };

  if (exchanging) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <p className="text-slate-400">Signing you in…</p>
      </div>
    );
  }

  if (currentUser) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <p className="text-white">You&apos;re signed in.</p>
        <Link to="/" className="mt-4 text-emerald-400 hover:underline">Go to Feed</Link>
      </div>
    );
  }

  if (!hasSupabase) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <p className="text-slate-400">Sign in requires Supabase.</p>
        <Link to="/" className="mt-4 text-emerald-400 hover:underline">Back</Link>
      </div>
    );
  }

  if (signUpConfirm) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-medium text-white">Confirm your email</p>
        <p className="mt-2 text-sm text-slate-400">
          We sent a confirmation link to <strong className="text-slate-300">{email}</strong>. Click it to activate your account, then sign in with your password.
        </p>
        <button type="button" onClick={() => setSignUpConfirm(false)} className="mt-6 text-emerald-400 hover:underline">Back to sign in</button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-medium text-white">Check your email</p>
        <p className="mt-2 text-sm text-slate-400">
          We sent a sign-in link to <strong className="text-slate-300">{email}</strong>. Click the link to sign in.
        </p>
        <Link to="/" className="mt-6 text-emerald-400 hover:underline">Back to For You</Link>
      </div>
    );
  }

  const isPassword = mode === 'password';

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-xl font-semibold text-white">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isPassword ? 'Sign in with your email and password.' : 'We&apos;ll send you a link to sign in. No password needed.'}
      </p>

      <div className="mt-4 flex gap-2 rounded-xl border border-white/10 p-1">
        <button
          type="button"
          onClick={() => { setMode('password'); setError(''); }}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${isPassword ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-300'}`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => { setMode('link'); setError(''); }}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${!isPassword ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-300'}`}
        >
          Email link
        </button>
      </div>

      {isPassword ? (
        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-500">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-500">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              minLength={6}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          {error && <p className="text-sm text-amber-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading}
            className="w-full rounded-xl border border-white/10 py-3 font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            Create account
          </button>
        </form>
      ) : (
        <form onSubmit={handleLinkSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="link-email" className="block text-xs font-medium text-slate-500">Email</label>
            <input
              id="link-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          {error && <p className="text-sm text-amber-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send sign-in link'}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/" className="text-emerald-400 hover:underline">Back to For You</Link>
      </p>
    </div>
  );
}
