import { expect, test, type Locator, type Page } from '@playwright/test';

type MiniGameId = 'paper-jam' | 'quick-question';
type MiniGameOutcome = 'success' | 'timeout';

interface BrowserTestState {
  phase: 'title' | 'compose' | 'minigame' | 'inbox' | 'reply' | 'sent';
  draft: string;
  scenarioId: string | null;
  activeMiniGame: string | null;
}

interface BrowserTestHooks {
  forceInterruption?: (id?: MiniGameId) => void;
  completeMiniGame?: (outcome?: MiniGameOutcome) => void;
  setDraft?: (text: string, caret?: number) => void;
  skipInboxDelay?: () => void;
  getState?: () => BrowserTestState;
}

type TestWindow = Window & {
  __ONE_QUICK_EMAIL_TEST__?: BrowserTestHooks;
};

const words = (count: number): string => Array.from({ length: count }, (_, index) => `word${index + 1}`).join(' ');

async function startScenario(page: Page, seed: string): Promise<string> {
  await page.goto(`/?test=1&seed=${encodeURIComponent(seed)}`);

  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ONE QUICK EMAIL' })).toBeVisible();
  await page.getByTestId('start-work').click();

  await expect(page.getByTestId('compose-screen')).toBeVisible();
  await expect(page.getByTestId('incoming-email')).not.toBeEmpty();
  await expect(page.getByTestId('reply-editor')).toBeFocused();

  const state = await getTestState(page);
  expect(state.phase).toBe('compose');
  expect(state.scenarioId).not.toBeNull();
  return state.scenarioId as string;
}

async function getTestState(page: Page): Promise<BrowserTestState> {
  return page.evaluate(() => {
    const state = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.getState?.();
    if (!state) throw new Error('Development test state is unavailable');
    return state;
  });
}

async function setDraft(page: Page, text: string, caret = text.length): Promise<void> {
  await page.evaluate(({ draft, position }) => {
    const hook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.setDraft;
    if (!hook) throw new Error('Development setDraft hook is unavailable');
    hook(draft, position);
  }, { draft: text, position: caret });
}

async function forceInterruption(page: Page, id: MiniGameId): Promise<void> {
  await page.evaluate((miniGameId) => {
    const hook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.forceInterruption;
    if (!hook) throw new Error('Development forceInterruption hook is unavailable');
    hook(miniGameId);
  }, id);
}

async function completeMiniGame(page: Page, outcome: MiniGameOutcome): Promise<void> {
  await page.evaluate((miniGameOutcome) => {
    const hook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.completeMiniGame;
    if (!hook) throw new Error('Development completeMiniGame hook is unavailable');
    hook(miniGameOutcome);
  }, outcome);
}

async function skipInboxDelay(page: Page): Promise<void> {
  await page.evaluate(() => {
    const hook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.skipInboxDelay;
    if (!hook) throw new Error('Development skipInboxDelay hook is unavailable');
    hook();
  });
}

async function sendReadyDraft(page: Page): Promise<number> {
  await setDraft(page, words(100));
  await expect(page.getByTestId('send-email')).toBeEnabled();
  const sentAt = Date.now();
  await page.getByTestId('send-email').click();
  await expect(page.getByTestId('inbox-screen')).toBeVisible();
  return sentAt;
}

async function preventedEvents(editor: Locator, eventTypes: readonly string[]): Promise<Record<string, boolean>> {
  return editor.evaluate((element, types) => Object.fromEntries(types.map((type) => {
    const event = type.startsWith('history')
      ? new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: type })
      : new ClipboardEvent(type, { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return [type, event.defaultPrevented];
  })), eventTypes);
}

test('loads the title screen and starts a deterministic email scenario', async ({ page }) => {
  const scenarioId = await startScenario(page, 'load-and-start');

  expect(scenarioId.length).toBeGreaterThan(0);
  await expect(page.getByTestId('incoming-email').locator('p')).toHaveCount(4);
  await expect(page.getByTestId('reply-brief')).toHaveCount(0);
  await expect(page.getByText('HOW TO REPLY')).toHaveCount(0);
  await expect(page.getByTestId('reply-editor')).toHaveAttribute('aria-describedby', 'word-requirement');
  await expect(page.getByTestId('word-count')).toHaveText('0 words');
  await expect(page.getByTestId('word-requirement')).toHaveText('100 words required');
  await expect(page.getByTestId('send-email')).toBeDisabled();
});

