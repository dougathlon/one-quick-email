import { expect, test, type Page } from '@playwright/test';

import { forceInterruption, touchCenter } from './support';

type Direction = 'ArrowLeft' | 'ArrowUp' | 'ArrowDown' | 'ArrowRight';

const DIRECTION_POINTS: Readonly<Record<Direction, readonly [number, number]>> = {
  ArrowLeft: [180, 840],
  ArrowUp: [420, 840],
  ArrowDown: [180, 1_010],
  ArrowRight: [420, 1_010],
};

async function logicalCanvasPoint(
  page: Page,
  point: readonly [number, number],
): Promise<{ x: number; y: number }> {
  const box = await page.locator('#phaser-layer canvas').boundingBox();
  if (!box) throw new Error('Mini-game canvas has no bounds');
  const scale = Math.min(box.width / 600, box.height / 1_200);
  return {
    x: box.x + (box.width - 600 * scale) / 2 + point[0] * scale,
    y: box.y + (box.height - 1_200 * scale) / 2 + point[1] * scale,
  };
}

async function tapLogical(page: Page, point: readonly [number, number]): Promise<void> {
  const screenPoint = await logicalCanvasPoint(page, point);
  await page.touchscreen.tap(screenPoint.x, screenPoint.y);
}

async function startMiniGame(page: Page, id: Parameters<typeof forceInterruption>[1]): Promise<void> {
  await forceInterruption(page, id);
  await expect(page.locator('#phaser-layer')).toHaveAttribute(
    'data-mini-game-status',
    'playing',
    { timeout: 4_000 },
  );
}

async function expectNaturalSuccess(page: Page): Promise<void> {
  const layer = page.locator('#phaser-layer');
  await expect(layer).toHaveAttribute('data-mini-game-status', 'success', { timeout: 2_000 });
  await expect(page.getByTestId('compose-screen')).toBeVisible({ timeout: 2_000 });
}

test('touch controls can naturally complete the four tap-driven mini-games', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit', 'WebKit provides the iPhone-engine touch sample.');
  test.setTimeout(60_000);

  await page.goto('/?test=1&seed=mobile-natural-touch-mechanics');
  await touchCenter(page, page.getByTestId('start-work'));

  await startMiniGame(page, 'paper-jam');
  for (let index = 0; index < 6; index += 1) {
    await tapLogical(page, [145, 925]);
    await tapLogical(page, [455, 925]);
  }
  await expectNaturalSuccess(page);

  await startMiniGame(page, 'hold-music-hero');
  const sequence = (await page.locator('#phaser-layer canvas').getAttribute('data-hold-music-sequence'))
    ?.split(',') as Direction[] | undefined;
  expect(sequence).toHaveLength(6);
  for (const direction of sequence ?? []) await tapLogical(page, DIRECTION_POINTS[direction]);
  await expectNaturalSuccess(page);

  await startMiniGame(page, 'reply-all-intercept');
  for (let attempt = 0; attempt < 55; attempt += 1) {
    if (await page.locator('#phaser-layer').getAttribute('data-mini-game-status') !== 'playing') break;
    await tapLogical(page, [300, 700]);
    await page.waitForTimeout(70);
  }
  await expectNaturalSuccess(page);

  await startMiniGame(page, 'stamp-of-approval');
  for (let attempt = 0; attempt < 35; attempt += 1) {
    if (await page.locator('#phaser-layer').getAttribute('data-mini-game-status') !== 'playing') break;
    await tapLogical(page, [300, 700]);
    await page.waitForTimeout(50);
  }
  await expectNaturalSuccess(page);
});
