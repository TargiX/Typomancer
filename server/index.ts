import express from 'express';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { auth, pool, trustedOrigins } from './auth.ts';
import { migrate } from './migrate.ts';
import { readSave, writeSave } from './progressRepository.ts';
import { saveRequestSchema } from '../services/progressSchema.ts';

await migrate();
const app = express();
const requestWindows = new Map<string, { start: number; count: number }>();
const cleanup = setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, window] of requestWindows) if (window.start < cutoff) requestWindows.delete(key);
}, 60_000);
cleanup.unref();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1'); res.json({ status: 'ok' });
});
// Auth handles CSRF, password hashing and HttpOnly cookies itself; no JSON
// middleware before its handler. There is no cross-origin browser API.
app.all('/api/auth/{*path}', toNodeHandler(auth));
app.use('/api/progress', express.json({ limit: '256kb' }));
app.use('/api/progress', async (req, res, next) => {
  if (req.method !== 'GET' && !trustedOrigins.includes(req.headers.origin || '')) {
    res.status(403).json({ error: 'Untrusted origin' }); return;
  }
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) { res.status(401).json({ error: 'Sign in required' }); return; }
  const now = Date.now();
  const previous = requestWindows.get(session.user.id);
  const window = previous && now - previous.start < 60_000 ? previous : { start: now, count: 0 };
  window.count++; requestWindows.set(session.user.id, window);
  if (window.count > 90) {
    res.setHeader('Retry-After', '60'); res.status(429).json({ error: 'Too many requests' }); return;
  }
  res.locals.userId = session.user.id;
  next();
});
app.get('/api/progress', async (_req, res) => { res.json(await readSave(pool, res.locals.userId)); });
app.put('/api/progress', async (req, res) => {
  const input = saveRequestSchema.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: 'Invalid progress data' }); return; }
  if (input.data.userId !== res.locals.userId) {
    res.status(409).json({ error: 'Account changed', code: 'ACCOUNT_CHANGED' }); return;
  }
  const result = await writeSave(pool, res.locals.userId, input.data);
  res.status(result.conflict ? 409 : 200).json(result);
});
app.get('/api/progress/export', async (_req, res) => {
  const save = await readSave(pool, res.locals.userId);
  const runs = await pool.query('SELECT data FROM player_run WHERE user_id=$1 ORDER BY ended_at DESC', [res.locals.userId]);
  res.setHeader('Content-Disposition', 'attachment; filename="typomancer-progress.json"');
  res.json({ ...save, runs: runs.rows.map(row => row.data) });
});
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error?.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 503;
  if (status === 503) console.error('Request failed', error?.code ?? 'unknown');
  res.status(status).json({ error: status === 503 ? 'Service temporarily unavailable' : 'Invalid request' });
});
const server = app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => {
  console.log(`Progress API listening on ${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}`);
});
const shutdown = () => { server.close(() => { void pool.end().then(() => process.exit(0)); }); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
