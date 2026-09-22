import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Language } from '../types';
import { PasswordRecovery } from './PasswordRecovery';
import { clearAccountDeviceData, playerStorage, setPlayerAccount } from '../services/playerStorage';
import { api, ApiError, downloadSnapshot, fingerprint, isDirty, META_KEY, readMeta, readSnapshot,
  writeMeta, writeSnapshot, type CloudSave, type SaveMeta } from '../services/cloudProgress';

type User = { id: string; email: string; emailVerified?: boolean };
type Status = 'guest' | 'saved' | 'saving' | 'offline' | 'conflict' | 'expired' | 'invalid';
type AccountContext = {
  user: User | null; status: Status; busy: boolean; deleted: boolean; cleanupFailed: boolean;
  login: (email: string, password: string, signup: boolean, importGuest: boolean) => Promise<void>;
  logout: () => Promise<void>; resolve: (useCloud: boolean) => Promise<void>; retry: () => Promise<void>;
  verifyEmail: () => Promise<void>; refreshUser: () => Promise<void>; deleteAccount: (password: string) => Promise<void>;
};
const Context = createContext<AccountContext | null>(null);
const LAST_ACCOUNT = 'typomancer:last-account';

export function CloudProgressProvider({ children }: { children: React.ReactNode }) {
  const [recovery] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.has('reset-password') ? { token: params.get('token') } : null;
  });
  if (import.meta.env.VITE_CLOUD_PROGRESS !== 'true') return <>{children}</>;
  if (recovery) return <PasswordRecovery token={recovery.token} />;
  return <EnabledProvider>{children}</EnabledProvider>;
}
function EnabledProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('guest');
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const acting = useRef(false);
  const [epoch, setEpoch] = useState(0);
  const current = useRef<{ user: User; meta: SaveMeta; verified: boolean } | null>(null);
  const saving = useRef(false);
  const blocked = useRef(false);

  const enter = async (nextUser: User, importGuest = false) => {
    setDeleted(false);
    const cloud = await api<CloudSave>('/api/progress');
    if (cloud.userId !== nextUser.id) throw new ApiError(409, 'ACCOUNT_CHANGED');
    const storage = playerStorage(nextUser.id)!;
    let meta = readMeta(storage);
    const local = readSnapshot(storage);
    const dirty = isDirty(local, meta);
    if (!dirty) {
      const initial = cloud.snapshot || (importGuest ? readSnapshot(playerStorage(null)!) : local);
      writeSnapshot(storage, initial);
      meta = { revision: cloud.revision, synced: cloud.snapshot ? fingerprint(cloud.snapshot) : '' };
      writeMeta(storage, meta);
    }
    blocked.current = Boolean(dirty && meta!.revision !== cloud.revision && !meta!.pending);
    current.current = { user: nextUser, meta: meta!, verified: true };
    localStorage.setItem(LAST_ACCOUNT, JSON.stringify(nextUser));
    setPlayerAccount(nextUser.id);
    setUser(nextUser);
    setStatus(blocked.current ? 'conflict' : 'saved');
    setEpoch(value => value + 1);
  };

  const sync = async () => {
    const active = current.current;
    if (!active || !active.verified || saving.current || blocked.current) return;
    saving.current = true;
    try {
      const storage = playerStorage(active.user.id)!;
      const snapshot = readSnapshot(storage);
      if (!isDirty(snapshot, active.meta)) return;
      // Persist the exact request before sending. A timeout/reload retries the
      // same mutation, even if gameplay has moved ahead since the request.
      const pending = active.meta.pending ?? { mutationId: crypto.randomUUID(), snapshot };
      active.meta = { ...active.meta, pending };
      writeMeta(storage, active.meta);
      setStatus('saving');
      const result = await api<{ revision: number }>('/api/progress', {
        userId: active.user.id, revision: active.meta.revision, ...pending
      }, 'PUT');
      if (current.current !== active) return;
      active.meta = { revision: result.revision, synced: fingerprint(pending.snapshot) };
      writeMeta(storage, active.meta);
      setStatus('saved');
    } catch (error) {
      if (current.current !== active) return;
      if (error instanceof ApiError && (error.status === 401 || error.code === 'ACCOUNT_CHANGED')) {
        active.verified = false; setStatus('expired');
      } else if (error instanceof ApiError && error.status === 409) {
        blocked.current = true; setStatus('conflict');
      } else if (error instanceof ApiError && error.status === 400) {
        blocked.current = true; setStatus('invalid');
      } else setStatus('offline');
    } finally { saving.current = false; }
  };
  const syncRef = useRef(sync); syncRef.current = sync;

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        const session = await api<{ user: User } | null>('/api/auth/get-session');
        if (cancelled) return;
        if (session?.user) await enter(session.user);
        else { setPlayerAccount(null); localStorage.removeItem(LAST_ACCOUNT); }
      } catch {
        if (cancelled) return;
        // An outage does not erase a device's saved account progress. Never
        // upload it until the cookie's identity has been checked again.
        try {
          const cached: User | null = JSON.parse(localStorage.getItem(LAST_ACCOUNT) || 'null');
          if (cached?.id) {
            const meta = readMeta(playerStorage(cached.id)!);
            if (meta) {
              current.current = { user: cached, meta, verified: false };
              setPlayerAccount(cached.id); setUser(cached);
            }
          }
        } catch { setPlayerAccount(null); }
        setStatus('offline');
      } finally { if (!cancelled) setReady(true); }
    };
    void boot();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => void syncRef.current(), 3000);
    const flush = () => void syncRef.current();
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.clearInterval(timer); window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [ready]);

  const action = async (callback: () => Promise<void>) => {
    if (saving.current || acting.current) throw new Error('saving');
    acting.current = true;
    setBusy(true);
    try { await callback(); } finally { acting.current = false; setBusy(false); }
  };
  const login = async (email: string, password: string, signup: boolean, importGuest: boolean) => action(async () => {
    const response = await api<{ user: User }>(`/api/auth/${signup ? 'sign-up' : 'sign-in'}/email`, {
      email, password, ...(signup ? { name: email.split('@')[0], callbackURL: `${location.origin}/?email-verification=1` } : {})
    });
    await enter(response.user, signup && importGuest);
    await sync();
  });
  const logout = async () => action(async () => {
    await sync();
    const active = current.current;
    if (active && isDirty(readSnapshot(playerStorage(active.user.id)!), active.meta)) {
      throw new Error('unsaved');
    }
    await api('/api/auth/sign-out', {});
    current.current = null; blocked.current = false;
    localStorage.removeItem(LAST_ACCOUNT); setPlayerAccount(null);
    setUser(null); setStatus('guest'); setEpoch(value => value + 1);
  });
  const refreshUser = async () => action(async () => {
    const active = current.current;
    const session = await api<{ user: User } | null>('/api/auth/get-session');
    if (!active || !session?.user || session.user.id !== active.user.id) throw new ApiError(409, 'ACCOUNT_CHANGED');
    active.user = session.user; setUser(session.user);
    localStorage.setItem(LAST_ACCOUNT, JSON.stringify(session.user));
  });
  const verifyEmail = async () => action(async () => {
    if (!current.current) throw new ApiError(401);
    await api('/api/auth/send-verification-email', { email: current.current.user.email, callbackURL: `${location.origin}/?email-verification=1` });
  });
  const deleteAccount = async (password: string) => action(async () => {
    const active = current.current;
    if (!active) throw new ApiError(401);
    const previousBlock = blocked.current;
    blocked.current = true;
    try {
      await api('/api/auth/delete-user', { password }, 'POST', { 'x-typomancer-delete-account': active.user.id });
    } catch (cause) { blocked.current = previousBlock; throw cause; }
    // Never erase the guest namespace or another account's device copy.
    try { clearAccountDeviceData(active.user.id); setCleanupFailed(false); }
    catch { setCleanupFailed(true); }
    current.current = null; blocked.current = false;
    setPlayerAccount(null); setUser(null); setStatus('guest'); setEpoch(value => value + 1);
    setDeleted(true);
  });
  const resolve = async (useCloud: boolean) => action(async () => {
    const active = current.current;
    if (!active) return;
    const cloud = await api<CloudSave>('/api/progress');
    if (cloud.userId !== active.user.id) throw new ApiError(409, 'ACCOUNT_CHANGED');
    const storage = playerStorage(active.user.id)!;
    const local = readSnapshot(storage);
    // Preserve both versions before an explicit conflict resolution. This is
    // separate from daily server backups and also available as a JSON download.
    localStorage.setItem(`typomancer:recovery:${active.user.id}`, JSON.stringify({ local, cloud, at: new Date().toISOString() }));
    downloadSnapshot({ local, cloud }, 'typomancer-conflict-backup.json');
    if (useCloud && cloud.snapshot) writeSnapshot(storage, cloud.snapshot);
    active.meta = { revision: cloud.revision, synced: useCloud && cloud.snapshot ? fingerprint(cloud.snapshot) : '' };
    active.verified = true; writeMeta(storage, active.meta); blocked.current = false;
    setStatus('saved'); setEpoch(value => value + 1); await sync();
  });
  const retry = async () => action(async () => {
    if (current.current && !current.current.verified) {
      const session = await api<{ user: User } | null>('/api/auth/get-session');
      if (!session?.user || session.user.id !== current.current.user.id) { setStatus('expired'); return; }
      await enter(session.user);
    }
    await sync();
  });
  if (!ready) return <div role="status" className="min-h-screen bg-slate-950 text-slate-300 grid place-items-center font-mono">Loading saved progress…</div>;
  return <Context.Provider value={{ user, status, busy, deleted, cleanupFailed, login, logout, resolve, retry, verifyEmail, refreshUser, deleteAccount }}>
    <React.Fragment key={epoch}>{children}</React.Fragment>
  </Context.Provider>;
}

