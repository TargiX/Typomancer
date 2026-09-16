import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../services/cloudProgress';

export function PasswordRecovery({ token }: { token: string | null }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const ru = navigator.language.startsWith('ru');
  const text = (en: string, russian: string) => ru ? russian : en;
  useEffect(() => {
    // Remove the credential from browser history and subsequent referrers.
    const clean = new URL(location.href);
    clean.searchParams.delete('token'); clean.searchParams.delete('error');
    history.replaceState(null, '', clean);
  }, []);
  return <main className="min-h-screen bg-slate-950 text-slate-200 grid place-items-center p-6">
    <section className="w-full max-w-md border border-emerald-300/20 p-6 space-y-4">
      <h1 className="font-display text-xl">{text('Reset your password', 'Сброс пароля')}</h1>
      {done ? <p role="status">{text('Password changed. Sign in again on your devices.', 'Пароль изменён. Войди заново на своих устройствах.')}</p>
        : !token ? <p role="alert">{text('This link is invalid or expired. Return to the game and request a new one.', 'Ссылка недействительна или устарела. Вернись в игру и запроси новую.')}</p>
          : <form className="space-y-4" onSubmit={async event => {
            event.preventDefault(); if (busy) return;
            const data = new FormData(event.currentTarget);
            const password = String(data.get('password'));
            if (password !== data.get('confirm')) { setError(text('Passwords do not match.', 'Пароли не совпадают.')); return; }
            setBusy(true); setError('');
            try { await api('/api/auth/reset-password', { token, newPassword: password }); setDone(true); }
            catch (cause) { setError(cause instanceof ApiError && cause.code === 'INVALID_TOKEN'
              ? text('This link was used or expired. Request a new one.', 'Ссылка уже использована или устарела. Запроси новую.')
              : text('Could not reset your password. Try again later.', 'Не удалось сбросить пароль. Попробуй позже.')); }
            finally { setBusy(false); }
          }}>
            <label className="block">{text('New password (12+ characters)', 'Новый пароль (от 12 символов)')}
              <input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-1 w-full bg-slate-900 border border-slate-600 p-2" /></label>
            <label className="block">{text('Confirm password', 'Повтори пароль')}
              <input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-1 w-full bg-slate-900 border border-slate-600 p-2" /></label>
            <button disabled={busy} className="btn-cyber px-4 py-2 disabled:opacity-50">{busy ? text('Saving…', 'Сохраняем…') : text('Set new password', 'Сохранить пароль')}</button>
            {error && <p role="alert" className="text-amber-200">{error}</p>}
          </form>}
      <a href="/" className="inline-block text-emerald-300 underline">{text('Return to Typomancer', 'Вернуться в Typomancer')}</a>
    </section>
  </main>;
}
