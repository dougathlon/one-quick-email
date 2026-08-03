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

interface LogicalPoint {
  readonly x: number;
  readonly y: number;
}

async function logicalPointOnCanvas(page: Page, point: LogicalPoint): Promise<LogicalPoint> {
  const box = await page.locator('#phaser-layer canvas').boundingBox();
  if (!box) throw new Error('Mini-game canvas has no bounds');
  const scale = Math.min(box.width / 600, box.height / 1_200);
  return {
    x: box.x + (box.width - 600 * scale) / 2 + point.x * scale,
    y: box.y + (box.height - 1_200 * scale) / 2 + point.y * scale,
  };
}

async function touchDrag(
  page: Page,
  start: LogicalPoint,
  end: LogicalPoint,
  durationMs = 90,
): Promise<void> {
  const client = await page.context().newCDPSession(page);
  const from = await logicalPointOnCanvas(page, start);
  const to = await logicalPointOnCanvas(page, end);
  const touch = (point: LogicalPoint) => ({
    x: point.x,
    y: point.y,
    id: 1,
    radiusX: 2,
    radiusY: 2,
    force: 1,
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touch(from)],
  });
  const steps = 5;
  for (let index = 1; index <= steps; index += 1) {
    if (durationMs > 0) await page.waitForTimeout(durationMs / steps);
    const progress = index / steps;
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [touch({
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      })],
    });
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await client.detach();
}

async function miniGameStatus(page: Page): Promise<string | null> {
  return page.locator('#phaser-layer').getAttribute('data-mini-game-status');
}

async function startPlayingMiniGame(page: Page, id: MiniGameId): Promise<void> {
  await forceInterruption(page, id);
  await expect(page.locator('#phaser-layer')).toHaveAttribute('data-mini-game-status', 'playing', {
    timeout: 4_000,
  });
}

test.describe('portrait mini-games', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('all nine scenes keep touch input inside a readable portrait board', async ({ page }) => {
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

  test('direct-manipulation games consume real touch drags', async ({ page }) => {
    test.setTimeout(60_000);
    await startMobileScenario(page);
    const layer = page.locator('#phaser-layer');
    const canvas = layer.locator('canvas');

    await startPlayingMiniGame(page, 'calendar-collision');
    await expect(canvas).not.toHaveAttribute('data-mini-game-pointer-drag', /.+/);
    await touchDrag(page, { x: 85, y: 960 }, { x: 135, y: 650 });
    if ((await miniGameStatus(page)) === 'playing'
      && (await canvas.getAttribute('data-mini-game-pointer-drag')) === null) {
      await touchDrag(page, { x: 515, y: 960 }, { x: 135, y: 650 });
    }
    for (const [from, to] of [[135, 245], [245, 355], [355, 465]] as const) {
      if ((await miniGameStatus(page)) !== 'playing') break;
      await touchDrag(page, { x: from, y: 650 }, { x: to, y: 650 });
    }
    await expect(canvas).toHaveAttribute('data-mini-game-pointer-drag', /calendar-collision:/);
    await expect(layer).toHaveAttribute('data-mini-game-status', 'success');

    await startPlayingMiniGame(page, 'expense-triage');
    for (const homeY of [420, 690, 960]) {
      for (const targetY of [420, 690, 960]) {
        if ((await miniGameStatus(page)) !== 'playing') break;
        await touchDrag(page, { x: 150, y: homeY }, { x: 450, y: targetY });
      }
    }
    await expect(canvas).toHaveAttribute('data-mini-game-pointer-drag', /expense-triage:/);
    await expect(layer).toHaveAttribute('data-mini-game-status', 'success');

    await startPlayingMiniGame(page, 'badge-scan');
    await touchDrag(page, { x: 130, y: 720 }, { x: 470, y: 720 }, 850);
    await expect(canvas).toHaveAttribute('data-mini-game-pointer-drag', /badge-scan:/);
    await expect(layer).toHaveAttribute('data-mini-game-status', 'success');

    await startPlayingMiniGame(page, 'quick-question');
    await touchDrag(page, { x: 300, y: 710 }, { x: 345, y: 755 });
    const quickTrace = await canvas.getAttribute('data-mini-game-pointer-drag');
    expect(quickTrace).toMatch(/^quick-question:\d+:\d+:\d+$/);
    const [, , quickX = '0', quickY = '0'] = quickTrace?.split(':') ?? [];
    expect(Number(quickX)).toBeGreaterThan(300);
    expect(Number(quickY)).toBeGreaterThan(710);
    expect(await miniGameStatus(page)).toBe('playing');
    await completeMiniGame(page);
    await expect(layer).not.toHaveClass(/\bactive\b/);
  });
});
