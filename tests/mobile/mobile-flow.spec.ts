import { expect, test } from '@playwright/test';

import {
  expectInsideViewport,
  expectMobileEnvironment,
  expectNoDesktopBlocker,
  expectNoHorizontalOverflow,
  setDraft,
  skipInboxDelay,
  touchCenter,
  words,
} from './support';

test('keeps the touch-driven email path usable at the exact phone viewport', async ({ page }, testInfo) => {
  await page.goto(`/?test=1&seed=mobile-flow-${testInfo.project.name}`);
  await expectMobileEnvironment(page, testInfo);
  await expectNoDesktopBlocker(page);

  const title = page.getByTestId('title-screen');
  const start = page.getByTestId('start-work');
  await expect(title).toBeVisible();
  await expectInsideViewport(page, start);
  await expectNoHorizontalOverflow(page);

  await touchCenter(page, start);

  const compose = page.getByTestId('compose-screen');
  const editor = page.getByTestId('reply-editor');
  const send = page.getByTestId('send-email');
  await expect(compose).toBeVisible();
  await expect(page.getByTestId('reply-brief')).toHaveCount(0);
  await expect(page.getByTestId('incoming-email')).toBeVisible();
  await expectInsideViewport(page, send);
  await expectNoDesktopBlocker(page);
  await expectNoHorizontalOverflow(page);

  await setDraft(page, words(99));
  await expect(page.getByTestId('word-count')).toHaveText('99 words');
  await expect(page.getByTestId('word-requirement')).toHaveText('100 words required');
  await expect(send).toBeDisabled();

  await touchCenter(page, editor);
  await expect(editor).toBeFocused();
  await setDraft(page, words(99));
  await page.keyboard.type(' final', { delay: 8 });

  await expect(editor).toHaveValue(`${words(99)} final`);
  await expect(page.getByTestId('word-count')).toHaveText('100 words');
  await expect(page.getByTestId('word-requirement')).toHaveText('Ready to send');
  await expect(send).toBeEnabled();

  await touchCenter(page, send);

  const inbox = page.getByTestId('inbox-screen');
  await expect(inbox).toBeVisible();
  await expect(page.getByTestId('play-again')).toBeHidden();
  await expect(page.getByTestId('play-again-prompt')).toBeHidden();
  await expect(page.getByTestId('new-mail-notification')).toBeHidden();
  await expectNoHorizontalOverflow(page);

  await skipInboxDelay(page);
  const newMessage = page.getByTestId('new-message-row');
  const notification = page.getByTestId('new-mail-notification');
  const playAgainPrompt = page.getByTestId('play-again-prompt');
  await expect(newMessage).toBeVisible();
  await expect(newMessage).toHaveClass(/\bnew-message-arrival\b/);
  await expect(newMessage).toHaveCSS('background-color', 'rgb(255, 240, 166)');
  await expectInsideViewport(page, newMessage);
  await expect(notification).toContainText('New message received');
  await expect(notification).not.toHaveAttribute('hidden', '');
  await expectInsideViewport(page, notification);
  await expect(playAgainPrompt).toBeVisible();
  await expectInsideViewport(page, playAgainPrompt);
  await touchCenter(page, newMessage);

  await expect(inbox).toBeVisible();
  await expect(page.getByTestId('reply-screen')).toHaveCount(0);
  const playAgain = page.getByTestId('play-again');
  await expectInsideViewport(page, playAgain);
  expect(await page.locator('.inbox-toolbar').getByTestId('play-again').count()).toBe(0);
  const buttonBox = await playAgain.boundingBox();
  expect(buttonBox).not.toBeNull();
  if (buttonBox) {
    expect(buttonBox.width).toBeGreaterThanOrEqual(160);
    expect(buttonBox.height).toBeGreaterThanOrEqual(48);
  }
  await expectNoHorizontalOverflow(page);

  await touchCenter(page, playAgain);
  await expect(page.getByTestId('compose-screen')).toBeVisible();
});
