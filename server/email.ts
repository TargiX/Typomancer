import { createHash } from 'node:crypto';

export async function sendPasswordReset(email: string, url: string, token: string,
  transport: typeof fetch = fetch) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!key || !from) throw new Error('Password recovery email is not configured');
  const response = await transport('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      'Idempotency-Key': `password-reset/${createHash('sha256').update(token).digest('hex')}` },
    body: JSON.stringify({ from, to: [email], subject: 'Typomancer — reset your password / Сброс пароля',
      text: `Reset your Typomancer password using this link (valid for 30 minutes):\n${url}\n\nIf you did not request this, ignore this email. Your password has not changed.\n\nЧтобы сбросить пароль Typomancer, открой ссылку выше (действует 30 минут). Если ты не запрашивал сброс, просто проигнорируй письмо. Пароль не изменён.` })
  });
  // Never include provider bodies, reset URLs, tokens or recipients in errors/logs.
  if (!response.ok) throw new Error(`Password recovery email failed (${response.status})`);
}
