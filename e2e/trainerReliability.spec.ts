import { expect, test, type Page } from '@playwright/test';

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.route('**/api/gemini', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
});

const checkpoint = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('typomancerRunCheckpoint') || 'null'));
const input = (page: Page) => page.getByRole('textbox', { name: 'Typing practice input' });
const line = (page: Page) => page.locator('.engine-type-scroll span.relative.inline-block');
const typeLine = async (page: Page) => {
  const text = await line(page).innerText();
  await expect(input(page)).toBeEnabled();
  await expect(input(page)).toHaveValue('');
  await page.waitForTimeout(80);
  await input(page).pressSequentially(text, { delay: 5 });
  return text;
};
const finishSector = async (page: Page, from = 1) => {
  for (let round = from; round <= 7; round++) {
    const text = await typeLine(page);
    if (round === 3) await page.locator('.engine-decision-overlay button').first().click();
    if (round < 7) await expect(line(page)).not.toHaveText(text);
  }
};

test('raw errors survive shields, pause, reload and a changed menu language', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-hotkey="1"]').click();
  await expect(input(page)).toBeVisible();
  const first = await line(page).innerText();
  await input(page).pressSequentially('#');
  await input(page).press('Backspace');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toHaveCount(0);
  await input(page).pressSequentially(first, { delay: 5 });
  await expect(line(page)).not.toHaveText(first);
  const saved = await checkpoint(page);
  expect(saved.context.storyLog[0].mistakes).toBe(1);
  expect(saved.context.storyLog[0].attempts).toBe(first.length + 1);
  expect(saved.engine.round).toBe(2);
  expect(saved.engine.credits).toBe(18);
  await input(page).pressSequentially('partial');
  await page.reload();
  await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem('narrativeFlowProfile') || '{}');
    localStorage.setItem('narrativeFlowProfile', JSON.stringify({ ...profile, language: 'ru', pact: ['hunted'], relaxed: true }));
  });
  await page.reload();
  await page.locator('[data-hotkey="r"]').click();
  await expect(input(page)).toBeEnabled();
  await expect(line(page)).toHaveText(saved.engine.segment.text);
  await expect(input(page)).toHaveValue('');
  const restored = await checkpoint(page);
  expect(restored.context.id).toBe(saved.context.id);
  expect(restored.context.pact).toEqual(saved.context.pact);
  expect(restored.context.language).toBe('en');
  expect(restored.context.relaxed).toBe(false);
  expect(restored.context.storyLog).toEqual(saved.context.storyLog);
});

test('two sectors retain all line rewards and one cumulative run after banking and reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-hotkey="1"]').click();
  await finishSector(page);
  await expect(page.getByRole('heading', { name: 'SEQUENCE COMPLETE' })).toBeVisible();
  const sector = await checkpoint(page);
  const metrics = sector.context.storyLog.filter((item: { performance: string }) => item.performance !== 'neutral');
  expect(metrics).toHaveLength(7);
  const wallet = await page.evaluate(() => JSON.parse(localStorage.getItem('narrativeFlowProfile') || '{}').credits);
  expect(wallet).toBe(126);
  await page.getByRole('button', { name: 'SAVE & EXIT' }).click();
  await page.reload();
  await page.locator('[data-hotkey="r"]').click();
  await finishSector(page);
  await expect(page.getByRole('button', { name: 'Train weak patterns · 5 min' })).toBeVisible();
  const result = await page.evaluate(() => ({
    profile: JSON.parse(localStorage.getItem('narrativeFlowProfile') || '{}'),
    progress: JSON.parse(localStorage.getItem('typomancerPlayerProgress') || '{}'),
    checkpoint: localStorage.getItem('typomancerRunCheckpoint')
  }));
  expect(result.profile.credits).toBe(252);
  expect(result.progress.runs).toHaveLength(1);
  expect(result.progress.runs[0].id).toBe(sector.context.id);
  expect(result.progress.runs[0].outcome).toBe('victory');
  expect(result.progress.runs[0].accuracy).toBe(100);
  expect(result.progress.runs[0].attempts).toBe(result.progress.runs[0].characters);
  expect(result.progress.runs[0].wpm).toBe(Math.round(result.progress.runs[0].characters * 12000 / result.progress.runs[0].activeDurationMs));
  expect(result.progress.runs[0].characters).toBeGreaterThan(metrics.reduce((sum: number, item: { characters: number }) => sum + item.characters, 0));
  expect(result.checkpoint).toBeNull();
  await page.waitForTimeout(1700);
  await expect(page.getByRole('button', { name: 'Train weak patterns · 5 min' })).toBeVisible();
});

