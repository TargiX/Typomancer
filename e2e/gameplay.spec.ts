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

test('contextual skills stack above a stable Focus anchor', async ({ page }) => {
  await startCampaign(page);
  const input = page.getByRole('textbox', { name: 'Typing practice input' });
  const activeText = await page.locator('.engine-type-scroll span.relative.inline-block').innerText();
  const stack = page.locator('.engine-cursor-skills');
  const labels = stack.locator('.engine-cursor-skill-label');

  await expect(labels).toHaveText(['FOCUS']);
  await input.pressSequentially(activeText.slice(0, 20));
  await expect(labels).toHaveText(['FIREWALL', 'FOCUS']);
  await input.pressSequentially(activeText.slice(20, 28));
  await expect(labels).toHaveText(['FIREWALL', 'PURGE', 'FOCUS']);

  const geometry = await stack.evaluate((element) => {
    const focus = element.querySelector('.engine-cursor-skill--focus');
    return {
      direction: getComputedStyle(element).flexDirection,
      focusIsLast: element.lastElementChild === focus,
      focusBottom: focus?.getBoundingClientRect().bottom,
      stackBottom: element.getBoundingClientRect().bottom
    };
  });
  expect(geometry.direction).toBe('column');
  expect(geometry.focusIsLast).toBe(true);
  expect(geometry.focusBottom).toBe(geometry.stackBottom);
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
