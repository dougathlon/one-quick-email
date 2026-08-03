import type { EmailScenario } from '../game/types';

export const SCENARIOS = [
  {
    id: 'introduce-yourself',
    senderName: 'Rachel Kim',
    senderEmail: 'rachel.kim@office.local',
    subject: 'A short introduction for the staff intranet',
    body: [
      'Hi,',
      'Now that you’ve joined us, we’re refreshing the staff pages on the company intranet, and I’d like to add a short introduction for you. The aim is simply to help people put a person to a name, especially colleagues who may not work with you day to day.',
      'Could you write a few paragraphs introducing yourself in your own words? You might mention previous experience, interests, what you’re looking forward to working on, hobbies, how you like to work, or anything else you would genuinely like colleagues to know. Please use whichever of those feels relevant rather than trying to cover everything.',
      'There is no fixed format or preferred tone. Friendly and straightforward is perfect, and you do not need to include anything personal that you would rather keep private.',
      'Thanks,\nRachel\nInternal Communications',
    ],
  },
  {
    id: 'staff-away-day',
    senderName: 'Dan Mercer',
    senderEmail: 'dan.mercer@office.local',
    subject: 'What would make the away day worth it?',
    body: [
      'Hi,',
      'We’re beginning to plan this year’s annual staff away day. Before we book a venue or settle on a programme, I’d rather hear what people would actually enjoy than repeat last year by default.',
      'Could you tell me what would make the day feel worthwhile to you? I’m interested in the kinds of activities you enjoy, whether you prefer a busy programme or plenty of time to talk, and any idea you think people would remember afterwards.',
      'It would also help to know what tends to make these events disappointing or awkward, and whether there is anything you would avoid. There is no right kind of answer here; we’re looking for honest preferences, not a polished event plan.',
      'Best,\nDan\nPeople Operations',
    ],
  },
  {
    id: 'proposal-feedback',
    senderName: 'Nina Foster',
    senderEmail: 'nina.foster@office.local',
    subject: 'Could I get your view on the reception proposal?',
    body: [
      'Hi,',
      'Before we take this any further, I’d value a fresh pair of eyes on a proposal for the reception and shared space on the ground floor. I’ve put the current idea below so you have the whole thing in one place. Nothing has been approved yet.',
      'The large curved reception desk would come out. In its place we’d install a smaller straight counter beside the entrance, with a lowered section for wheelchair users. The waiting area would move to the windows and use two small sofas and four upright chairs. The corner where visitors currently sit would become an eight-seat communal table with power sockets. It would not be bookable: people could use it for lunch, short catch-ups or overflow work.',
      'Two enclosed call booths would go beside the lifts. The coat cupboard would become day lockers, with one rail kept for visitors. Sign-in would move from the paper book to a tablet at the new counter; it would print a badge and notify the person being visited. Reception would keep a paper fallback, and the rules on escorting visitors would not change.',
      'The case for the scheme is that reception would feel less formal and the ground floor would be useful between visitor appointments. My hesitation is that the same area has to work as an entrance, a waiting room, an occasional workplace and a lunch space. We have allowed for an accessible route through the middle, but we have not yet tested noise at busy times or asked the reception team to try the smaller desk.',
      'What works for you in this proposal? What concerns you, what would you change, and what do you think we may have overlooked? Please respond as someone who would actually use or visit the space; you do not need any specialist design knowledge.',
      'Thanks,\nNina\nWorkplace Manager',
    ],
  },
  {
    id: 'recommend-something',
    senderName: 'Aisha Grant',
    senderEmail: 'aisha.grant@office.local',
    subject: 'One thing to improve everyday office life',
    body: [
      'Hi,',
      'HR has up to £750 left in a small workplace improvement budget. Rather than buying a collection of generic items, we’d like to spend it on one thing people might genuinely notice and use.',
      'What single purchase would you recommend? It can be practical, enjoyable or a little unusual, as long as you honestly think it would improve everyday office life. It does not have to appeal to everyone, and it does not need to solve a serious problem.',
      'Please explain what you would buy, why you chose it and how you imagine people benefiting from it. A rough idea of cost is useful if you know one, but we’re more interested in your reasoning than a formal business case.',
      'Thanks,\nAisha\nPeople Operations',
    ],
  },
] as const satisfies readonly EmailScenario[];