export function AccountPanel({ language }: { language: Language }) {
  const account = useContext(Context);
  const [open, setOpen] = useState(false);
  const [signup, setSignup] = useState(false);
  const [importGuest, setImportGuest] = useState(true);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const ru = language === 'ru';
  if (!account) return null;
  const text = (en: string, russian: string) => ru ? russian : en;
  const labels: Record<Status, string> = {
    guest: text('This device only', 'Только на этом устройстве'),
    saved: text('Cloud save connected', 'Облачное сохранение подключено'),
    saving: text('Saving…', 'Сохраняем…'),
    offline: text('Offline · progress stays on this device', 'Нет связи · прогресс остаётся на устройстве'),
    conflict: text('Another device has a newer save', 'На другом устройстве есть новое сохранение'),
    expired: text('Sign in again to sync this device', 'Войди снова для синхронизации'),
    invalid: text('Save needs attention · export your device copy', 'Не удалось сохранить · скачай копию с устройства')
  };
  const execute = async (callback: () => Promise<void>) => {
    setError('');
    try { await callback(); }
    catch (cause) {
      setError(cause instanceof Error && cause.message === 'unsaved'
        ? text('Sync or resolve your save before signing out. Your local copy is safe.', 'Сначала синхронизируй прогресс или разреши конфликт. Локальная копия сохранена.')
        : cause instanceof ApiError && cause.code === 'INVALID_PASSWORD'
          ? text('Incorrect current password. Your account was not deleted.', 'Неверный текущий пароль. Аккаунт не удалён.')
        : cause instanceof ApiError && cause.code === 'ACCOUNT_CHANGED'
          ? text('The signed-in account changed. Reload and check which account is active.', 'Аккаунт изменился. Перезагрузи страницу и проверь, кто сейчас вошёл.')
        : cause instanceof ApiError && cause.status === 429
          ? text('Too many attempts. Wait a few minutes and retry.', 'Слишком много попыток. Подожди несколько минут.')
          : text('Could not complete this. Check your details and connection, then retry.', 'Не удалось выполнить действие. Проверь данные и соединение и повтори.'));
    }
  };
  const button = 'btn-cyber btn-cyber-ghost px-3 py-2 text-sm text-emerald-200 disabled:opacity-50';
  return <section data-account-panel className="border border-emerald-300/20 bg-slate-950/60 p-4 text-left space-y-3" aria-label={text('Progress saving', 'Сохранение прогресса')}>
    {account.deleted && <p role="status" className="text-sm text-emerald-200">{text('Account deleted. You are now playing as a guest.', 'Аккаунт удалён. Теперь ты играешь как гость.')}</p>}
    {account.deleted && account.cleanupFailed && <p role="alert" className="text-sm text-amber-200">{text('The server account is deleted, but this browser blocked device cleanup. Clear this site’s stored data manually; this also removes guest progress.', 'Аккаунт на сервере удалён, но браузер не разрешил очистить локальные данные. Очисти данные сайта вручную; это также удалит гостевой прогресс.')}</p>}
    {!account.user && new URLSearchParams(location.search).has('email-verification') && <p role="status" className="text-sm text-slate-300">{new URLSearchParams(location.search).has('error')
      ? text('This confirmation link could not be used. Sign in and request a new one.', 'Не удалось использовать ссылку подтверждения. Войди и запроси новую.')
      : text('You returned from email confirmation. Sign in to check your email status.', 'Ты вернулся с подтверждения почты. Войди, чтобы проверить её статус.')}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h3 className="font-display text-sm text-white">{text('Progress saving', 'Сохранение прогресса')}</h3>
        <p role="status" className="text-xs leading-relaxed text-slate-400 mt-1">{labels[account.status]}</p></div>
      {!account.user && <button className={button} onClick={() => setOpen(!open)} aria-expanded={open}>{text('Sign in', 'Войти')}</button>}
    </div>
    {account.user && <>
      <p className="text-xs text-slate-400 break-all">{account.user.email}</p>
      <p className="text-xs text-slate-300">{account.user.emailVerified ? text('Email confirmed', 'Почта подтверждена') : text('Email not confirmed · your progress is still available', 'Почта не подтверждена · прогресс остаётся доступен')}</p>
      {!account.user.emailVerified && <div className="flex flex-wrap gap-2">
        <button disabled={account.busy} className={button} onClick={() => void execute(async () => { await account.verifyEmail(); setVerificationSent(true); })}>{text('Send confirmation email', 'Отправить подтверждение')}</button>
        <button disabled={account.busy} className={button} onClick={() => void execute(account.refreshUser)}>{text('I confirmed — check status', 'Я подтвердил — проверить')}</button>
      </div>}
      {verificationSent && !account.user.emailVerified && <p role="status" className="text-xs text-emerald-200">{text('Confirmation requested. Check your inbox and spam folder; the link lasts 30 minutes.', 'Подтверждение запрошено. Проверь почту и спам; ссылка действует 30 минут.')}</p>}
      {new URLSearchParams(location.search).has('email-verification') && !account.user.emailVerified && <p role="status" className="text-xs text-amber-200">{text('Email is not confirmed yet. If the link expired, request another above.', 'Почта пока не подтверждена. Если ссылка устарела, запроси новую выше.')}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={account.busy || account.status === 'saving'} className={button} onClick={() => void execute(account.retry)}>{text('Sync now', 'Синхронизировать')}</button>
        <button disabled={account.busy || account.status === 'saving'} className={button} onClick={() => void execute(account.logout)}>{text('Sign out', 'Выйти')}</button>
        <button className={button} onClick={() => downloadSnapshot(readSnapshot(playerStorage()!))}>{text('Export device copy', 'Скачать локальную копию')}</button>
        <a href="/api/progress/export" className={button}>{text('Export full history', 'Скачать всю историю')}</a>
        <button disabled={account.busy} className={button} onClick={() => { setDeleting(!deleting); setDeleteConfirmation(''); setError(''); }} aria-expanded={deleting}>{text('Delete account', 'Удалить аккаунт')}</button>
      </div>
      {deleting && <form className="border border-rose-400/40 p-3 space-y-3" onSubmit={event => {
        event.preventDefault(); if (deleteConfirmation !== 'DELETE' || account.busy) return;
        const password = String(new FormData(event.currentTarget).get('delete-password'));
        void execute(() => account.deleteAccount(password));
      }}>
        <p className="text-sm text-rose-200">{text('This permanently deletes your account, cloud progress and run history. Export anything you want to keep first.', 'Аккаунт, облачный прогресс и история забегов будут удалены без возможности отмены. Сначала скачай данные, которые хочешь сохранить.')}</p>
        <p className="text-xs text-slate-400">{text('The account copy on this browser is cleared; guest progress is kept. Other devices may retain offline copies. Backups expire under the retention policy (up to 30 days); deletion does not erase backup files immediately.', 'Копия аккаунта в этом браузере очистится, гостевой прогресс останется. На других устройствах могут остаться офлайн-копии. Бэкапы истекают по политике хранения (до 30 дней), а не удаляются мгновенно.')}</p>
        <label className="block text-sm">{text('Current password', 'Текущий пароль')}<input name="delete-password" type="password" required minLength={12} maxLength={128} autoComplete="current-password" className="mt-1 w-full border border-slate-600 bg-slate-900 p-2 text-white" /></label>
        <label className="block text-sm">{text('Type DELETE to confirm', 'Введи DELETE для подтверждения')}<input value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} autoComplete="off" spellCheck={false} className="mt-1 w-full border border-slate-600 bg-slate-900 p-2 text-white" /></label>
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={account.busy || account.status === 'saving' || deleteConfirmation !== 'DELETE'} className="btn-cyber px-3 py-2 text-rose-200 border border-rose-400 disabled:opacity-50">{text('Permanently delete account', 'Удалить аккаунт навсегда')}</button>
          <button type="button" disabled={account.busy} className={button} onClick={() => setDeleting(false)}>{text('Cancel', 'Отмена')}</button></div>
      </form>}
    </>}
    {account.status === 'conflict' && <div className="space-y-2 text-sm text-amber-200">
      <p>{text('Choose which save to continue. Both copies will be downloaded before anything is replaced.', 'Выбери сохранение для продолжения. Перед заменой обе копии будут скачаны.')}</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={account.busy} className={button} onClick={() => void execute(() => account.resolve(true))}>{text('Use cloud save', 'Взять облачное')}</button>
        <button disabled={account.busy} className={button} onClick={() => void execute(() => account.resolve(false))}>{text('Keep this device', 'Оставить это устройство')}</button>
      </div>
    </div>}
    {(open || account.status === 'expired') && <form className="space-y-3" onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      if (recovery) {
        if (recoveryBusy) return;
        setRecoveryBusy(true);
        void execute(async () => {
          try {
            await api('/api/auth/request-password-reset', { email: String(form.get('email')), redirectTo: `${location.origin}/?reset-password=1` });
            setRecoverySent(true);
          } finally { setRecoveryBusy(false); }
        });
        return;
      }
      void execute(() => account.login(String(form.get('email')), String(form.get('password')), signup && !account.user, importGuest));
    }}>
      <p className="text-xs leading-relaxed text-slate-400">{text('Save speed, accuracy, training patterns and upgrades across devices. No typed text is uploaded. In-progress sectors stay on this device.', 'Скорость, точность, слабые сочетания и улучшения — между устройствами. Введённый текст не отправляется. Незавершённый забег остаётся на устройстве.')}</p>
      <label className="block text-sm text-slate-300">Email<input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={account.user?.email} className="mt-1 w-full border border-slate-600 bg-slate-900 p-2 text-white focus:outline-emerald-300" /></label>
      {!recovery && <label className="block text-sm text-slate-300">{text('Password (12+ characters)', 'Пароль (от 12 символов)')}<input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={12} maxLength={128} className="mt-1 w-full border border-slate-600 bg-slate-900 p-2 text-white focus:outline-emerald-300" /></label>}
      {!recovery && signup && !account.user && <label className="flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={importGuest} onChange={event => setImportGuest(event.target.checked)} />{text('Copy this device’s guest progress into my new account', 'Перенести гостевой прогресс этого устройства в новый аккаунт')}</label>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={account.busy || recoveryBusy} className={button}>{recovery ? text('Send reset link', 'Отправить ссылку') : signup && !account.user ? text('Create account', 'Создать аккаунт') : text('Sign in', 'Войти')}</button>
        {!recovery && !account.user && <button type="button" className={button} onClick={() => { setSignup(!signup); setError(''); }}>{signup ? text('Already have an account', 'Уже есть аккаунт') : text('New account', 'Новый аккаунт')}</button>}
        <button type="button" disabled={recoveryBusy} className={button} onClick={() => { setRecovery(!recovery); setRecoverySent(false); setError(''); }}>{recovery ? text('Back to sign in', 'Назад ко входу') : text('Forgot password?', 'Забыл пароль?')}</button>
      </div>
      {recoverySent && <p role="status" className="text-xs text-emerald-200">{text('If an account exists for this email, a reset link will arrive shortly. Check your spam folder too.', 'Если аккаунт с этой почтой существует, скоро придёт ссылка. Проверь также папку «Спам».')}</p>}
    </form>}
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
  </section>;
}

