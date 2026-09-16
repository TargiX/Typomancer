import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Language } from '../types';
import { playerStorage, setPlayerAccount } from '../services/playerStorage';
import { api, ApiError, downloadSnapshot, fingerprint, isDirty, META_KEY, readMeta, readSnapshot,
  writeMeta, writeSnapshot, type CloudSave, type SaveMeta } from '../services/cloudProgress';

type User = { id: string; email: string };
type Status = 'guest' | 'saved' | 'saving' | 'offline' | 'conflict' | 'expired' | 'invalid';
type AccountContext = {
  user: User | null; status: Status; busy: boolean;
  login: (email: string, password: string, signup: boolean, importGuest: boolean) => Promise<void>;
  logout: () => Promise<void>; resolve: (useCloud: boolean) => Promise<void>; retry: () => Promise<void>;
};
const Context = createContext<AccountContext | null>(null);
const LAST_ACCOUNT = 'typomancer:last-account';

export function CloudProgressProvider({ children }: { children: React.ReactNode }) {
  if (import.meta.env.VITE_CLOUD_PROGRESS !== 'true') return <>{children}</>;
  return <EnabledProvider>{children}</EnabledProvider>;
}
function EnabledProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('guest');
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const current = useRef<{ user: User; meta: SaveMeta; verified: boolean } | null>(null);
  const saving = useRef(false);
  const blocked = useRef(false);

  const enter = async (nextUser: User, importGuest = false) => {
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
    if (saving.current) throw new Error('saving');
    setBusy(true);
    try { await callback(); } finally { setBusy(false); }
  };
  const login = async (email: string, password: string, signup: boolean, importGuest: boolean) => action(async () => {
    const response = await api<{ user: User }>(`/api/auth/${signup ? 'sign-up' : 'sign-in'}/email`, {
      email, password, ...(signup ? { name: email.split('@')[0] } : {})
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
  return <Context.Provider value={{ user, status, busy, login, logout, resolve, retry }}>
    <React.Fragment key={epoch}>{children}</React.Fragment>
  </Context.Provider>;
}

export function AccountPanel({ language }: { language: Language }) {
  const account = useContext(Context);
  const [open, setOpen] = useState(false);
  const [signup, setSignup] = useState(false);
  const [importGuest, setImportGuest] = useState(true);
  const [error, setError] = useState('');
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
        : cause instanceof ApiError && cause.status === 429
          ? text('Too many attempts. Wait a few minutes and retry.', 'Слишком много попыток. Подожди несколько минут.')
          : text('Could not complete this. Check your details and connection, then retry.', 'Не удалось выполнить действие. Проверь данные и соединение и повтори.'));
    }
  };
  const button = 'btn-cyber btn-cyber-ghost px-3 py-2 text-sm text-emerald-200 disabled:opacity-50';
  return <section data-account-panel className="border border-emerald-300/20 bg-slate-950/60 p-4 text-left space-y-3" aria-label={text('Progress saving', 'Сохранение прогресса')}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h3 className="font-display text-sm text-white">{text('Progress saving', 'Сохранение прогресса')}</h3>
        <p role="status" className="text-xs leading-relaxed text-slate-400 mt-1">{labels[account.status]}</p></div>
      {!account.user && <button className={button} onClick={() => setOpen(!open)} aria-expanded={open}>{text('Sign in', 'Войти')}</button>}
    </div>
    {account.user && <>
      <p className="text-xs text-slate-400 break-all">{account.user.email}</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={account.busy || account.status === 'saving'} className={button} onClick={() => void execute(account.retry)}>{text('Sync now', 'Синхронизировать')}</button>
        <button disabled={account.busy || account.status === 'saving'} className={button} onClick={() => void execute(account.logout)}>{text('Sign out', 'Выйти')}</button>
        <button className={button} onClick={() => downloadSnapshot(readSnapshot(playerStorage()!))}>{text('Export device copy', 'Скачать локальную копию')}</button>
        <a href="/api/progress/export" className={button}>{text('Export full history', 'Скачать всю историю')}</a>
      </div>
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
      void execute(() => account.login(String(form.get('email')), String(form.get('password')), signup && !account.user, importGuest));
    }}>
      <p className="text-xs leading-relaxed text-slate-400">{text('Save speed, accuracy, training patterns and upgrades across devices. No typed text is uploaded. In-progress sectors stay on this device.', 'Скорость, точность, слабые сочетания и улучшения — между устройствами. Введённый текст не отправляется. Незавершённый забег остаётся на устройстве.')}</p>
      <label className="block text-sm text-slate-300">Email<input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={account.user?.email} className="mt-1 w-full border border-slate-600 bg-slate-900 p-2 text-white focus:outline-emerald-300" /></label>
      <label className="block text-sm text-slate-300">{text('Password (12+ characters)', 'Пароль (от 12 символов)')}<input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={12} maxLength={128} className="mt-1 w-full border border-slate-600 bg-slate-900 p-2 text-white focus:outline-emerald-300" /></label>
      {signup && !account.user && <label className="flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={importGuest} onChange={event => setImportGuest(event.target.checked)} />{text('Copy this device’s guest progress into my new account', 'Перенести гостевой прогресс этого устройства в новый аккаунт')}</label>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={account.busy} className={button}>{signup && !account.user ? text('Create account', 'Создать аккаунт') : text('Sign in', 'Войти')}</button>
        {!account.user && <button type="button" className={button} onClick={() => { setSignup(!signup); setError(''); }}>{signup ? text('Already have an account', 'Уже есть аккаунт') : text('New account', 'Новый аккаунт')}</button>}
      </div>
      <p className="text-xs text-slate-500">{text('Keep your password in a password manager. Email recovery is not available yet.', 'Сохрани пароль в менеджере паролей. Восстановление по почте пока недоступно.')}</p>
    </form>}
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
  </section>;
}