test('five-minute practice pauses its clock and finishes with a saved, comparable result', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: /Practice · 5 min/ }).click();
  for (let phase = 0; phase < 3; phase++) {
    await page.getByRole('button', { name: 'Start stage' }).click();
    const field = page.getByRole('textbox', { name: 'Type the practice passage' });
    const text = await page.locator('.practice-transmission').innerText();
    if (phase === 0) {
      await field.pressSequentially('#');
      await field.press('Backspace');
    }
    await field.pressSequentially(text.slice(0, 50), { delay: 1 });
    if (phase === 0) {
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.clock.fastForward(90_000);
      await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await expect(field).toBeFocused();
    }
    await page.clock.fastForward(phase === 1 ? 180_000 : 60_000);
  }
  await expect(page.getByRole('heading', { name: 'Practice complete' })).toBeVisible();
  await expect(page.locator('.practice-results')).toContainText('1 / 51');
  const result = await page.evaluate(() => ({ training: JSON.parse(localStorage.getItem('typomancerTypingTraining') || '{}'), progress: JSON.parse(localStorage.getItem('typomancerPlayerProgress') || '{}') }));
  expect(result.training.benchmarks[0].language).toBe('en');
  expect(result.training.benchmarks[0].promptId).toBe('steady-transmission-v2');
  expect(result.training.benchmarks[0].accuracy).toBe(100);
  expect(result.progress.practiceDates).toHaveLength(1);
  await page.screenshot({ path: '.context/practice-result.png', fullPage: true });
  await page.getByRole('button', { name: 'Use it in a story' }).click();
  await expect(input(page)).toBeEnabled();
});

test('reload at a story choice preserves its options and does not count the lead-in twice', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-hotkey="1"]').click();
  for (let round = 1; round <= 3; round++) {
    const text = await typeLine(page);
    if (round < 3) await expect(line(page)).not.toHaveText(text);
  }
  const choices = page.locator('.engine-decision-overlay button');
  await expect(choices).toHaveCount(2);
  const labels = await choices.allTextContents();
  const saved = await checkpoint(page);
  expect(saved.engine.decision.options).toHaveLength(2);
  await page.reload();
  await page.locator('[data-hotkey="r"]').click();
  await expect(choices).toHaveText(labels);
  await choices.last().click();
  await expect(input(page)).toBeEnabled();
  const restored = await checkpoint(page);
  expect(restored.engine.round).toBe(4);
  expect(restored.context.storyLog.filter((item: { performance: string }) => item.performance !== 'neutral')).toHaveLength(3);
});

test('Russian practice stays readable on a narrow screen and resumes real keyboard input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'RU', exact: true }).click();
  await page.getByRole('button', { name: /Тренировка · 5 мин/ }).click();
  await page.getByRole('button', { name: 'Начать этап' }).click();
  const field = page.getByRole('textbox', { name: 'Набери текст тренировки' });
  await expect(field).toBeFocused();
  await page.keyboard.type('Ти');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog', { name: 'Пауза' })).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(field).toBeFocused();
  await page.keyboard.type('хий');
  await expect(field).toHaveValue('Тихий');
  expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.context/practice-russian-mobile.png', fullPage: true });
});
