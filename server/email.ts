import { createHash } from 'node:crypto';

export async function sendPasswordReset(email: string, url: string, token: string,
  transport: typeof fetch = fetch) {
  return sendAccountEmail('password-reset', email, url, token, transport);
}

export async function sendEmailVerification(email: string, url: string, token: string,
  transport: typeof fetch = fetch) {
  return sendAccountEmail('email-verification', email, url, token, transport);
}

async function sendAccountEmail(kind: 'password-reset' | 'email-verification', email: string, url: string, token: string,
  transport: typeof fetch) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  const label = kind === 'password-reset' ? 'Password recovery' : 'Email verification';
  if (!key || !from) throw new Error(`${label} email is not configured`);
  const response = await transport('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      'Idempotency-Key': `${kind}/${createHash('sha256').update(token).digest('hex')}` },
    body: JSON.stringify({ from, to: [email],
      subject: kind === 'password-reset' ? 'Typomancer — reset your password / Сброс пароля' : 'Typomancer — confirm your email / Подтверди почту',
      text: kind === 'password-reset'
        ? `Reset your Typomancer password using this link (valid for 30 minutes):\n${url}\n\nIf you did not request this, ignore this email. Your password has not changed.\n\nЧтобы сбросить пароль Typomancer, открой ссылку выше (действует 30 минут). Если ты не запрашивал сброс, просто проигнорируй письмо. Пароль не изменён.`
        : `Confirm your Typomancer email using this link (valid for 30 minutes):\n${url}\n\nIf you did not create this account, ignore this email.\n\nПодтверди почту Typomancer по ссылке выше (действует 30 минут). Если ты не создавал аккаунт, проигнорируй письмо.` })
  });
  // Never include provider bodies, reset URLs, tokens or recipients in errors/logs.
  if (!response.ok) throw new Error(`${label} email failed (${response.status})`);
}
