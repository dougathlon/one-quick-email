import { describe, expect, it } from 'vitest';

import { INBOX_MESSAGES } from '../../src/data/inbox';
import { SCENARIOS } from '../../src/data/scenarios';
import { countWords } from '../../src/game/wordCount';

const EXPECTED_SCENARIO_IDS = [
  'introduce-yourself',
  'staff-away-day',
  'proposal-feedback',
  'recommend-something',
] as const;

const SAMPLE_REPLIES = {
  'introduce-yourself':
    'Hi Rachel, I joined the company after several years working in public libraries, where I looked after community events and helped people make sense of unfamiliar systems. I enjoy work that combines careful organisation with a little creative problem-solving, and I’m looking forward to learning how the different teams here fit together. I tend to work quietly at first, ask a lot of questions and keep clear notes, but I enjoy collaborating once I understand the shape of a project. Outside work I read, cook, take long walks and attempt to keep a small balcony garden alive. I am especially interested in projects that improve how information is shared, and I appreciate colleagues who explain the background rather than assuming everyone already knows it. My ideal working day has a clear priority, a useful conversation, time to concentrate and at least one problem that ends up being stranger than expected. Please feel free to say hello, especially if you know what my basil is doing wrong. Thanks.',
  'staff-away-day':
    'Hi Dan, An enjoyable away day for me would have one genuinely useful group activity, a good lunch and enough unstructured time to speak to people I rarely work with. I like practical or creative activities where small groups make something together, rather than competitive games that put reluctant people on the spot. The days I remember are usually relaxed and give everyone a reason to mix beyond their usual team. They become disappointing when every minute is scheduled, the purpose is vague or the entertainment feels compulsory. I would avoid early-morning travel and public icebreakers. I also think the venue matters less than the atmosphere: somewhere comfortable, accessible and easy to reach would beat an elaborate destination. Giving people two or three activities to choose between could help quieter colleagues join in without making anyone perform enthusiasm. A simple afternoon challenge followed by a shared meal somewhere pleasant would probably be more memorable than a packed programme. Best.',
  'proposal-feedback':
    'Hi Nina, The smaller accessible counter and brighter waiting area sound like worthwhile improvements, and I like the idea of giving the underused corner a purpose between visitor appointments. Keeping a paper sign-in fallback is also sensible. My main concern is noise: calls, lunch conversations and people waiting for meetings could all be competing in one space, particularly beside the lifts. I would test the call booths acoustically before committing to that location and ask Reception to work from a temporary desk marked out at the proposed size. I would also keep some seating that works for people who find low sofas difficult. The communal table could work well, but I would give it clear quiet hours or etiquette rather than leaving every use to chance. Before approving it, I would run a short trial using temporary furniture and invite both frequent visitors and colleagues with access needs to walk through the space at a busy time. Have we checked where delivery drivers will wait, whether the badge screen exposes visitor names, and whether the route remains comfortable when every seat is occupied? Thanks.',
  'recommend-something':
    'Hi Aisha, I would buy a good-quality countertop water dispenser that provides properly chilled still and sparkling water. A reliable model should fit within the £750 budget, including a refillable cylinder and installation. It is not a dramatic purchase, but people would use it throughout the day, it would make bringing a reusable bottle more appealing and it might reduce the number of cans and plastic bottles brought into the office. Sparkling water also feels like a small treat without creating the cleaning and maintenance burden of a coffee machine. I would place it near the kitchen sink, publish a very short cleaning rota and keep ordinary tap water available so nobody has to use it. Before purchasing, I would ask Facilities to compare the filter, servicing and cylinder costs over two years, because the least expensive machine could become awkward to maintain. If those figures work, it seems like an improvement that is inclusive, visible and useful without demanding much attention from anyone. Best.',
} as const satisfies Readonly<Record<(typeof SCENARIOS)[number]['id'], string>>;

