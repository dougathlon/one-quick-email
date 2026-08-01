import { expect, test, type Page } from '@playwright/test';

import type { MiniGameId, MiniGameOutcome } from '../../src/game/types';

interface MobileTestHooks {
  forceInterruption?: (id?: MiniGameId) => void;
  completeMiniGame?: (outcome?: MiniGameOutcome) => void;
  setDraft?: (text: string, caret?: number) => void;
  getState?: () => { phase: string; draft: string };
}

type TestWindow = Window & { __ONE_QUICK_EMAIL_TEST__?: MobileTestHooks };

const MINI_GAMES: readonly MiniGameId[] = [
  'calendar-collision',
  'reply-all-intercept',
  'paper-jam',
  'hold-music-hero',
  'stamp-of-approval',
  'expense-triage',
  'quick-question',
  'phone-transfer',
  'badge-scan',
  'attachment-hunt',
];

async function startMobileScenario(page: Page): Promise<void> {
  await page.goto('/?test=1&seed=mobile-mini-games');
  await page.getByTestId('start-work').click();
  await expect(page.getByTestId('compose-screen')).toBeVisible();
}

async function forceInterruption(page: Page, id: MiniGameId): Promise<void> {
  await page.evaluate((miniGameId) => {
    const hook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.forceInterruption;
    if (!hook) throw new Error('Development forceInterruption hook is unavailable');
    hook(miniGameId);
  }, id);
}

async function completeMiniGame(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.completeMiniGame;
    if (!hook) throw new Error('Development completeMiniGame hook is unavailable');
    hook('success');
  });
}

test.describe('portrait mini-games', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('all ten scenes keep touch input inside a readable portrait board', async ({ page }) => {
    test.setTimeout(60_000);
    await startMobileScenario(page);
    const draft = 'Touch controls must never type into or otherwise mutate this draft.';
    await page.evaluate((value) => {
      const hook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.setDraft;
      if (!hook) throw new Error('Development setDraft hook is unavailable');
      hook(value, value.length);
    }, draft);

    for (const [index, id] of MINI_GAMES.entries()) {
      if (index === 5) await page.setViewportSize({ width: 360, height: 800 });
      await forceInterruption(page, id);

      const layer = page.locator('#phaser-layer');
      await expect(layer).toHaveAttribute('data-mini-game', id);
      await expect(layer).toHaveAttribute('data-mini-game-layout', 'portrait');
      await expect(layer).toHaveAttribute('data-mini-game-status', 'briefing');
      await expect(page.locator('.compose-screen')).toHaveAttribute('inert', '');
      await expect(page.locator('#phaser-layer canvas')).toHaveCSS('touch-action', 'none');

      const bounds = await layer.boundingBox();
      if (!bounds) throw new Error('Mini-game layer has no bounds');
      await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await expect(layer).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 3_000 });

      const state = await page.evaluate(() => (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.getState?.());
      expect(state?.phase).toBe('minigame');
      expect(state?.draft).toBe(draft);

      if (process.env.CAPTURE_MOBILE_QA === '1') {
        await page.screenshot({ path: `/tmp/one-quick-email-${index < 5 ? '390' : '360'}-${id}.png` });
      }

      await completeMiniGame(page);
      await expect.poll(async () => page.evaluate(
        () => (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.getState?.()?.phase,
      )).toBe('compose');
      await expect(layer).not.toHaveClass(/\bactive\b/);
    }
  });
});
