import { expect, test, type Page } from '@playwright/test';

import type { MiniGameId, MiniGameOutcome } from '../../src/game/types';

interface AttachmentHuntTestHooks {
  forceInterruption?: (id?: MiniGameId) => void;
  completeMiniGame?: (outcome?: MiniGameOutcome) => void;
  setDraft?: (text: string, caret?: number) => void;
  getState?: () => { phase: string; draft: string };
}

type TestWindow = Window & { __ONE_QUICK_EMAIL_TEST__?: AttachmentHuntTestHooks };

const ATTACHMENT_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [380, 400],
  [720, 400],
  [1060, 400],
  [380, 650],
  [720, 650],
  [1060, 650],
];

async function startCompose(page: Page): Promise<void> {
  await page.goto('/?test=1&seed=attachment-hunt-pointer-events');
  await page.getByTestId('start-work').click();
  await expect(page.getByTestId('compose-screen')).toBeVisible();
}

async function startAttachmentHunt(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.forceInterruption;
    if (!hook) throw new Error('Development forceInterruption hook is unavailable');
    hook('attachment-hunt');
  });
  await expect(page.locator('#phaser-layer')).toHaveAttribute('data-mini-game-status', 'playing', {
    timeout: 4_000,
  });
}

async function finishCurrentMiniGame(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.completeMiniGame;
    if (!hook) throw new Error('Development completeMiniGame hook is unavailable');
    hook('success');
  });
  await expect.poll(async () => page.evaluate(
    () => (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.getState?.()?.phase,
  )).toBe('compose');
}

async function attachmentWindowCenter(page: Page, index: number): Promise<{ x: number; y: number }> {
  const slot = ATTACHMENT_SLOTS[index];
  if (!slot) throw new RangeError(`Unknown Attachment Hunt slot: ${index}`);
  const box = await page.locator('#phaser-layer canvas').boundingBox();
  if (!box) throw new Error('Mini-game canvas has no bounds');
  const scale = Math.min(box.width / 1_440, box.height / 900);
  return {
    x: box.x + (box.width - 1_440 * scale) / 2 + slot[0] * scale,
    y: box.y + (box.height - 900 * scale) / 2 + slot[1] * scale,
  };
}

async function targetIndex(page: Page): Promise<number> {
  const value = await page.locator('#phaser-layer canvas')
    .getAttribute('data-attachment-hunt-target-index');
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= ATTACHMENT_SLOTS.length) {
    throw new Error(`Invalid Attachment Hunt target index: ${String(value)}`);
  }
  return index;
}

async function waitForActiveShuffle(page: Page): Promise<void> {
  const canvas = page.locator('#phaser-layer canvas');
  await expect.poll(async () => canvas.evaluate((element) => ({
    hasShuffled: Number((element as HTMLCanvasElement).dataset.attachmentHuntShuffleGeneration) >= 1,
    moving: (element as HTMLCanvasElement).dataset.attachmentHuntShuffleInProgress,
  })), { intervals: [16] }).toEqual({ hasShuffled: true, moving: 'true' });
}

async function currentTargetCenter(page: Page): Promise<{ x: number; y: number }> {
  const canvas = page.locator('#phaser-layer canvas');
  const logicalCenter = await canvas.getAttribute('data-attachment-hunt-target-center');
  const [logicalX, logicalY] = logicalCenter?.split(',').map(Number) ?? [];
  if (!Number.isFinite(logicalX) || !Number.isFinite(logicalY)) {
    throw new Error(`Invalid Attachment Hunt target center: ${String(logicalCenter)}`);
  }
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Mini-game canvas has no bounds');
  const scale = Math.min(box.width / 1_440, box.height / 900);
  return {
    x: box.x + (box.width - 1_440 * scale) / 2 + logicalX * scale,
    y: box.y + (box.height - 900 * scale) / 2 + logicalY * scale,
  };
}

test('Attachment Hunt commits the pressed moving window and distinguishes wrong choices', async ({ page }) => {
  await startCompose(page);
  const canvas = page.locator('#phaser-layer canvas');
  const layer = page.locator('#phaser-layer');
  const editor = page.getByTestId('reply-editor');
  const draft = 'The moving attachment must not disturb this exact draft.';
  const caret = 18;
  await page.evaluate(({ text, position }) => {
    const hook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.setDraft;
    if (!hook) throw new Error('Development setDraft hook is unavailable');
    hook(text, position);
  }, { text: draft, position: caret });

  await startAttachmentHunt(page);
  const firstTarget = await targetIndex(page);
  const decoy = await attachmentWindowCenter(page, (firstTarget + 1) % ATTACHMENT_SLOTS.length);
  await page.mouse.click(decoy.x, decoy.y);
  await expect(canvas).toHaveAttribute('data-attachment-hunt-last-choice', 'incorrect');
  await expect(layer).toHaveAttribute('data-mini-game-status', 'playing');
  await finishCurrentMiniGame(page);

  await startAttachmentHunt(page);
  await waitForActiveShuffle(page);
  await page.waitForTimeout(210);
  const secondTarget = await currentTargetCenter(page);
  await page.mouse.click(secondTarget.x, secondTarget.y);
  await expect(canvas).toHaveAttribute('data-attachment-hunt-last-choice', 'correct');
  await expect.poll(async () => page.evaluate(
    () => (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.getState?.()?.phase,
  )).toBe('compose');
  await expect(layer).toHaveAttribute('data-mini-game-status', 'success');
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue(draft);
  expect(await editor.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    return [textarea.selectionStart, textarea.selectionEnd];
  })).toEqual([caret, caret]);
});
