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
  await expect(page.getByTestId('mobile-inbox-note')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await skipInboxDelay(page);
  const replyRow = page.getByTestId('recipient-reply-row');
  await expect(replyRow).toBeVisible();
  await expectInsideViewport(page, replyRow);
  await touchCenter(page, replyRow);

  await expect(page.getByTestId('reply-screen')).toBeVisible();
  await expect(page.getByTestId('reply-context')).toContainText('Reply to the email you just sent');
  await expect(page.getByTestId('recipient-reply')).not.toBeEmpty();
  await expectInsideViewport(page, page.getByTestId('play-again'));
  await expectInsideViewport(page, page.getByTestId('view-sent'));
  await expectNoHorizontalOverflow(page);
});
