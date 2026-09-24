interface State {
  checkedAt: string;
  failures: string[];
  incident?: string;
  notified?: boolean;
}
export interface MonitorEnv {
  STATE: { get<T>(key: string, type: 'json'): Promise<T | null>; put(key: string, value: string): Promise<void> };
  RESEND_API_KEY: string;
  ALERT_FROM: string;
  ALERT_TO: string;
}

export const targets = [
  { name: 'website', url: 'https://typomancer.xyz/', status: 200, kind: 'html' },
  { name: 'database-api', url: 'https://typomancer-progress.phosphene.cc/health', status: 200, kind: 'health' },
  { name: 'auth-proxy', url: 'https://typomancer.xyz/api/auth/get-session', status: 200, kind: 'session' },
  { name: 'progress-proxy', url: 'https://typomancer.xyz/api/progress', status: 401, kind: 'protected' }
] as const;

export async function probe(target: typeof targets[number], send: typeof fetch): Promise<boolean> {
  try {
    const response = await send(target.url, {
      redirect: 'manual', signal: AbortSignal.timeout(15000),
      headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Typomancer-Uptime/1.0' }
    });
    if (response.status !== target.status) { await response.body?.cancel(); return false; }
    if (target.kind === 'html') return (await response.text()).includes('<title>Typomancer');
    const body = await response.json() as { status?: string; error?: string } | null;
    if (target.kind === 'health') return body?.status === 'ok';
    if (target.kind === 'session') return body === null;
    return body?.error === 'Sign in required';
  } catch { return false; }
}

export async function sendAlert(env: MonitorEnv, subject: string, text: string, key: string, send = fetch) {
  const response = await send('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ from: env.ALERT_FROM, to: [env.ALERT_TO], subject: `Typomancer uptime — ${subject}`, text })
  });
  // Provider bodies may contain sensitive metadata; only log the status code.
  if (!response.ok) throw new Error(`Uptime email failed (${response.status})`);
  await response.body?.cancel();
}

export async function runMonitor(env: MonitorEnv, runtime: {
  send?: typeof fetch; pause?: (ms: number) => Promise<void>; now?: () => Date;
} = {}) {
  const send = runtime.send ?? fetch;
  const now = (runtime.now ?? (() => new Date()))().toISOString();
  const previous = await env.STATE.get<State>('status', 'json');
  const pause = runtime.pause ?? ((ms: number) => {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, ms);
    return promise;
  });
  const failures = (await Promise.all(targets.map(async target => {
    if (await probe(target, send)) return null;
    // Two retries, not one: a container restart or a dropped pool connection
    // outlasts a 3s pause but not a 10s one. A real outage still fails all three.
    await pause(3000);
    if (await probe(target, send)) return null;
    await pause(10_000);
    return await probe(target, send) ? null : target.name;
  }))).filter((value): value is typeof targets[number]['name'] => value !== null);
  const state: State = { checkedAt: now, failures };
  if (failures.length) {
    state.incident = previous?.incident ?? now;
    state.notified = previous?.notified ?? false;
    // Persist the incident before sending, so failed delivery retries retain
    // their idempotency key. KV is eventually consistent, not a strict lock.
    await env.STATE.put('status', JSON.stringify(state));
    if (!state.notified) {
      await sendAlert(env, 'DOWN', `Failed twice: ${failures.join(', ')}\nChecked: ${now}\nIncident: ${state.incident}\nChecks run outside Hetzner on Cloudflare.`,
        `uptime/down/${state.incident}`, send);
      state.notified = true;
    }
  } else if (previous?.incident && previous.notified) {
    // Keep the previous incident until the recovery notification succeeds.
    await sendAlert(env, 'RECOVERED', `All four checks passed at ${now}.\nIncident started: ${previous.incident}`,
      `uptime/recovered/${previous.incident}`, send);
  }
  await env.STATE.put('status', JSON.stringify(state));
  console.log(JSON.stringify({ checkedAt: now, failures }));
  return state;
}

export default {
  async scheduled(_controller: unknown, env: MonitorEnv) { await runMonitor(env); }
};
