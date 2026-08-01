import { describe, expect, it } from 'vitest';

import { SCENARIOS } from '../../src/data/scenarios';
import { detectCoverage, isObviousFiller, selectFinalReply } from '../../src/game/evaluation';
import type { EmailScenario } from '../../src/game/types';

const scenario: EmailScenario = {
  id: 'test-scenario',
  senderName: 'Sender',
  senderEmail: 'sender@example.test',
  subject: 'Three confirmations',
  body: ['Please confirm all three matters.'],
  matters: [
    {
      id: 'arrival',
      prompt: 'Meet the movers at 08:30.',
      keywordGroups: [
        ['meet', 'handover'],
        ['moving team', 'movers'],
        ['08:30', 'half past eight'],
      ],
    },
    {
      id: 'boxes',
      prompt: 'Put red-labelled boxes in Bay C.',
      keywordGroups: [
        ['boxes'],
        ['red-labelled', 'red label'],
        ['Bay C'],
      ],
    },
    {
      id: 'cards',
      prompt: 'Collect access cards.',
      keywordGroups: [
        ['collect', 'pick up'],
        ['access cards'],
        ['reception'],
      ],
    },
  ],
  replies: {
    positive: 'positive',
    omitted: {
      arrival: 'missing arrival',
      boxes: 'missing boxes',
      cards: 'missing cards',
    },
    confused: 'confused',
    malfunction: 'malfunction',
  },
};

const arrival = 'I will MEET the moving team at 08.30.';
const boxes = 'The red labelled boxes will be in Bay-C.';
const cards = 'I will pick-up the access cards from reception.';

describe('scenario coverage', () => {
  it('matches broad alternatives and phrases case-insensitively across punctuation', () => {
    expect(detectCoverage(scenario, `${arrival} ${boxes} ${cards}`)).toEqual([true, true, true]);
  });

  it('requires at least one term from every keyword group', () => {
    expect(detectCoverage(scenario, 'I will meet the movers.')).toEqual([false, false, false]);
    expect(detectCoverage(scenario, `${arrival} Boxes in Bay C. ${cards}`)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('matches whole terms rather than substrings inside unrelated words', () => {
    expect(detectCoverage(scenario, 'A meat mover at 08:30. Boxes redoubled in Bay City.'))
      .toEqual([false, false, false]);
  });

  it('recognises a canonical keyword answer for every shipped scenario', () => {
    for (const shippedScenario of SCENARIOS) {
      const canonicalAnswer = shippedScenario.matters
        .flatMap((matter) => matter.keywordGroups.map((group) => group[0]))
        .join(' ');
      expect(detectCoverage(shippedScenario, canonicalAnswer), shippedScenario.id)
        .toEqual([true, true, true]);
    }
  });
});

describe('filler detection', () => {
  it('detects very low lexical diversity', () => {
    const vocabulary = Array.from({ length: 20 }, (_, index) => `token${index}`);
    const text = Array.from({ length: 300 }, (_, index) => vocabulary[index % vocabulary.length]).join(' ');
    expect(isObviousFiller(text)).toBe(true);
  });

  it('detects a dominant token even when the rest of the vocabulary is diverse', () => {
    const dominant = Array.from({ length: 150 }, () => 'please');
    const diverse = Array.from({ length: 150 }, (_, index) => `detail${index}`);
    expect(isObviousFiller([...dominant, ...diverse].join(' '))).toBe(true);
  });

  it('detects a repeated short phrase without requiring a dominant token', () => {
    const repeated = Array.from({ length: 7 }, () => 'please confirm this detail').join(' ');
    const diverse = Array.from({ length: 32 }, (_, index) => `specific${index}`).join(' ');
    expect(isObviousFiller(`${repeated} ${diverse}`)).toBe(true);
  });

  it('does not condemn short repetition or varied prose without strong evidence', () => {
    expect(isObviousFiller('yes yes yes yes yes')).toBe(false);
    expect(isObviousFiller(
      'Thanks for the detailed note. I can meet the movers at half past eight, '
      + 'label every archive box red, and collect our replacement access cards '
      + 'from reception this afternoon. Jordan will also check the lift booking.',
    )).toBe(false);
  });
});

describe('final reply selection', () => {
  it('returns malfunction first for obvious filler, regardless of keyword coverage', () => {
    const keywordFiller = Array.from({ length: 120 }, () => `${arrival} ${boxes} ${cards}`).join(' ');
    expect(selectFinalReply(scenario, keywordFiller)).toBe('malfunction');
  });

  it('returns the positive reply when all three matters are covered', () => {
    expect(selectFinalReply(scenario, `${arrival} ${boxes} ${cards}`)).toBe('positive');
  });

  it.each([
    [`${boxes} ${cards}`, 'missing arrival'],
    [`${arrival} ${cards}`, 'missing boxes'],
    [`${arrival} ${boxes}`, 'missing cards'],
  ])('returns the reply for the single omitted matter', (text, expected) => {
    expect(selectFinalReply(scenario, text)).toBe(expected);
  });

  it('returns confused when zero or one matter is covered', () => {
    expect(selectFinalReply(scenario, '')).toBe('confused');
    expect(selectFinalReply(scenario, arrival)).toBe('confused');
  });
});
