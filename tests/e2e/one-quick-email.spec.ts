import { expect, test, type Locator, type Page } from '@playwright/test';

import type { MiniGameId, MiniGameOutcome } from '../../src/game/types';

interface BrowserTestState {
  phase: 'title' | 'compose' | 'minigame' | 'inbox';
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
  await expect(page.getByText('Macrohard Office', { exact: true })).toBeVisible();
  await expect(page.getByText('Send a 150-word email.', { exact: true })).toBeVisible();
  await expect(page.getByText('Office Mail Setup', { exact: true })).toHaveCount(0);
  await expect(page.getByText('INTERNAL CORRESPONDENCE SYSTEM', { exact: true })).toHaveCount(0);
  await expect(page.getByText('1 task pending', { exact: true })).toHaveCount(0);
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

async function forceNextRotatedInterruption(page: Page): Promise<MiniGameId> {
  await page.evaluate(() => {
    const hook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.forceInterruption;
    if (!hook) throw new Error('Development forceInterruption hook is unavailable');
    hook();
  });
  await expect.poll(async () => (await getTestState(page)).phase).toBe('minigame');
  const id = (await getTestState(page)).activeMiniGame;
  if (!id) throw new Error('Rotated interruption did not select a mini-game');
  return id as MiniGameId;
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
  await setDraft(page, words(150));
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
  const paragraphCount = await page.getByTestId('incoming-email').locator('p').count();
  expect(paragraphCount).toBeGreaterThanOrEqual(5);
  expect(paragraphCount).toBeLessThanOrEqual(7);
  await expect(page.getByTestId('reply-brief')).toHaveCount(0);
  await expect(page.getByText('HOW TO REPLY')).toHaveCount(0);
  await expect(page.getByTestId('reply-editor')).toHaveAttribute('aria-describedby', 'word-requirement');
  await expect(page.getByTestId('word-count')).toHaveText('0 words');
  await expect(page.getByTestId('word-requirement')).toHaveText('150 words required');
  await expect(page.getByTestId('send-email')).toBeDisabled();
  await expect(page.locator('#compose-inbox-count')).toHaveText('(117)');
  await expect(page.getByTestId('player-mailbox')).toHaveText('Office Administration <admin@office.local>');
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

test('keeps Send disabled at 149 words and enables it at exactly 150', async ({ page }) => {
  await startScenario(page, 'send-threshold');
  const send = page.getByTestId('send-email');

  await setDraft(page, words(149));
  await expect(page.getByTestId('word-count')).toHaveText('149 words');
  await expect(page.getByTestId('word-requirement')).toHaveText('150 words required');
  await expect(send).toBeDisabled();

  await setDraft(page, words(150));
  await expect(page.getByTestId('word-count')).toHaveText('150 words');
  await expect(page.getByTestId('word-requirement')).toHaveText('Ready to send');
  await expect(send).toBeEnabled();
});

test('schedules every mini-game once in each shuffled block of nine', async ({ page }) => {
  test.setTimeout(45_000);
  await startScenario(page, 'complete-mini-game-bags');
  const expected = [
    'calendar-collision',
    'reply-all-intercept',
    'paper-jam',
    'hold-music-hero',
    'stamp-of-approval',
    'expense-triage',
    'quick-question',
    'phone-transfer',
    'badge-scan',
  ] satisfies MiniGameId[];
  const draws: MiniGameId[] = [];

  for (let index = 0; index < expected.length * 2; index += 1) {
    draws.push(await forceNextRotatedInterruption(page));
    await completeMiniGame(page, 'success');
    await expect.poll(async () => (await getTestState(page)).phase).toBe('compose');
  }

  expect([...draws.slice(0, expected.length)].sort()).toEqual([...expected].sort());
  expect([...draws.slice(expected.length)].sort()).toEqual([...expected].sort());
  expect(draws[expected.length]).not.toBe(draws[expected.length - 1]);
});

test('quarantines a typing key without extending briefing, then restores the exact draft and caret', async ({ page }) => {
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
    await expect(page.locator('#phaser-layer')).toHaveAttribute('data-mini-game-status', 'playing');
    await expect(page.locator('#phaser-layer canvas')).toHaveAttribute(
      'data-mini-game-keyboard-input-quarantined',
      'true',
    );
    await expect(editor).toHaveValue(draft);
    expect((await getTestState(page)).draft).toBe(draft);
  } finally {
    await page.keyboard.up('a');
  }

  await expect(page.locator('#phaser-layer canvas')).toHaveAttribute(
    'data-mini-game-keyboard-input-quarantined',
    'false',
  );
  await expect(page.locator('#phaser-layer')).toHaveAttribute('data-mini-game-status', 'playing');
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

test('shows 117 fixed inbox rows, then clearly announces and highlights the unread Re message', async ({ page }) => {
  await startScenario(page, 'real-reply-delay');
  const originalSubject = await page.getByTestId('incoming-subject').innerText();
  const sentAt = await sendReadyDraft(page);

  const backgroundRows = page.getByTestId('background-message');
  const newMessage = page.getByTestId('new-message-row');
  const notification = page.getByTestId('new-mail-notification');
  const playAgainPrompt = page.getByTestId('play-again-prompt');
  const playAgain = page.getByTestId('play-again');
  await expect(backgroundRows).toHaveCount(117);
  await expect(page.getByTestId('message-list').getByRole('listitem')).toHaveCount(117);
  await expect(page.locator('#inbox-count')).toHaveText('(117)');
  await expect(page.locator('#inbox-total')).toHaveText('117');
  await expect(newMessage).toHaveCount(0);
  await expect(notification).toBeHidden();
  await expect(playAgainPrompt).toBeHidden();
  await expect(playAgain).toBeHidden();

  const messageList = page.getByTestId('message-list');
  const initialScrollState = await messageList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(initialScrollState.scrollHeight).toBeGreaterThan(initialScrollState.clientHeight);
  expect(initialScrollState.scrollTop).toBe(0);
  expect(initialScrollState.overflowY).toBe('hidden');
  await messageList.hover();
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(100);
  expect(await messageList.evaluate((element) => element.scrollTop)).toBe(0);

  const timeUntilPreDeliveryCheck = Math.max(0, 5_250 - (Date.now() - sentAt));
  await page.waitForTimeout(timeUntilPreDeliveryCheck);
  await expect(newMessage).toHaveCount(0);
  await expect(playAgain).toBeHidden();
  await expect(newMessage).toHaveCount(1, { timeout: 2_000 });
  await expect(newMessage).toHaveClass(/\bbackground-message\b/);
  await expect(newMessage).toHaveClass(/\bunread\b/);
  await expect(newMessage).toHaveClass(/\bnew-message-arrival\b/);
  await expect(newMessage).not.toHaveClass(/\brecipient-reply\b/);
  await expect(newMessage.locator('.reply-marker')).toHaveCount(0);
  await expect(newMessage.locator('.message-subject')).toHaveText(`Re: ${originalSubject}`);
  expect(await newMessage.evaluate((element) => ({
    tagName: element.tagName,
    role: element.getAttribute('role'),
    tabIndex: (element as HTMLElement).tabIndex,
  }))).toEqual({ tagName: 'DIV', role: 'listitem', tabIndex: -1 });
  await expect(backgroundRows).toHaveCount(117);
  await expect(page.getByTestId('message-list').getByRole('listitem')).toHaveCount(118);
  await expect(page.locator('#inbox-count')).toHaveText('(118)');
  await expect(page.locator('#inbox-total')).toHaveText('118');
  await expect(notification).toContainText('New message received');
  await expect(notification).not.toHaveAttribute('hidden', '');
  await expect(playAgainPrompt).toBeVisible();
  await expect(playAgain).toBeVisible();

  expect(await newMessage.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
  await expect(newMessage).toHaveCSS('background-color', 'rgb(255, 240, 166)');

  expect(await page.locator('.inbox-toolbar').getByTestId('play-again').count()).toBe(0);
  const promptBox = await playAgainPrompt.boundingBox();
  const buttonBox = await playAgain.boundingBox();
  const viewport = page.viewportSize();
  expect(promptBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (promptBox && buttonBox && viewport) {
    expect(Math.abs(promptBox.x + promptBox.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(promptBox.y + promptBox.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(2);
    expect(buttonBox.width).toBeGreaterThanOrEqual(160);
    expect(buttonBox.height).toBeGreaterThanOrEqual(48);
  }
});

test('the new inbox row cannot open and Play Again selects a different scenario', async ({ page }) => {
  const firstScenarioId = await startScenario(page, 'inbox-and-replay');
  const firstIncomingEmail = await page.getByTestId('incoming-email').innerText();
  await sendReadyDraft(page);

  await skipInboxDelay(page);
  const newMessage = page.getByTestId('new-message-row');
  await expect(newMessage).toBeVisible();
  await newMessage.click();
  expect((await getTestState(page)).phase).toBe('inbox');
  await expect(page.getByTestId('reply-screen')).toHaveCount(0);
  await expect(page.getByTestId('sent-screen')).toHaveCount(0);
  await expect(page.getByTestId('view-sent')).toHaveCount(0);
  await page.getByTestId('play-again').click();

  await expect(page.getByTestId('compose-screen')).toBeVisible();
  const secondState = await getTestState(page);
  expect(secondState.scenarioId).not.toBe(firstScenarioId);
  await expect(page.getByTestId('incoming-email')).not.toHaveText(firstIncomingEmail);
});
