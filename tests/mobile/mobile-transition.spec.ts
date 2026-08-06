import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  completeMiniGame,
  forceInterruption,
  getTestState,
  setDraft,
  touchCenter,
} from './support';

const DRAFT = 'The email draft must survive every mobile input handoff exactly as written.';
const CARET = 23;

async function startCompose(page: Page, seed: string): Promise<void> {
  await page.goto(`/?test=1&seed=${seed}`);
  await touchCenter(page, page.getByTestId('start-work'));
  await expect(page.getByTestId('compose-screen')).toBeVisible();
  await setDraft(page, DRAFT, CARET);
}

async function dispatchTouchPointer(
  page: Page,
  target: Locator | 'window',
  type: 'pointerdown' | 'pointerup' | 'pointercancel',
  pointerId: number,
): Promise<void> {
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId,
    pointerType: 'touch',
    isPrimary: pointerId === 71,
    buttons: type === 'pointerdown' ? 1 : 0,
    button: type === 'pointerdown' ? 0 : -1,
  };
  if (target === 'window') {
    await page.evaluate(({ eventType, eventInit }) => {
      window.dispatchEvent(new PointerEvent(eventType, eventInit));
    }, { eventType: type, eventInit: init });
    return;
  }
  await target.dispatchEvent(type, init);
}

async function dispatchTouchCancelFallback(page: Page, remainingTouches: number): Promise<void> {
  await page.evaluate((remaining) => {
    const event = new Event('touchcancel', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', {
      configurable: true,
      value: Array.from({ length: remaining }, () => ({})),
    });
    window.dispatchEvent(event);
  }, remainingTouches);
}

async function expectComposeRestored(page: Page): Promise<void> {
  await expect.poll(async () => (await getTestState(page)).phase, { timeout: 10_000 }).toBe('compose');
  const editor = page.getByTestId('reply-editor');
  await expect(editor).toHaveValue(DRAFT);
  await expect(editor).toBeFocused();
  expect(await editor.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    return [textarea.selectionStart, textarea.selectionEnd];
  })).toEqual([CARET, CARET]);
}

test('a finger already down at interruption time is quarantined without stranding briefing', async ({ page }) => {
  await startCompose(page, 'mobile-carry-over-touch');
  const editor = page.getByTestId('reply-editor');
  const layer = page.locator('#phaser-layer');
  const canvas = layer.locator('canvas');

  await dispatchTouchPointer(page, editor, 'pointerdown', 71);
  await forceInterruption(page, 'stamp-of-approval');

  await expect(layer).toHaveAttribute('data-mini-game-status', 'briefing');
  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 4_000 });
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'true');

  await dispatchTouchPointer(page, 'window', 'pointerup', 71);
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'false');
  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing');

  await completeMiniGame(page);
  await expectComposeRestored(page);
});

test('an orphaned touch cannot outlive the mini-game timeout or poison the next interruption', async ({ page }) => {
  await startCompose(page, 'mobile-orphaned-touch');
  const editor = page.getByTestId('reply-editor');
  const layer = page.locator('#phaser-layer');
  const canvas = layer.locator('canvas');

  await dispatchTouchPointer(page, editor, 'pointerdown', 71);
  await forceInterruption(page, 'stamp-of-approval');
  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 4_000 });
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'true');

  await expectComposeRestored(page);

  await forceInterruption(page, 'phone-transfer');
  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 4_000 });
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'false');
  await completeMiniGame(page);
  await expectComposeRestored(page);
});

test('multi-touch remains quarantined until every contact ends or cancels', async ({ page }) => {
  await startCompose(page, 'mobile-multi-touch');
  const layer = page.locator('#phaser-layer');
  const canvas = layer.locator('canvas');

  await forceInterruption(page, 'phone-transfer');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(100);
  await dispatchTouchPointer(page, canvas, 'pointerdown', 71);
  await dispatchTouchPointer(page, canvas, 'pointerdown', 72);

  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 4_000 });
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'true');

  await dispatchTouchPointer(page, 'window', 'pointerup', 71);
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'true');
  await dispatchTouchPointer(page, 'window', 'pointercancel', 72);
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'false');

  await completeMiniGame(page);
  await expectComposeRestored(page);
});