describe('authored game content', () => {
  it('ships exactly the four requested open-ended scenarios with no progression metadata', () => {
    expect(SCENARIOS).toHaveLength(4);
    expect(SCENARIOS.map((scenario) => scenario.id).sort()).toEqual([...EXPECTED_SCENARIO_IDS].sort());
    expect(new Set(SCENARIOS.map((scenario) => scenario.id)).size).toBe(4);
    expect(new Set(SCENARIOS.map((scenario) => scenario.subject)).size).toBe(4);
    expect(new Set(SCENARIOS.map((scenario) => scenario.senderName)).size).toBe(4);

    for (const scenario of SCENARIOS) {
      expect('order' in scenario, scenario.id).toBe(false);
      expect('level' in scenario, scenario.id).toBe(false);
      expect('requires' in scenario, scenario.id).toBe(false);
      expect('unlocks' in scenario, scenario.id).toBe(false);
    }
  });

  it('keeps every prompt self-contained, substantial and free of attachments or evaluation payloads', () => {
    for (const scenario of SCENARIOS) {
      const message = scenario.body.join('\n');
      expect(scenario.body.length, scenario.id).toBeGreaterThanOrEqual(5);
      expect(scenario.body.length, scenario.id).toBeLessThanOrEqual(7);
      expect(scenario.senderEmail, scenario.id).toMatch(/^[a-z.]+@office\.local$/u);
      expect(message, scenario.id).toContain('?');
      expect(countWords(message), scenario.id).toBeGreaterThanOrEqual(100);
      expect(countWords(message), scenario.id).toBeLessThanOrEqual(320);
      expect(message, scenario.id).not.toMatch(/\battach(?:ed|ment|ments)?\b/iu);
      expect(message, scenario.id).not.toMatch(/(?:quick|single) reply covering|all three (?:points|answers|items)/iu);
      expect('matters' in scenario, scenario.id).toBe(false);
      expect('replies' in scenario, scenario.id).toBe(false);
    }
  });

  it('gives each scenario the intended basis for an authentic personal response', () => {
    const byId = Object.fromEntries(SCENARIOS.map((scenario) => [scenario.id, scenario.body.join('\n')]));

    expect(byId['introduce-yourself']).toMatch(/your own words/iu);
    expect(byId['introduce-yourself']).toMatch(/anything personal that you would rather keep private/iu);

    expect(byId['staff-away-day']).toMatch(/what would make the day feel worthwhile to you/iu);
    expect(byId['staff-away-day']).toMatch(/honest preferences/iu);

    expect(countWords(byId['proposal-feedback'] ?? '')).toBeGreaterThanOrEqual(240);
    expect(byId['proposal-feedback']).toMatch(/What works for you/iu);
    expect(byId['proposal-feedback']).toMatch(/what would you change/iu);
    expect(byId['proposal-feedback']).toMatch(/what do you think we may have overlooked/iu);

    expect(byId['recommend-something']).toMatch(/What single purchase would you recommend/iu);
    expect(byId['recommend-something']).toMatch(/how you imagine people benefiting/iu);
  });

  it('supports a natural 150–200 word sample response to every prompt', () => {
    expect(Object.keys(SAMPLE_REPLIES).sort()).toEqual([...EXPECTED_SCENARIO_IDS].sort());

    for (const scenario of SCENARIOS) {
      const sample = SAMPLE_REPLIES[scenario.id];
      expect(countWords(sample), scenario.id).toBeGreaterThanOrEqual(150);
      expect(countWords(sample), scenario.id).toBeLessThanOrEqual(200);
    }
  });

  it('ships exactly 117 distinct, authored background inbox messages', () => {
    expect(INBOX_MESSAGES).toHaveLength(117);
    expect(new Set(INBOX_MESSAGES.map((message) => message.id)).size).toBe(117);
    expect(new Set(INBOX_MESSAGES.map((message) => message.subject)).size).toBe(117);
    expect(
      INBOX_MESSAGES.every(
        (message) =>
          message.subject.trim().length >= 12
          && !/\b(?:message|email|item|subject)\s*#?\d+\b/iu.test(message.subject)
          && !/\b(?:lorem ipsum|placeholder|test message)\b/iu.test(message.subject),
      ),
    ).toBe(true);
  });
});
