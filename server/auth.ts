import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { sendPasswordReset } from './email.ts';

for (const key of ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL']) {
  if (!process.env[key]) throw new Error(`Missing server configuration: ${key}`);
}
if (process.env.BETTER_AUTH_SECRET!.length < 32) throw new Error('Auth secret must be at least 32 characters');
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8,
  connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
pool.on('error', () => console.error('Database connection error'));
export const trustedOrigins = [new URL(process.env.BETTER_AUTH_URL!).origin,
  ...(process.env.AUTH_TRUSTED_ORIGINS || '').split(',').filter(Boolean)];

export const auth = betterAuth({
  appName: 'Typomancer', database: pool,
  baseURL: process.env.BETTER_AUTH_URL, secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 1800, revokeSessionsOnPasswordReset: true,
    ...(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM ? {
      sendResetPassword: async ({ user, url, token }: { user: { email?: string }; url: string; token: string }) => {
        if (!user.email) throw new Error('Account has no recovery email');
        await sendPasswordReset(user.email, url, token);
      }
    } : {}) },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, storage: 'database', window: 60, max: 60,
    customRules: { '/sign-in/email': { window: 60, max: 8 }, '/sign-up/email': { window: 3600, max: 10 },
      '/request-password-reset': { window: 3600, max: 5 }, '/reset-password': { window: 60, max: 8 } } },
  advanced: { cookiePrefix: 'typomancer', useSecureCookies: process.env.NODE_ENV === 'production' }
});
