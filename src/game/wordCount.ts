export const DEFAULT_SEND_WORD_MINIMUM = 150;

// Count lexical tokens rather than whitespace chunks so punctuation and emoji do
// not inflate the total. Apostrophes and dashes only remain part of a word when
// they join two letters or numbers.
const WORD_TOKEN_PATTERN = /[\p{L}\p{N}]+(?:['\u2019\u2010-\u2015-][\p{L}\p{N}]+)*/gu;

export function tokenizeWords(text: string): string[] {
  return text.match(WORD_TOKEN_PATTERN) ?? [];
}

export function countWords(text: string): number {
  return tokenizeWords(text).length;
}

export function canSend(text: string, minimum = DEFAULT_SEND_WORD_MINIMUM): boolean {
  if (!Number.isInteger(minimum) || minimum < 0) {
    throw new RangeError('minimum must be a non-negative integer');
  }

  return countWords(text) >= minimum;
}
