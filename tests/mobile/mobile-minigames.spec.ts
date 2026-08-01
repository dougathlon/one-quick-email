import { expect, test } from '@playwright/test';

import {
  captureMobileScreenshot,
  completeMiniGame,
  expectInsideViewport,
  expectMobileEnvironment,
  expectNoHorizontalOverflow,
  forceInterruption,
  getTestState,
  MINI_GAMES,
  setDraft,
  touchCenter,
} from './support';

test('fits every Phaser interruption and isolates the draft from real touch input', async ({ page }, testInfo) => {
  test.setTimeout(60_000);

  await page.goto(`/?test=1&seed=mobile-minigames-${testInfo.project.name}`);
  await expectMobileEnvironment(page, testInfo);
  await touchCenter(page, page.getByTestId('start-work'));
  await expect(page.getByTestId('compose-screen')).toBeVisible();

  const editor = page.getByTestId('reply-editor');
  const layer = page.locator('#phaser-layer');
  const canvas = layer.locator('canvas');
  const draft = 'Touch input belongs to the interruption, never to this email draft.';
  const caret = 17;

  for (const [index, miniGame] of MINI_GAMES.entries()) {
    await setDraft(page, draft, caret);
    await forceInterruption(page, miniGame);

    await expect.poll(async () => (await getTestState(page)).phase).toBe('minigame');
    await expect(layer).toHaveClass(/\bactive\b/);
    await expect(layer).toHaveAttribute('data-mini-game', miniGame);
    await expect(layer).toHaveAttribute('data-mini-game-layout', 'portrait');
    await expect(layer).toHaveAttribute('data-mini-game-status', 'briefing');
    await expectInsideViewport(page, canvas);
    await expectNoHorizontalOverflow(page);

    if (index === 0) {
      await captureMobileScreenshot(page, testInfo, 'phaser-briefing');
    }

    await touchCenter(page, canvas);
    expect((await getTestState(page)).draft).toBe(draft);

    await expect(layer).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 4_000 });
    await expectInsideViewport(page, canvas);

    if (index === 0) {
      await captureMobileScreenshot(page, testInfo, 'phaser-playing');
    }

    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error(`${miniGame} canvas has no touchable bounds`);
    await page.touchscreen.tap(canvasBox.x + 4, canvasBox.y + 4);
    expect((await getTestState(page)).draft).toBe(draft);

    await completeMiniGame(page);
    await expect.poll(async () => (await getTestState(page)).phase, { timeout: 2_500 }).toBe('compose');
    await expect(layer).not.toHaveClass(/\bactive\b/);
    await expect(editor).toBeFocused();
    await expect(editor).toHaveValue(draft);
    expect(await editor.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement;
      return [textarea.selectionStart, textarea.selectionEnd];
    })).toEqual([caret, caret]);
  }
});
