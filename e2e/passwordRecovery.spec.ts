import { test, expect } from '@playwright/test';

test('request recovery without a password and keep the account-existence response neutral', async ({ page }) => {
  await page.route('**/api/auth/get-session', route => route.fulfill({ json: null }));
  await page.route('**/api/auth/request-password-reset', async route => {
    expect(route.request().postDataJSON()).toEqual({ email: 'player@example.com', redirectTo: `${new URL(page.url()).origin}/?reset-password=1` });
    await route.fulfill({ json: { status: true } });
  });
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'Progress saving' });
  await panel.getByRole('button', { name: 'Sign in', exact: true }).click();
  await panel.getByRole('button', { name: 'Forgot password?' }).click();
  await panel.getByLabel('Email', { exact: true }).fill('player@example.com');
  await expect(panel.locator('input[name="password"]')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Send reset link' }).click();
  await expect(panel.getByText(/If an account exists/)).toBeVisible();
});

test('reset screen strips URL credential, validates confirmation, submits and handles one-use errors', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/auth/reset-password', async route => {
    requests++;
    expect(route.request().postDataJSON()).toEqual({ token: 'test-reset-token', newPassword: 'new-password-123456' });
    await route.fulfill({ json: { status: true } });
  });
  await page.goto('/?reset-password=1&token=test-reset-token');
  await expect(page).not.toHaveURL(/token=/);
  await page.getByLabel('New password (12+ characters)', { exact: true }).fill('new-password-123456');
  await page.getByLabel('Confirm password', { exact: true }).fill('wrong-password-123');
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
  expect(requests).toBe(0);
  await page.getByLabel('Confirm password', { exact: true }).fill('new-password-123456');
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByRole('status')).toHaveText(/Password changed/);
  expect(requests).toBe(1);
  await page.goto('/?reset-password=1&error=INVALID_TOKEN');
  await expect(page.getByRole('alert')).toHaveText(/invalid or expired/);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});