test('allows typing and Backspace while blocking paste, copy, cut, undo, and redo', async ({ page }) => {
  await startScenario(page, 'editor-actions');
  const editor = page.getByTestId('reply-editor');

  await editor.pressSequentially('ordinary typing!');
  await editor.press('Backspace');
  await expect(editor).toHaveValue('ordinary typing');
  await expect(page.getByTestId('word-count')).toHaveText('2 words');

  await page.evaluate(async () => navigator.clipboard.writeText(' pasted text'));
  await editor.press('ControlOrMeta+V');
  await expect(editor).toHaveValue('ordinary typing');

  expect(await preventedEvents(editor, ['paste', 'copy', 'cut', 'historyUndo', 'historyRedo']))
    .toEqual({
      paste: true,
      copy: true,
      cut: true,
      historyUndo: true,
      historyRedo: true,
    });

  await editor.press('ControlOrMeta+Z');
  await editor.press('ControlOrMeta+Y');
  await editor.press('ControlOrMeta+Shift+Z');
  await expect(editor).toHaveValue('ordinary typing');
});

test('blocks dropped text and collapses forward and backward selections', async ({ page }) => {
  await startScenario(page, 'drop-and-selection');
  const editor = page.getByTestId('reply-editor');
  await editor.pressSequentially('selection cannot persist');

  const dropPrevented = await editor.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.setData('text/plain', 'dropped text');
    const event = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(dropPrevented).toBe(true);
  await expect(editor).toHaveValue('selection cannot persist');

  const selections = await editor.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 9, 'forward');
    textarea.dispatchEvent(new Event('select', { bubbles: true }));
    const forward = [textarea.selectionStart, textarea.selectionEnd];

    textarea.setSelectionRange(2, 11, 'backward');
    textarea.dispatchEvent(new Event('select', { bubbles: true }));
    const backward = [textarea.selectionStart, textarea.selectionEnd];
    return { forward, backward };
  });

  expect(selections.forward).toEqual([9, 9]);
  expect(selections.backward).toEqual([2, 2]);
});

test('keeps Send disabled at 99 words and enables it at exactly 100', async ({ page }) => {
  await startScenario(page, 'send-threshold');
  const send = page.getByTestId('send-email');

  await setDraft(page, words(99));
  await expect(page.getByTestId('word-count')).toHaveText('99 words');
  await expect(page.getByTestId('word-requirement')).toHaveText('100 words required');
  await expect(send).toBeDisabled();

  await setDraft(page, words(100));
  await expect(page.getByTestId('word-count')).toHaveText('100 words');
  await expect(page.getByTestId('word-requirement')).toHaveText('Ready to send');
  await expect(send).toBeEnabled();
});

test('holds a typing key through briefing, then restores the exact draft and caret', async ({ page }) => {
  await startScenario(page, 'forced-interruption');
  const editor = page.getByTestId('reply-editor');
  await editor.pressSequentially('typing starts the interruption clock');

  const draftBeforeHeldKey = 'This draft and its exact caret position must survive the interruption.';
  const caretBeforeHeldKey = 19;
  const draft = `${draftBeforeHeldKey.slice(0, caretBeforeHeldKey)}a${draftBeforeHeldKey.slice(caretBeforeHeldKey)}`;
  const caret = caretBeforeHeldKey + 1;
  await setDraft(page, draftBeforeHeldKey, caretBeforeHeldKey);

  await page.keyboard.down('a');
  try {
    await expect(editor).toHaveValue(draft);
    await forceInterruption(page, 'paper-jam');

    await expect.poll(async () => (await getTestState(page)).phase).toBe('minigame');
    await expect(page.locator('#phaser-layer')).toHaveClass(/\bactive\b/);
    await expect(page.locator('#phaser-layer')).toHaveAttribute('data-mini-game', 'paper-jam');
    await expect(page.locator('#phaser-layer')).toHaveAttribute('data-mini-game-status', 'briefing');
    await expect(page.locator('#phaser-layer canvas')).toBeVisible();

    const mute = page.locator('#mute-toggle');
    await expect(mute).toBeVisible();
    await expect(mute).toBeEnabled();
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press('d');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(2_050);
    await expect(page.locator('#phaser-layer')).toHaveAttribute('data-mini-game-status', 'briefing');
    await expect(editor).toHaveValue(draft);
    expect((await getTestState(page)).draft).toBe(draft);
  } finally {
    await page.keyboard.up('a');
  }

  await expect(page.locator('#phaser-layer')).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 1_500 });
  await page.keyboard.press('a');
  await page.keyboard.press('d');
  await page.keyboard.press('a');
  await page.keyboard.press('Backspace');
  await expect(editor).toHaveValue(draft);
  expect((await getTestState(page)).draft).toBe(draft);

  await completeMiniGame(page, 'success');
  await expect.poll(async () => (await getTestState(page)).phase, { timeout: 2_500 }).toBe('compose');
  await expect(page.locator('#phaser-layer')).not.toHaveClass(/\bactive\b/);
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue(draft);
  expect(await editor.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    return [textarea.selectionStart, textarea.selectionEnd];
  })).toEqual([caret, caret]);
});

