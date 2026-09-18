// ACCOUNT_TEST_DATABASE_URL must name an isolated local database.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('real auth: email ownership and password-confirmed, account-bound cascading deletion', { skip: !process.env.ACCOUNT_TEST_DATABASE_URL }, async () => {
  const database = new URL(process.env.ACCOUNT_TEST_DATABASE_URL!);
  assert.equal(database.hostname, '127.0.0.1');
  assert.equal(database.pathname, '/typomancer_account_test');
  process.env.DATABASE_URL = database.href;
  process.env.BETTER_AUTH_SECRET = 'isolated-account-test-secret-at-least-32-characters';
  process.env.BETTER_AUTH_URL = 'http://127.0.0.1:43219';
  process.env.RESEND_API_KEY = 'test-not-a-real-resend-key';
  process.env.AUTH_EMAIL_FROM = 'no-reply@example.invalid';
  const { auth, pool } = await import('../server/auth.ts');
  const { migrate } = await import('../server/migrate.ts');
  const originalFetch = globalThis.fetch;
  const mail: { to: string[]; text: string }[] = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    mail.push(JSON.parse(options!.body as string));
    return new Response('{}');
  };
  const call = async (path: string, body?: unknown, cookie = '', userId?: string, origin = process.env.BETTER_AUTH_URL!) => {
    const response = await auth.handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { origin, 'Content-Type': 'application/json', cookie,
        ...(userId ? { 'x-typomancer-delete-account': userId } : {}) }, body: body === undefined ? undefined : JSON.stringify(body)
    }));
    return { response, status: response.status, cookie: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
  };
  const ids: string[] = [];
  try {
    await migrate();
    const email = `account-${crypto.randomUUID()}@example.invalid`, password = crypto.randomUUID();
    const signup = await call('/sign-up/email', { name: 'Account test', email, password, callbackURL: `${process.env.BETTER_AUTH_URL}/?email-verification=1` });
    assert.equal(signup.status, 200);
    const user = (await signup.response.json()).user; ids.push(user.id);
    assert.equal(user.emailVerified, false); assert.ok(signup.cookie);
    assert.equal(mail.length, 1); assert.deepEqual(mail[0].to, [email]);
    const url = mail[0].text.match(/http:\/\/[^\s]+/)![0];
    const token = new URL(url).searchParams.get('token')!;
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    assert.ok(claims.exp - Math.floor(Date.now() / 1000) <= 1800);
    assert.ok(claims.exp > Math.floor(Date.now() / 1000));
    const verified = await auth.handler(new Request(url, { headers: { cookie: signup.cookie } }));
    assert.equal(verified.status, 302);
    assert.equal((await pool.query('SELECT "emailVerified" FROM "user" WHERE id=$1', [user.id])).rows[0].emailVerified, true);
    const bad = await call('/verify-email?token=invalid'); assert.equal(bad.status, 401);
    assert.equal((await call('/request-password-reset', { email })).status, 200);
    assert.equal(Number((await pool.query('SELECT count(*) AS n FROM "verification" WHERE value=$1', [user.id])).rows[0].n), 1);
    await pool.query('INSERT INTO player_save (user_id,revision,mutation_id,snapshot) VALUES ($1,1,$2,$3)', [user.id, crypto.randomUUID(), '{}']);
    await pool.query('INSERT INTO player_run (user_id,run_id,ended_at,data) VALUES ($1,$2,now(),$3)', [user.id, crypto.randomUUID(), '{}']);
    const second = await call('/sign-up/email', { name: 'Other', email: `other-${crypto.randomUUID()}@example.invalid`, password });
    assert.equal(second.status, 200); const otherId = (await second.response.json()).user.id; ids.push(otherId);
    assert.equal((await call('/delete-user', {}, signup.cookie, user.id)).status, 400);
    assert.equal((await call('/delete-user', { password: 'wrong-password-123' }, signup.cookie, user.id)).status, 400);
    assert.equal((await call('/delete-user', { password }, signup.cookie, otherId)).status, 409);
    assert.equal((await call('/delete-user', { password }, signup.cookie, user.id, 'https://evil.invalid')).status, 403);
    for (const table of ['player_save', 'player_run']) {
      assert.equal(Number((await pool.query(`SELECT count(*) AS n FROM "${table}" WHERE user_id=$1`, [user.id])).rows[0].n), 1,
        `Rejected deletion preserves ${table}`);
    }
    assert.equal(Number((await pool.query('SELECT count(*) AS n FROM "verification" WHERE value=$1', [user.id])).rows[0].n), 1);
    const login = await call('/sign-in/email', { email, password }); assert.equal(login.status, 200);
    assert.equal((await call('/delete-user', { password }, signup.cookie, user.id)).status, 200);
    for (const table of ['user', 'session', 'account', 'player_save', 'player_run']) {
      const field = table === 'user' ? 'id' : table.startsWith('player_') ? 'user_id' : 'userId';
      assert.equal(Number((await pool.query(`SELECT count(*) AS n FROM "${table}" WHERE "${field}"=$1`, [user.id])).rows[0].n), 0, table);
    }
    assert.equal(Number((await pool.query('SELECT count(*) AS n FROM "verification" WHERE value=$1', [user.id])).rows[0].n), 0);
    assert.equal(await (await call('/get-session', undefined, login.cookie)).response.json(), null);
    assert.equal((await call('/sign-in/email', { email, password })).status, 401);
    assert.equal(Number((await pool.query('SELECT count(*) AS n FROM "user" WHERE id=$1', [otherId])).rows[0].n), 1);
    assert.equal((await (await call('/get-session', undefined, second.cookie)).response.json()).user.id, otherId);
  } finally {
    globalThis.fetch = originalFetch;
    for (const id of ids) await pool.query('DELETE FROM "user" WHERE id=$1', [id]);
    await pool.end();
  }
});
