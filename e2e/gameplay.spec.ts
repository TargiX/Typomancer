import { expect, test, type Page } from '@playwright/test';

const installReturningPlayer = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('typomancerPlayerProgress', JSON.stringify({
      version: 1,
      calibration: {
        wpm: 50,
        accuracy: 97,
        durationMs: 30_000,
        completedAt: '2026-08-23T00:00:00.000Z',
        preset: 'balanced'
      },
      runs: []
    }));
    localStorage.setItem('narrativeFlowSkillBriefingSeen', '1');
  });
  await page.route('**/api/gemini', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"offline in e2e"}' });
  });
};

const startCampaign = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: /INITIALIZE LINK/ }).click();
  await page.getByRole('button', { name: /Cyberpunk Espionage Operation Black Ledger/ }).click();
  await page.locator('.screens-perk-card').first().click();
  await expect(page.getByRole('textbox', { name: 'Typing practice input' })).toBeEnabled();
};

const typeActiveLine = async (page: Page) => {
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeLine = page.locator('.engine-type-scroll span.relative.inline-block');
  const text = await activeLine.innerText();
  await expect(input).toHaveValue('');
  // TypingEngine briefly locks input while handing one completed line to the
  // next. Give that 50 ms transition time to release before sending characters.
  await page.waitForTimeout(75);
  await input.pressSequentially(text, { delay: 5 });
  return text;
};

test.beforeEach(async ({ page }) => {
  await installReturningPlayer(page);
});

test('bulk insertion cannot complete a typing line', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const text = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();

  await input.fill(text);

  await expect(input).toHaveValue('');
  await expect(page.getByText('SCORE').locator('..')).toContainText('0');
});

test('the caret only offers skills the player can cast, and unlocks stack upward', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  const stack = page.locator('.engine-cursor-skills');
  const labels = stack.locator('.engine-cursor-skill-label');

  // Energy starts empty, so there is nothing to offer and nothing to render.
  await expect(labels).toHaveCount(0);

  await input.pressSequentially(activeText.slice(0, 20), { delay: 5 });
  await expect(labels).toHaveText(['FIREWALL']);
  const before = await stack.locator('.engine-cursor-skill').last().evaluate((element) => ({
    bottom: element.getBoundingClientRect().bottom,
    rowHeight: element.getBoundingClientRect().height
  }));

  await input.pressSequentially(activeText.slice(20, 28), { delay: 5 });
  await expect(labels).toHaveText(['PURGE', 'FIREWALL']);

  const geometry = await stack.evaluate((element) => ({
    direction: getComputedStyle(element).flexDirection,
    bottomLabel: element.lastElementChild?.querySelector('.engine-cursor-skill-label')?.textContent,
    bottomEdge: element.lastElementChild?.getBoundingClientRect().bottom ?? 0
  }));
  expect(geometry.direction).toBe('column');
  // The cheapest unlock stays put by the caret; PURGE arrived above it. The stack
  // is anchored to the caret, which drifts sub-pixel as the line advances, so the
  // claim worth testing is that FIREWALL did not get pushed up by a whole row.
  expect(geometry.bottomLabel).toBe('FIREWALL');
  expect(Math.abs(geometry.bottomEdge - before.bottom)).toBeLessThan(before.rowHeight / 2);

  // Nothing in the stack is ever a dead key.
  await expect(stack.locator('.engine-cursor-skill:disabled')).toHaveCount(0);
});

test('the tracer eats the line behind a stalled player and PURGE throws it back', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  const burned = page.locator('.tracer-burned');

  // Opening a line and reading it is free: the chase has not armed yet.
  await expect(burned).toHaveCount(0);

  // Build a lead, then stop dead. TRACER_GRACE_MS is 3s from the first keystroke.
  await input.pressSequentially(activeText.slice(0, 40), { delay: 5 });
  await expect(burned).toHaveCount(0);

  // The burn front now marches into the lead we just built.
  await expect
    .poll(async () => burned.count(), { timeout: 20_000, message: 'tracer should consume the line behind a stalled caret' })
    .toBeGreaterThan(4);

  const beforePurge = await burned.count();
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(async () => burned.count(), { timeout: 5_000, message: 'PURGE should throw the burn front back' })
    .toBeLessThan(beforePurge);
});

