import { expect, test, type Page } from '@playwright/test';

import { forceInterruption } from './support';

const CONNECTOR_CENTERS: ReadonlyArray<readonly [number, number]> = [
  [175, 430],
  [305, 430],
  [305, 570],
  [305, 710],
  [435, 710],
  [435, 850],
];
const REQUIRED_ROTATIONS = [0, 1, 1, 3, 1, 1] as const;

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

async function rotateTo(page: Page, index: number, target: number): Promise<void> {
  const rotations = (await page.locator('#phaser-layer canvas')
    .getAttribute('data-phone-transfer-rotations'))
    ?.split(',')
    .map(Number);
  const current = rotations?.[index];
  const center = CONNECTOR_CENTERS[index];
  if (!Number.isInteger(current) || !center) throw new Error(`Invalid connector state at ${index}`);
  const point = await logicalCanvasPoint(page, center);
  const tapCount = ((target - current) % 4 + 4) % 4;
  for (let tap = 0; tap < tapCount; tap += 1) await page.touchscreen.tap(point.x, point.y);
}

test('touch input cannot complete Phone Transfer with a disconnected visible route', async ({ page }) => {
  await page.goto('/?test=1&seed=mobile-phone-transfer-connectivity');
  await page.getByTestId('start-work').click();
  await forceInterruption(page, 'phone-transfer');

  const layer = page.locator('#phaser-layer');
  const canvas = layer.locator('canvas');
  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 4_000 });

  const lastIndex = REQUIRED_ROTATIONS.length - 1;
  const incorrectFinalRotation = ((REQUIRED_ROTATIONS[lastIndex] ?? 0) + 3) % 4;
  await rotateTo(page, lastIndex, incorrectFinalRotation);
  for (let index = 0; index < lastIndex; index += 1) {
    await rotateTo(page, index, REQUIRED_ROTATIONS[index] ?? 0);
  }
  await page.waitForTimeout(150);

  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing');
  await expect(canvas).toHaveAttribute('data-phone-transfer-logical-connected', 'false');
  await expect(canvas).toHaveAttribute('data-phone-transfer-visual-connected', 'false');

  await rotateTo(page, lastIndex, REQUIRED_ROTATIONS[lastIndex] ?? 0);
  await page.waitForTimeout(25);
  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing');
  await expect(layer).toHaveAttribute('data-mini-game-status', 'success', { timeout: 1_000 });
  await expect(canvas).toHaveAttribute('data-phone-transfer-success-visual-connected', 'true');
});