test('waits for a held Quick Question key to be released before restoring editor focus', async ({ page }) => {
  await startScenario(page, 'held-mini-game-key');
  const editor = page.getByTestId('reply-editor');
  await editor.pressSequentially('typing starts before the interruption');

  const draft = 'A held movement key must not alter this exact draft.';
  const caret = 14;
  await setDraft(page, draft, caret);
  await forceInterruption(page, 'quick-question');

  await expect.poll(async () => (await getTestState(page)).phase).toBe('minigame');
  await expect(page.locator('#phaser-layer')).toHaveAttribute('data-mini-game', 'quick-question');
  await expect(page.locator('#phaser-layer')).toHaveAttribute('data-mini-game-status', 'briefing');
  await expect(page.locator('#phaser-layer')).toHaveAttribute('data-mini-game-status', 'playing', { timeout: 3_000 });

  await page.keyboard.down('a');
  try {
    await completeMiniGame(page, 'success');
    await expect.poll(async () => (await getTestState(page)).phase, { timeout: 2_500 }).toBe('compose');

    await page.waitForTimeout(200);
    await expect(editor).not.toBeFocused();
    await page.keyboard.down('a');
    await page.waitForTimeout(150);
    await page.keyboard.down('a');
  } finally {
    await page.keyboard.up('a');
  }

  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue(draft);
  expect((await getTestState(page)).draft).toBe(draft);
  expect(await editor.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    return [textarea.selectionStart, textarea.selectionEnd];
  })).toEqual([caret, caret]);
});

test('starts with 117 background messages and inserts the marked recipient reply after twelve seconds', async ({ page }) => {
  await startScenario(page, 'real-reply-delay');
  const sentAt = await sendReadyDraft(page);

  const backgroundRows = page.getByTestId('background-message');
  const recipientReply = page.getByTestId('recipient-reply-row');
  await expect(backgroundRows).toHaveCount(117);
  await expect(page.getByTestId('message-list').getByRole('listitem')).toHaveCount(117);
  await expect(page.locator('#inbox-count')).toHaveText('(117)');
  await expect(page.locator('#inbox-total')).toHaveText('117');
  await expect(recipientReply).toHaveCount(0);

  const timeUntilPreDeliveryCheck = Math.max(0, 10_750 - (Date.now() - sentAt));
  await page.waitForTimeout(timeUntilPreDeliveryCheck);
  await expect(recipientReply).toHaveCount(0);
  await expect(recipientReply).toHaveCount(1, { timeout: 3_000 });
  await expect(recipientReply.locator('.reply-marker')).toHaveText('REPLY TO YOUR SENT EMAIL');
  await expect(backgroundRows).toHaveCount(117);
  await expect(page.getByTestId('message-list').getByRole('listitem')).toHaveCount(118);
  await expect(page.locator('#inbox-count')).toHaveText('(118)');
  await expect(page.locator('#inbox-total')).toHaveText('118');
});

test('opens the reply and Play Again selects a different scenario', async ({ page }) => {
  const firstScenarioId = await startScenario(page, 'reply-and-replay');
  const firstIncomingEmail = await page.getByTestId('incoming-email').innerText();
  await sendReadyDraft(page);

  await skipInboxDelay(page);
  const replyRow = page.getByTestId('recipient-reply-row');
  await expect(replyRow).toBeVisible();
  await expect(replyRow.locator('.reply-marker')).toHaveText('REPLY TO YOUR SENT EMAIL');
  await replyRow.click();

  await expect(page.getByTestId('reply-screen')).toBeVisible();
  await expect(page.getByTestId('reply-context')).toContainText('Reply to the email you just sent');
  await expect(page.getByTestId('reply-context')).toContainText('Your sent subject: Re:');
  await expect(page.getByTestId('recipient-reply')).not.toBeEmpty();
  await page.getByTestId('play-again').click();

  await expect(page.getByTestId('compose-screen')).toBeVisible();
  const secondState = await getTestState(page);
  expect(secondState.scenarioId).not.toBe(firstScenarioId);
  await expect(page.getByTestId('incoming-email')).not.toHaveText(firstIncomingEmail);
});
