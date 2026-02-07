import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, hasSupabase } from '../api/supabase';

export default function SignIn({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasSupabase || !email.trim()) return;
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + (window.location.pathname || '') + (window.location.hash || '#/') },
    });
    setLoading(false);
    if (err) {
      setError(err.message || 'Something went wrong.');
      return;
    }
    setSent(true);
  };

  if (!hasSupabase) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <p className="text-slate-400">Sign in requires Supabase.</p>
        <Link to="/" className="mt-4 text-emerald-400 hover:underline">Back</Link>
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

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-xl font-semibold text-white">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter your email and we&apos;ll send you a link to sign in. No password needed.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-slate-500">
            Email
          </label>
          <input
            id="email"
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
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/" className="text-emerald-400 hover:underline">Back to For You</Link>
      </p>
    </div>
  );
}
