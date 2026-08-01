import { describe, expect, it } from 'vitest';

import { attachEditorGuards } from '../../src/game/editorGuards';

class FakeTextArea extends EventTarget {
  selectionStart = 0;
  selectionEnd = 0;
  selectionDirection: 'forward' | 'backward' | 'none' = 'none';

  setSelectionRange(start: number, end: number, direction: 'forward' | 'backward' | 'none' = 'none'): void {
    this.selectionStart = start;
    this.selectionEnd = end;
    this.selectionDirection = direction;
  }
}

function dispatch(
  target: EventTarget,
  type: string,
  properties: Readonly<Record<string, unknown>> = {},
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  for (const [name, value] of Object.entries(properties)) {
    Object.defineProperty(event, name, { configurable: true, value });
  }
  target.dispatchEvent(event);
  return event;
}

function guardedTextArea(): { fake: FakeTextArea; teardown: () => void } {
  const fake = new FakeTextArea();
  return {
    fake,
    teardown: attachEditorGuards(fake as unknown as HTMLTextAreaElement),
  };
}

describe('editor guards', () => {
  it.each(['paste', 'copy', 'cut', 'dragstart', 'dragover', 'drop', 'contextmenu'])(
    'blocks the %s event',
    (eventName) => {
      const { fake } = guardedTextArea();
      expect(dispatch(fake, eventName).defaultPrevented).toBe(true);
    },
  );

  it.each([
    ['Control+A', { ctrlKey: true, metaKey: false, shiftKey: false, key: 'a' }],
    ['Command+C', { ctrlKey: false, metaKey: true, shiftKey: false, key: 'c' }],
    ['Control+X', { ctrlKey: true, metaKey: false, shiftKey: false, key: 'X' }],
    ['Command+V', { ctrlKey: false, metaKey: true, shiftKey: false, key: 'v' }],
    ['Control+Z', { ctrlKey: true, metaKey: false, shiftKey: false, key: 'z' }],
    ['Command+Y', { ctrlKey: false, metaKey: true, shiftKey: false, key: 'y' }],
    ['Command+Shift+Z', { ctrlKey: false, metaKey: true, shiftKey: true, key: 'Z' }],
    ['Control+Insert', { ctrlKey: true, metaKey: false, shiftKey: false, key: 'Insert' }],
    ['Shift+Insert', { ctrlKey: false, metaKey: false, shiftKey: true, key: 'Insert' }],
    ['Shift+Delete', { ctrlKey: false, metaKey: false, shiftKey: true, key: 'Delete' }],
  ])('blocks %s', (_label, properties) => {
    const { fake } = guardedTextArea();
    expect(dispatch(fake, 'keydown', properties).defaultPrevented).toBe(true);
  });

  it.each([
    'insertFromPaste',
    'insertFromPasteAsQuotation',
    'insertFromDrop',
    'insertFromYank',
    'insertReplacementText',
    'historyUndo',
    'historyRedo',
    'deleteByCut',
    'deleteByDrag',
  ])('blocks beforeinput type %s', (inputType) => {
    const { fake } = guardedTextArea();
    expect(dispatch(fake, 'beforeinput', { inputType }).defaultPrevented).toBe(true);
  });

  it('keeps ordinary typing, navigation, and deletion available', () => {
    const { fake } = guardedTextArea();
    expect(dispatch(fake, 'keydown', { ctrlKey: false, metaKey: false, key: 'a' }).defaultPrevented)
      .toBe(false);
    expect(dispatch(fake, 'keydown', { ctrlKey: false, metaKey: false, key: 'ArrowLeft' }).defaultPrevented)
      .toBe(false);
    expect(dispatch(fake, 'keydown', { ctrlKey: false, metaKey: false, key: 'Backspace' }).defaultPrevented)
      .toBe(false);
    expect(dispatch(fake, 'beforeinput', { inputType: 'insertText' }).defaultPrevented).toBe(false);
    expect(dispatch(fake, 'beforeinput', { inputType: 'deleteContentBackward' }).defaultPrevented)
      .toBe(false);
  });

  it('collapses forward and backward selections at the active caret edge', () => {
    const { fake } = guardedTextArea();
    fake.selectionStart = 2;
    fake.selectionEnd = 8;
    fake.selectionDirection = 'forward';
    dispatch(fake, 'select');
    expect([fake.selectionStart, fake.selectionEnd]).toEqual([8, 8]);

    fake.selectionStart = 3;
    fake.selectionEnd = 9;
    fake.selectionDirection = 'backward';
    dispatch(fake, 'select');
    expect([fake.selectionStart, fake.selectionEnd]).toEqual([3, 3]);
  });

  it('tears down every guard', () => {
    const { fake, teardown } = guardedTextArea();
    teardown();

    expect(dispatch(fake, 'paste').defaultPrevented).toBe(false);
    expect(dispatch(fake, 'keydown', { ctrlKey: true, metaKey: false, key: 'v' }).defaultPrevented)
      .toBe(false);
    expect(dispatch(fake, 'beforeinput', { inputType: 'historyUndo' }).defaultPrevented)
      .toBe(false);
    fake.selectionStart = 1;
    fake.selectionEnd = 4;
    dispatch(fake, 'select');
    expect([fake.selectionStart, fake.selectionEnd]).toEqual([1, 4]);
  });
});
