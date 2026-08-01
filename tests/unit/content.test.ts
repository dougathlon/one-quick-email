import { describe, expect, it } from 'vitest';

import { INBOX_MESSAGES } from '../../src/data/inbox';
import { SCENARIOS } from '../../src/data/scenarios';
import { detectCoverage } from '../../src/game/evaluation';

describe('authored game content', () => {
  it('ships ten structurally complete, uniquely identified scenarios', () => {
    expect(SCENARIOS).toHaveLength(10);
    expect(new Set(SCENARIOS.map((scenario) => scenario.id)).size).toBe(10);

    for (const scenario of SCENARIOS) {
      expect(scenario.body.length).toBeGreaterThanOrEqual(3);
      expect(scenario.matters).toHaveLength(3);
      expect(scenario.senderEmail).toContain('@');
      expect(Object.keys(scenario.replies.omitted).sort()).toEqual(
        scenario.matters.map((matter) => matter.id).sort(),
      );
      expect(scenario.matters.every((matter) => matter.keywordGroups.length > 0)).toBe(true);
      expect(detectCoverage(scenario, scenario.body.join('\n'))).toEqual([true, true, true]);
    }
  });

  it('ships exactly 117 distinct, authored background inbox messages', () => {
    expect(INBOX_MESSAGES).toHaveLength(117);
    expect(new Set(INBOX_MESSAGES.map((message) => message.id)).size).toBe(117);
    expect(new Set(INBOX_MESSAGES.map((message) => message.subject)).size).toBe(117);
    expect(
      INBOX_MESSAGES.every(
        (message) =>
          message.subject.trim().length >= 12 &&
          !/\b(?:message|email|item|subject)\s*#?\d+\b/iu.test(message.subject) &&
          !/\b(?:lorem ipsum|placeholder|test message)\b/iu.test(message.subject),
      ),
    ).toBe(true);
  });
});
