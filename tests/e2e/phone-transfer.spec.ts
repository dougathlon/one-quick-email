import { expect, test, type Page } from '@playwright/test';

type TestWindow = Window & {
  __ONE_QUICK_EMAIL_TEST__?: {
    forceInterruption?: (id: 'phone-transfer') => void;
  };
};

const CONNECTOR_CENTERS: ReadonlyArray<readonly [number, number]> = [
  [340, 355],
  [500, 355],
  [500, 515],
  [500, 675],
  [660, 675],
  [820, 675],
];
const REQUIRED_ROTATIONS = [0, 1, 1, 3, 0, 0] as const;

async function logicalCanvasPoint(
  page: Page,
  point: readonly [number, number],
): Promise<{ x: number; y: number }> {
  const box = await page.locator('#phaser-layer canvas').boundingBox();
  if (!box) throw new Error('Mini-game canvas has no bounds');
  const scale = Math.min(box.width / 1_440, box.height / 900);
  return {
    x: box.x + (box.width - 1_440 * scale) / 2 + point[0] * scale,
    y: box.y + (box.height - 900 * scale) / 2 + point[1] * scale,
  };
}

async function rotateTo(page: Page, index: number, target: number): Promise<void> {
  const canvas = page.locator('#phaser-layer canvas');
  const rotations = (await canvas.getAttribute('data-phone-transfer-rotations'))
    ?.split(',')
    .map(Number);
  const current = rotations?.[index];
  const center = CONNECTOR_CENTERS[index];
  if (!Number.isInteger(current) || !center) throw new Error(`Invalid connector state at ${index}`);
  const clickCount = ((target - current) % 4 + 4) % 4;
  const point = await logicalCanvasPoint(page, center);
  for (let click = 0; click < clickCount; click += 1) await page.mouse.click(point.x, point.y);
}

test('Phone Transfer succeeds only after the visible route is connected', async ({ page }) => {
  await page.goto('/?test=1&seed=phone-transfer-connectivity');
  await page.getByTestId('start-work').click();
  await page.evaluate(() => {
    const forceInterruption = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.forceInterruption;
    if (!forceInterruption) throw new Error('Development forceInterruption hook is unavailable');
    forceInterruption('phone-transfer');
  });

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
