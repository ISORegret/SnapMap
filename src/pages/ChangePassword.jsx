import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, hasSupabase } from '../api/supabase';

export default function ChangePassword({ currentUser }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasSupabase || !supabase || !currentUser?.email) return;
    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      setError('Fill in all fields.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError('New passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword,
    });
    if (signInErr) {
      setLoading(false);
      setError(signInErr.message?.includes('Invalid') ? 'Current password is wrong.' : signInErr.message || 'Verification failed.');
      return;
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updateErr) {
      setError(updateErr.message || 'Could not update password.');
      return;
    }
    setSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
  };

  if (!hasSupabase || !currentUser) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <p className="text-slate-400">Sign in to change your password.</p>
        <Link to="/signin" className="mt-4 text-emerald-400 hover:underline">Sign in</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 text-center">
        <p className="text-lg font-medium text-white">Password updated</p>
        <p className="mt-2 text-sm text-slate-400">Your password has been changed. Use it next time you sign in.</p>
        <Link to="/" className="mt-6 inline-block text-emerald-400 hover:underline">Back to For You</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-xl font-semibold text-white">Change password</h1>
      <p className="mt-1 text-sm text-slate-500">Enter your current password, then choose a new one.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="current-password" className="block text-xs font-medium text-slate-500">Current password</label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label htmlFor="new-password" className="block text-xs font-medium text-slate-500">New password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete="new-password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label htmlFor="new-password-confirm" className="block text-xs font-medium text-slate-500">Confirm new password</label>
          <input
            id="new-password-confirm"
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete="new-password"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#18181b] px-3 py-2.5 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        {error && <p className="text-sm text-amber-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/" className="text-emerald-400 hover:underline">Back to For You</Link>
      </p>
    </div>
  );
}
