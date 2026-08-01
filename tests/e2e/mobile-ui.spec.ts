import { expect, test, type Locator, type Page } from '@playwright/test';

interface MobileTestHooks {
  setDraft?: (text: string, caret?: number) => void;
  skipInboxDelay?: () => void;
}

type TestWindow = Window & {
  __ONE_QUICK_EMAIL_TEST__?: MobileTestHooks;
};

const PHONE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const;

const words = (count: number): string => Array.from(
  { length: count },
  (_, index) => `word${index + 1}`,
).join(' ');

async function expectWithinViewport(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectPageContained(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight);
}

async function setReadyDraft(page: Page): Promise<void> {
  await page.evaluate((draft) => {
    const setDraft = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.setDraft;
    if (!setDraft) throw new Error('Development setDraft hook is unavailable');
    setDraft(draft);
  }, words(100));
}

async function skipInboxDelay(page: Page): Promise<void> {
  await page.evaluate(() => {
    const skipDelay = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.skipInboxDelay;
    if (!skipDelay) throw new Error('Development skipInboxDelay hook is unavailable');
    skipDelay();
  });
}

for (const viewport of PHONE_VIEWPORTS) {
  test(`keeps the complete email flow usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/?test=1&seed=mobile-${viewport.width}`);

    await expect(page.getByText('Desktop required')).toHaveCount(0);
    await expect(page.getByTestId('title-screen')).toBeVisible();
    const startButton = page.getByTestId('start-work');
    await expect(startButton).toBeVisible();
    await expectWithinViewport(page, startButton);
    expect((await startButton.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expectPageContained(page);

    await startButton.click();

    const replyBrief = page.getByTestId('reply-brief');
    const editor = page.getByTestId('reply-editor');
    const sendButton = page.getByTestId('send-email');
    await expect(page.getByTestId('compose-screen')).toBeVisible();
    await expect(replyBrief).toBeVisible();
    await expect(replyBrief.locator('li')).toHaveCount(3);
    await expect(editor).toBeVisible();
    await expectWithinViewport(page, editor);
    expect((await editor.boundingBox())?.height).toBeGreaterThanOrEqual(180);
    expect((await sendButton.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expectPageContained(page);

    await setReadyDraft(page);
    await sendButton.click();

    const inboxNote = page.getByTestId('mobile-inbox-note');
    await expect(page.getByTestId('inbox-screen')).toBeVisible();
    await expect(inboxNote).toBeVisible();
    await expect(inboxNote).toContainText('reply will appear at the top');
    await expectWithinViewport(page, inboxNote);
    await expectPageContained(page);

    await skipInboxDelay(page);
    const recipientReply = page.getByTestId('recipient-reply-row');
    await expect(recipientReply).toBeVisible();
    await expect(inboxNote).toContainText('reply has arrived');
    expect((await recipientReply.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await recipientReply.click();

    const replyContext = page.getByTestId('reply-context');
    const playAgain = page.getByTestId('play-again');
    const viewSent = page.getByTestId('view-sent');
    await expect(page.getByTestId('reply-screen')).toBeVisible();
    await expect(replyContext).toContainText('Reply to the email you just sent');
    await expectWithinViewport(page, replyContext);
    await expectWithinViewport(page, playAgain);
    await expectWithinViewport(page, viewSent);
    expect((await playAgain.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await viewSent.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expectPageContained(page);

    await viewSent.click();
    await expect(page.getByTestId('sent-screen')).toBeVisible();
    await expect(page.getByTestId('sent-email-body')).toBeVisible();
    await expectWithinViewport(page, page.getByRole('button', { name: 'Return to Reply' }));
    await expectPageContained(page);
  });
}
