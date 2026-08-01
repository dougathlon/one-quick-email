import type { EmailScenario, ScenarioMatter } from './types';
import { tokenizeWords } from './wordCount';

function normalizeForMatching(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en-US')
    .match(/[\p{L}\p{N}]+/gu)
    ?.join(' ') ?? '';
}

function containsTerm(normalizedText: string, term: string): boolean {
  const normalizedTerm = normalizeForMatching(term);
  if (normalizedTerm.length === 0) {
    return false;
  }

  if (` ${normalizedText} `.includes(` ${normalizedTerm} `)) {
    return true;
  }

  const textTokens = normalizedText.split(' ');
  const termTokens = normalizedTerm.split(' ');
  for (let start = 0; start <= textTokens.length - termTokens.length; start += 1) {
    const matches = termTokens.every((termToken, offset) => {
      const textToken = textTokens[start + offset];
      return textToken !== undefined && areSimpleInflections(termToken, textToken);
    });
    if (matches) {
      return true;
    }
  }

  return false;
}

function areSimpleInflections(first: string, second: string): boolean {
  if (first === second) {
    return true;
  }

  const pluralForms = (word: string): readonly string[] => {
    if (word.length < 3) {
      return [];
    }
    if (word.endsWith('y') && !/[aeiou]y$/u.test(word)) {
      return [`${word.slice(0, -1)}ies`];
    }
    if (/(?:s|x|z|ch|sh)$/u.test(word)) {
      return [`${word}es`, `${word}s`];
    }
    return [`${word}s`];
  };

  return pluralForms(first).includes(second) || pluralForms(second).includes(first);
}

function matterIsCovered(matter: ScenarioMatter, normalizedText: string): boolean {
  return matter.keywordGroups.length > 0
    && matter.keywordGroups.every(
      (group) => group.length > 0 && group.some((term) => containsTerm(normalizedText, term)),
    );
}

export function detectCoverage(scenario: EmailScenario, text: string): boolean[] {
  const normalizedText = normalizeForMatching(text);
  return scenario.matters.map((matter) => matterIsCovered(matter, normalizedText));
}

function hasLowLexicalDiversity(words: readonly string[]): boolean {
  if (words.length < 60) {
    return false;
  }

  return new Set(words).size / words.length <= 0.12;
}

function hasDominantToken(words: readonly string[]): boolean {
  if (words.length < 20) {
    return false;
  }

  const frequencies = new Map<string, number>();
  let highest = 0;
  for (const word of words) {
    const frequency = (frequencies.get(word) ?? 0) + 1;
    frequencies.set(word, frequency);
    highest = Math.max(highest, frequency);
  }

  return highest / words.length >= 0.35;
}

function hasRepeatedShortPhrase(words: readonly string[]): boolean {
  if (words.length < 40) {
    return false;
  }

  for (let size = 2; size <= 5; size += 1) {
    const frequencies = new Map<string, number>();
    for (let index = 0; index <= words.length - size; index += 1) {
      const phrase = words.slice(index, index + size).join('\u0000');
      frequencies.set(phrase, (frequencies.get(phrase) ?? 0) + 1);
    }

    for (const count of frequencies.values()) {
      if (count >= 6 && (count * size) / words.length >= 0.45) {
        return true;
      }
    }
  }

  return false;
}

export function isObviousFiller(text: string): boolean {
  const words = tokenizeWords(text).map((word) => word.toLocaleLowerCase('en-US'));
  return hasLowLexicalDiversity(words)
    || hasDominantToken(words)
    || hasRepeatedShortPhrase(words);
}

export function selectFinalReply(scenario: EmailScenario, text: string): string {
  if (isObviousFiller(text)) {
    return scenario.replies.malfunction;
  }

  const coverage = detectCoverage(scenario, text);
  const coveredCount = coverage.filter(Boolean).length;

  if (coveredCount === scenario.matters.length) {
    return scenario.replies.positive;
  }

  if (coveredCount === scenario.matters.length - 1) {
    const missingIndex = coverage.findIndex((covered) => !covered);
    const missingMatter = scenario.matters[missingIndex];
    if (missingMatter !== undefined) {
      return scenario.replies.omitted[missingMatter.id] ?? scenario.replies.confused;
    }
  }

  return scenario.replies.confused;
}