/** Compact status chip for the deck's status strip. One glance: who you are and
    whether the save is safe; everything else lives on the account screen.
    Renders even when cloud sync is disabled — local progress still exists. */
export function AccountChip({ language, onOpen }: { language: Language; onOpen: () => void }) {
  const account = useContext(Context);
  const ru = language === 'ru';
  const label = account?.user
    ? account.user.email
    : ru ? 'ЛОКАЛЬНО' : 'LOCAL SAVE';
  const tone = !account || account.status === 'guest' || account.status === 'offline'
    ? 'bg-slate-500'
    : account.status === 'conflict' || account.status === 'expired' || account.status === 'invalid'
      ? 'bg-amber-400'
      : 'bg-emerald-400';
  return (
    <button type="button" onClick={onOpen} aria-label={ru ? 'Аккаунт' : 'Account'}
      className="hud-strip-button flex max-w-44 items-center gap-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} aria-hidden="true" />
      <span className="account-chip-label truncate">{label}</span>
    </button>
  );
}

/** Post-deletion confirmation. Deleting an account remounts the app (epoch
    bump), which lands the user back on the menu — the notice lives there,
    not inside the panel that just unmounted. */
export function AccountDeletedNotice({ language }: { language: Language }) {
  const account = useContext(Context);
  if (!account?.deleted) return null;
  const ru = language === 'ru';
  return (
    <div className="space-y-2">
      <p role="status" className="fs-label text-emerald-200">
        {ru ? 'Аккаунт удалён. Теперь ты играешь как гость.' : 'Account deleted. You are now playing as a guest.'}
      </p>
      {account.cleanupFailed && (
        <p role="alert" className="fs-label text-amber-200">
          {ru
            ? 'Аккаунт на сервере удалён, но браузер не разрешил очистить локальные данные. Очисти данные сайта вручную; это также удалит гостевой прогресс.'
            : 'The server account is deleted, but this browser blocked device cleanup. Clear this site’s stored data manually; this also removes guest progress.'}
        </p>
      )}
    </div>
  );
}
