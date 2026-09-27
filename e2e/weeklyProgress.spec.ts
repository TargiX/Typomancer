import { test, expect } from '@playwright/test';

test('Russian empty progress explains missing data without inventing scores', async ({ page }) => {
  await page.route('**/api/auth/get-session', route => route.fulfill({ json: null }));
  await page.goto('/');
  await page.getByRole('button', { name: 'RU', exact: true }).click();
  await page.getByRole('button', { name: /ДОСЬЕ ОПЕРАТОРА/ }).click();
  const week = page.getByRole('region', { name: 'ПОСЛЕДНИЕ 7 ДНЕЙ' });
  await expect(week.locator('tbody tr')).toHaveCount(7);
  await expect(week.locator('.has-signal')).toHaveCount(0);
  await expect(week).toContainText('0/7');
  await page.getByText('Последние тренировки и калибровки', { exact: false }).click();
  await expect(week).toContainText('Начни точечную тренировку');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.context/weekly-progress-desktop-ru.png', fullPage: true });
});

test('weekly record on mobile opens a selected pattern drill and records completion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/auth/get-session', route => route.fulfill({ json: null }));
  await page.addInitScript(() => {
    const now = new Date(Date.now() - 60000).toISOString();
    localStorage.setItem('typomancerTypingTraining', JSON.stringify({ version: 1, samples: 50,
      keys: [{ token: 'q', attempts: 30, errors: 10, totalLatencyMs: 12000, timedAttempts: 30 }], bigrams: [],
      benchmarks: [{ kind: 'drill', wpm: 40, accuracy: 95, completedAt: now, language: 'en' }] }));
    localStorage.setItem('typomancerPlayerProgress', JSON.stringify({ version: 1, calibration: null, runs: [{
      id: 'weekly-test', endedAt: now, dateKey: now.slice(0, 10), outcome: 'banked', daily: false, genre: 'cyberpunk',
      level: 1, score: 100, wpm: 50, bestWpm: 60, accuracy: 96, consistency: 90, mistakes: 4,
      characters: 100, durationSeconds: 30, focus: 'accuracy', pact: [], language: 'en', measurementVersion: 2
    }] }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: /OPERATOR RECORD/ }).click();
  const week = page.getByRole('region', { name: 'LAST 7 DAYS' });
  await expect(week.locator('tbody tr')).toHaveCount(7);
  await expect(week.locator('tbody tr.has-signal')).toHaveCount(1);
  await expect(week).toContainText('96.0%');
  await page.getByText('Recent drills & calibrations', { exact: false }).click();
  await expect(page.locator('.operator-practice-history')).toContainText('40 WPM');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.context/weekly-progress-mobile.png', fullPage: true });
  // A pattern now opens the five-minute practice: check, targeted practice, recheck.
  await page.getByRole('button', { name: 'Practice q', exact: true }).click();
  await expect(page.getByText('Focus: q')).toBeVisible();
  await page.clock.install();
  for (let phase = 0; phase < 3; phase++) {
    await page.getByRole('button', { name: 'Start stage' }).click();
    const field = page.getByRole('textbox', { name: 'Type the practice passage' });
    const text = await page.locator('.practice-transmission').innerText();
    await field.pressSequentially(text.slice(0, 1));
    await page.clock.fastForward(phase === 1 ? 180000 : 60000);
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('typomancerTypingTraining')!).benchmarks.filter((x: any) => x.kind === 'drill').length)).toBe(2);
});