test('a lost branch shows the player the line clean typing would have earned', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  const reveal = page.locator('.engine-fork-reveal');

  await expect(reveal).toHaveCount(0);

  // Enough uncorrected typos to lose the good branch (more than 4 counted), but
  // short of the 10 that end the run — which would take the input away mid-test.
  const typoCount = 7;
  const wrong = activeText.slice(0, typoCount).replace(/./g, (character) => (character === 'z' ? 'q' : 'z'));
  await input.pressSequentially(wrong, { delay: 5 });
  await input.pressSequentially(activeText.slice(typoCount), { delay: 5 });

  await expect(reveal).toHaveClass(/engine-fork-reveal--bad/);
  await expect(reveal.locator('.engine-fork-missed-text')).not.toBeEmpty();
});

test('a clean line is never told what it missed', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  const reveal = page.locator('.engine-fork-reveal');

  await input.pressSequentially(activeText, { delay: 5 });

  await expect(reveal).toHaveClass(/engine-fork-reveal--good/);
  await expect(reveal.locator('.engine-fork-missed-text')).toHaveCount(0);
});

test('banking a completed sector adds it to Operator Record', async ({ page }) => {
  await startCampaign(page);
  const activeLine = page.locator('.engine-type-scroll span.relative.inline-block');

  for (let round = 1; round <= 7; round += 1) {
    const completedText = await typeActiveLine(page);
    if (round === 3) {
      await page.getByRole('button', { name: /STEALTH/ }).click();
      await expect(activeLine).not.toHaveText(completedText);
    } else if (round < 7) {
      await expect(activeLine).not.toHaveText(completedText);
    }
  }

  await expect(page.getByRole('heading', { name: 'SEQUENCE COMPLETE' })).toBeVisible();

  // Accuracy leads the debrief; speed is one tile among the rest. This is an
  // accuracy trainer, and the screen used to open with a speed number.
  const hero = page.locator('.screens-accuracy-hero');
  await expect(hero).toBeVisible();
  await expect(hero.locator('.screens-accuracy-value')).toContainText('%');
  const heroBox = await hero.boundingBox();
  const speedTile = page.locator('.screens-stat-tile').first();
  const speedBox = await speedTile.boundingBox();
  expect(heroBox!.y).toBeLessThan(speedBox!.y);
  expect(heroBox!.height).toBeGreaterThan(speedBox!.height * 0.9);

  await page.getByRole('button', { name: 'SAVE & EXIT' }).click();
  await expect(page.getByRole('button', { name: /RESUME OPERATION · Sector 2/ })).toBeVisible();
  await page.getByRole('button', { name: /OPERATOR RECORD/ }).click();

  await expect(page.locator('.operator-record-run')).toContainText('BANKED');
  await expect(page.locator('.operator-record-run')).toContainText('LVL 1');
});

test('mobile mistakes show the impact sequence, debrief, and recorded defeat', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  const failureHeading = page.getByRole('heading', { name: 'CRITICAL FAILURE' });

  for (let index = 0; index < Math.min(16, activeText.length); index += 1) {
    const wrongCharacter = activeText[index].toLowerCase() === 'x' ? 'z' : 'x';
    await input.press(wrongCharacter);
    if (await failureHeading.isVisible()) break;
    await page.waitForTimeout(20);
  }

  await expect(page.getByRole('alert')).toContainText('SIGNAL LOST');
  await expect(failureHeading).toBeVisible();
  await expect(page.getByText('Mistakes').locator('..')).toContainText('10');
  const viewportMetrics = await page.locator('body').evaluate((body) => ({
    clientWidth: body.clientWidth,
    scrollWidth: body.scrollWidth
  }));
  expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(viewportMetrics.clientWidth);

  await expect(page.getByRole('alert')).toBeHidden();
  await page.getByRole('button', { name: /MAIN MENU/ }).click();
  await page.getByRole('button', { name: /OPERATOR RECORD/ }).click();
  await expect(page.locator('.operator-record-run')).toContainText('SEVERED');
});