test('a partial touchcancel fallback cannot release another finger', async ({ page }) => {
  await startCompose(page, 'mobile-partial-touchcancel');
  const layer = page.locator('#phaser-layer');
  const canvas = layer.locator('canvas');

  await forceInterruption(page, 'phone-transfer');
  await expect(canvas).toBeVisible();
  await dispatchTouchPointer(page, canvas, 'pointerdown', 71);
  await dispatchTouchPointer(page, canvas, 'pointerdown', 72);
  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 4_000 });
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'true');

  await dispatchTouchCancelFallback(page, 1);
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'true');
  await dispatchTouchCancelFallback(page, 0);
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'false');

  await completeMiniGame(page);
  await expectComposeRestored(page);
});

test('composition-style mobile input starts the interruption system', async ({ page }) => {
  await page.goto('/?test=1&seed=mobile-composition-input');
  await touchCenter(page, page.getByTestId('start-work'));
  const editor = page.getByTestId('reply-editor');

  await editor.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.value = 'é';
    textarea.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: 'é',
      inputType: 'insertCompositionText',
    }));
  });

  await expect.poll(async () => (await getTestState(page)).interruptionStarted).toBe(true);
  await expect(editor).toHaveValue('é');
});

test('orientation changes rebuild the current mini-game for the readable layout', async ({ page }) => {
  await startCompose(page, 'mobile-orientation-change');
  const layer = page.locator('#phaser-layer');
  const canvas = layer.locator('canvas');

  await forceInterruption(page, 'expense-triage');
  await expect(layer).toHaveAttribute('data-mini-game-layout', 'portrait');
  await page.setViewportSize({ width: 844, height: 390 });

  await expect(layer).toHaveAttribute('data-mini-game-layout', 'landscape', { timeout: 2_000 });
  await expect(layer).toHaveAttribute('data-mini-game-status', 'briefing');
  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 4_000 });
  const bounds = await canvas.boundingBox();
  expect(bounds).toMatchObject({ x: 0, y: 0, width: 844, height: 390 });

  await completeMiniGame(page);
  await expectComposeRestored(page);
  const editorBounds = await page.getByTestId('reply-editor').boundingBox();
  expect(editorBounds).not.toBeNull();
  expect(editorBounds?.height ?? 0).toBeGreaterThanOrEqual(82);
  expect((editorBounds?.y ?? 0) + (editorBounds?.height ?? 0)).toBeLessThanOrEqual(390);
});

test('orientation changes during the outcome flash do not relaunch the mini-game', async ({ page }) => {
  await startCompose(page, 'mobile-ending-orientation-change');
  const layer = page.locator('#phaser-layer');

  await forceInterruption(page, 'stamp-of-approval');
  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 4_000 });
  await completeMiniGame(page);
  await page.setViewportSize({ width: 844, height: 390 });

  await expect.poll(async () => (await getTestState(page)).phase, { timeout: 1_500 }).toBe('compose');
  await expect(layer).not.toHaveClass(/\bactive\b/);
  await expectComposeRestored(page);
});

test('a natural scheduled interruption accepts a held touch without leaking it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-webkit', 'One natural-timer sample is sufficient.');
  test.setTimeout(45_000);
  await page.goto('/?test=1&seed=mobile-natural-held-touch');
  await touchCenter(page, page.getByTestId('start-work'));
  const editor = page.getByTestId('reply-editor');
  const layer = page.locator('#phaser-layer');
  const canvas = layer.locator('canvas');

  await editor.press('a');
  await page.waitForTimeout(9_500);
  await dispatchTouchPointer(page, editor, 'pointerdown', 71);

  await expect(layer).toHaveClass(/\bactive\b/, { timeout: 6_000 });
  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 4_000 });
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'true');
  await dispatchTouchPointer(page, 'window', 'pointerup', 71);
  await expect(canvas).toHaveAttribute('data-mini-game-input-quarantined', 'false');
  expect((await getTestState(page)).draft).toBe('a');

  await completeMiniGame(page);
  await expect(page.getByTestId('reply-editor')).toHaveValue('a');
});
