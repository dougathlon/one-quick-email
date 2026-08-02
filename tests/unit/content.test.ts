import { describe, expect, it } from 'vitest';

import { INBOX_MESSAGES } from '../../src/data/inbox';
import { SCENARIOS } from '../../src/data/scenarios';
import { countWords } from '../../src/game/wordCount';

const SAMPLE_REPLIES = {
  'office-move':
    'Hi Priya, I would ask the movers to begin with the storage cabinets at 08:30 while IT disconnects the desks. James can take over the goods lift at 08:45, so Ruth does not need to be in two places and can collect the access cards today. Elias should finish the six remaining archive boxes from 14:00 on Friday and move them to Bay C before it closes at 16:00. Please tell Facilities that James is the lift contact and that desk moves can begin after 09:00. This sequence uses everyone’s stated availability and avoids delaying either IT or the movers. Thanks, Office Administration',
  'staff-away-day':
    'Hi Dan, I would choose systems mapping because cross-team handovers were the most common problem in the staff survey, so it should have the broadest practical benefit. I would keep the 08:10 coach: it arrives with 25 minutes to settle in, whereas the later minibus costs £140 more and leaves almost no margin. I would not rely on a dietary list that is six months old, especially where a nut allergy is involved. Please ask everyone to confirm or update their requirements before the venue deadline, while carrying the existing three requirements forward provisionally so nothing is lost. That seems the safer and better-value plan. Thanks.',
  'new-employee-first-week':
    'Hi Leah, I would use Tom as Jordan’s welcome contact on Monday because he will be present, then ask Maya to become the main product buddy from Tuesday. Tom can collect the laptop from IT at 09:15 and help Jordan get settled while Maya is away. I would move the product walkthrough to Tuesday at 11:30, after Maya’s client call, rather than waiting until Wednesday. That gives Jordan product context early without asking Maya to miss an existing commitment. Please list Tom as the laptop collector and Monday contact, with Maya taking over the buddy role and leading the rescheduled walkthrough from Tuesday. Thanks.',
  'supplier-renewal':
    'Hi Owen, I recommend renewing with Cedar. Elm saves £550 a year, but its five-day lead time and £100 minimum do not fit the two small urgent orders we place each month. Those orders would either be delayed or padded, which could quickly erode the saving. Cedar’s three late deliveries were all under a day, so its current service record seems acceptable, and the surcharge cap adds useful certainty. Nadia should remain contract owner, with a named deputy covering the first two weeks of December; I suggest asking Procurement to nominate someone before the renewal is signed. Please continue using cost centre 4310. Best.',
  'recurring-meeting-reorganisation':
    'Morning Hannah, I would use Wednesday at 14:30 as the regular slot. The finance pack would then be available, and Jo would miss only the first 30 minutes rather than the whole discussion. We could put operational updates first and move any item requiring Jo to the second half. For the first week of each month, when finance takes longer, I suggest a separate 30-minute finance follow-up on Thursday afternoon once the pack is complete. That keeps the recurring meeting predictable without forcing the team to discuss incomplete figures. Please send the Wednesday invitation from next week and cancel the remaining Friday series before 16:00. Thanks.',
  'website-refresh':
    'Hi Mateo, I would launch with “Practical systems for growing teams.” Seven of the eight test users need to understand the offer quickly, and clarity matters more than distinctiveness on the homepage. We can keep “Work, made workable” for campaign copy where there is more context. I would feature the approved Atlas case study on Wednesday rather than rely on permission that may not arrive; the newer council work can replace it in a later update once the quotation is cleared. Please ask Ben to review the cookie notice on Tuesday morning while Aisha is away. That gives the launch a fully approved headline, case study and legal route. Thanks.',
  'conference-travel':
    'Hello Amy, I would book the 07:42 outbound, the 19:00 return and the Harbourside hotel. The earlier outbound avoids missing the opening session, while the later return is cheaper and removes any risk of rushing from the final session. That combination costs £240, leaving £30 within the £270 budget. The Harbourside is less convenient and does not include breakfast, but the 25-minute walk seems manageable and the saving protects the overall limit. If breakfast is essential, the city-centre hotel with the same trains would cost £270 exactly, so that is a reasonable alternative. My preference is the £240 plan unless accessibility makes the walk unsuitable. Thanks.',
  'internal-training-day':
    'Hi Sofia, I would book Jo and Imran for the full day, Leon for the morning, and Ruth for the afternoon access-request workshop. Leon can return to reception at 13:30 and monitor the shared inbox there until 16:30, while Ruth’s client call would no longer conflict. I would choose the access-request session because the process launches next month and Ruth can help the others connect the training to the pilot. Jo and Imran should use the two managed laptops for the practical work, and Ruth can share one during the afternoon if needed. Please submit all four names and the request for two loan laptops by Friday. Thanks.',
  'equipment-purchase':
    'Hi Marcus, I would order two Dell P2725H monitors for £368. They meet the essential height-adjustment requirement, work with the existing docks and stay £52 within budget. The separate power and display cables are less tidy than one USB-C connection, but the Philips pair would cost £430 before any other expenses and require Finance approval. Unless IT can show that cable simplicity solves a specific support problem, the extra cost is hard to justify. Tuesday is the safer delivery day because Facilities can receive them and the desk is free; Thursday risks interrupting the interviews. Please place the Dell order for Tuesday delivery and retain the remaining budget for cables if needed. Thanks.',
  'client-event-follow-up':
    'Hi Elsie, Please record Ella Shaw as attended, merge the duplicate Noor Hassan and N. Hassan entries, and remove Martin Cole and Joel Price because they cancelled. I would ask Ravi to prepare the six individual speaker notes before Monday as planned, with a brief check on Thursday so he can start before leaving at 16:30. For the general attendee email, I recommend removing slide 14 and sending the rest of the deck on Friday. Draft pricing should not go out without Sales approval, and waiting until Tuesday would make the follow-up less timely. The approved pricing slide can be sent separately later if it adds value. Thanks.',
} as const satisfies Readonly<Record<(typeof SCENARIOS)[number]['id'], string>>;

