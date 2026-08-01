const BLOCKED_TRANSFER_EVENTS = [
  'paste',
  'copy',
  'cut',
  'dragstart',
  'dragover',
  'drop',
  'contextmenu',
] as const;

const BLOCKED_SHORTCUT_KEYS = new Set(['a', 'c', 'x', 'v', 'z', 'y']);
const BLOCKED_INPUT_TYPES = new Set([
  'insertFromPaste',
  'insertFromPasteAsQuotation',
  'insertFromDrop',
  'insertFromYank',
  'insertReplacementText',
  'historyUndo',
  'historyRedo',
  'deleteByCut',
  'deleteByDrag',
]);

export function attachEditorGuards(textarea: HTMLTextAreaElement): () => void {
  const preventDefault = (event: Event): void => {
    event.preventDefault();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && BLOCKED_SHORTCUT_KEYS.has(event.key.toLowerCase())) {
      event.preventDefault();
      return;
    }

    if (event.key === 'Insert' && (event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      return;
    }

    if (event.key === 'Delete' && event.shiftKey) {
      event.preventDefault();
    }
  };

  const handleBeforeInput = (event: InputEvent): void => {
    if (BLOCKED_INPUT_TYPES.has(event.inputType)) {
      event.preventDefault();
    }
  };

  let collapsingSelection = false;
  const handleSelect = (): void => {
    if (collapsingSelection || textarea.selectionStart === textarea.selectionEnd) {
      return;
    }

    const caret = textarea.selectionDirection === 'backward'
      ? textarea.selectionStart
      : textarea.selectionEnd;
    collapsingSelection = true;
    try {
      textarea.setSelectionRange(caret, caret, 'none');
    } finally {
      collapsingSelection = false;
    }
  };

  for (const eventName of BLOCKED_TRANSFER_EVENTS) {
    textarea.addEventListener(eventName, preventDefault);
  }
  textarea.addEventListener('keydown', handleKeyDown);
  textarea.addEventListener('beforeinput', handleBeforeInput);
  textarea.addEventListener('select', handleSelect);

  return () => {
    for (const eventName of BLOCKED_TRANSFER_EVENTS) {
      textarea.removeEventListener(eventName, preventDefault);
    }
    textarea.removeEventListener('keydown', handleKeyDown);
    textarea.removeEventListener('beforeinput', handleBeforeInput);
    textarea.removeEventListener('select', handleSelect);
  };
}
