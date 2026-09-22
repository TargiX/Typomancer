import { test, expect } from '@playwright/test';

test('verification status and guarded account deletion preserve guest and other account data', async ({ page }) => {
  let verified = false;
  let exists = true;
  let deletes = 0;
  const user = () => ({ id: 'account-settings-test', email: 'owner@example.invalid', emailVerified: verified });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('guest-proof', 'keep');
    localStorage.setItem('typomancer:account:other:proof', 'keep');
    localStorage.setItem('typomancer:account:account-settings-test:proof', 'delete');
    localStorage.setItem('typomancer:recovery:account-settings-test', 'delete');
  });
  await page.route('**/api/auth/get-session', route => route.fulfill({ json: exists ? { user: user() } : null }));
  await page.route('**/api/progress', route => route.fulfill({ json: route.request().method() === 'GET'
    ? { userId: user().id, revision: 0, snapshot: null, updatedAt: null } : { revision: 1 } }));
  await page.route('**/api/auth/send-verification-email', async route => {
    expect(route.request().postDataJSON().email).toBe(user().email);
    await route.fulfill({ json: { status: true } });
  });
  await page.route('**/api/auth/delete-user', async route => {
    deletes++;
    expect(route.request().headers()['x-typomancer-delete-account']).toBe(user().id);
    if (route.request().postDataJSON().password !== 'correct-password-123') {
      await route.fulfill({ status: 400, json: { code: 'INVALID_PASSWORD' } }); return;
    }
    exists = false;
    await route.fulfill({ json: { success: true } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Progress saving' });
  await expect(panel).toContainText('Email not confirmed');
  await panel.getByRole('button', { name: 'Send confirmation email' }).click();
  await expect(panel).toContainText('Confirmation requested');
  verified = true;
  await panel.getByRole('button', { name: 'I confirmed — check status' }).click();
  await expect(panel.getByText('Email confirmed', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Delete account', exact: true }).click();
  const submit = panel.getByRole('button', { name: 'Permanently delete account' });
  await expect(submit).toBeDisabled();
  await expect(panel).toContainText('up to 30 days');
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(deletes).toBe(0);
  await panel.getByRole('button', { name: 'Delete account', exact: true }).click();
  await panel.getByLabel('Current password', { exact: true }).fill('incorrect-password-123');
  await panel.getByLabel('Type DELETE to confirm').fill('DELETE');
  await submit.click();
  await expect(panel.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('typomancer:account:account-settings-test:proof'))).toBe('delete');
  await panel.getByLabel('Current password', { exact: true }).fill('correct-password-123');
  await page.screenshot({ path: '.context/account-delete-mobile.png', fullPage: true });
  await submit.click();
  await expect(page.getByText('Account deleted', { exact: false })).toBeVisible();

  expect(await page.evaluate(() => localStorage.getItem('guest-proof'))).toBe('keep');
  expect(await page.evaluate(() => localStorage.getItem('typomancer:account:other:proof'))).toBe('keep');
  expect(await page.evaluate(() => localStorage.getItem('typomancer:account:account-settings-test:proof'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('typomancer:recovery:account-settings-test'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('typomancer:last-account'))).toBeNull();
});