describe('authored game content', () => {
  it('ships ten distinct, self-contained workplace scenarios without evaluation payloads', () => {
    expect(SCENARIOS).toHaveLength(10);
    expect(new Set(SCENARIOS.map((scenario) => scenario.id)).size).toBe(10);
    expect(new Set(SCENARIOS.map((scenario) => scenario.subject)).size).toBe(10);
    expect(new Set(SCENARIOS.map((scenario) => scenario.senderName)).size).toBe(10);

    for (const scenario of SCENARIOS) {
      const message = scenario.body.join('\n');
      expect(scenario.body, scenario.id).toHaveLength(5);
      expect(scenario.senderEmail, scenario.id).toContain('@');
      expect(message, scenario.id).toContain('?');
      expect(countWords(message), scenario.id).toBeGreaterThanOrEqual(100);
      expect(countWords(message), scenario.id).toBeLessThanOrEqual(180);
      expect(message, scenario.id).not.toMatch(/\battach(?:ed|ment|ments)?\b/iu);
      expect(message, scenario.id).not.toMatch(/(?:quick|single) reply covering|all three (?:points|answers|items)/iu);
      expect('matters' in scenario, scenario.id).toBe(false);
      expect('replies' in scenario, scenario.id).toBe(false);
    }
  });

  it('supports a natural 90–130 word sample reply using only information in each message', () => {
    for (const scenario of SCENARIOS) {
      const sample = SAMPLE_REPLIES[scenario.id];
      expect(countWords(sample), scenario.id).toBeGreaterThanOrEqual(90);
      expect(countWords(sample), scenario.id).toBeLessThanOrEqual(130);
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
