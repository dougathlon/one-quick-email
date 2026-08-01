import type { EmailScenario } from '../game/types';

export const SCENARIOS = [
  {
    id: 'office-move',
    senderName: 'Priya Nair',
    senderEmail: 'priya.nair@northbankstudio.co.uk',
    subject: 'Monday office move — three confirmations',
    body: [
      'Hi — Facilities are moving the project team from the fourth floor to the east side of the sixth floor on Monday 14 September. The movers have the furniture plan, but I still need three practical confirmations from you before I close the move sheet.',
      'First, please confirm that someone from your team will meet the movers at the goods lift at 08:30 on Monday. Second, the archive boxes need red labels and must be left in Bay C by 16:00 on Friday; please confirm that your team will do that. Third, replacement access cards are waiting at reception and need to be collected before 17:30 today.',
      'A quick reply covering the 08:30 handover, the labelled boxes in Bay C, and the access-card collection is all I need. Thanks for helping us avoid a Monday morning furniture symposium.',
      'Priya\nFacilities Manager',
    ],
    matters: [
      {
        id: 'mover-handover',
        prompt: 'Confirm that a team representative will meet the movers at the goods lift at 08:30 on Monday.',
        keywordGroups: [
          ['movers', 'moving team', 'goods lift'],
          ['08:30', '8:30', '8.30', 'half past eight', 'monday morning'],
        ],
      },
      {
        id: 'archive-boxes',
        prompt: 'Confirm that the archive boxes will be red-labelled and placed in Bay C by 16:00 on Friday.',
        keywordGroups: [
          ['archive boxes', 'boxes', 'archives'],
          ['red label', 'red-labelled', 'red labelled', 'labels'],
          ['bay c', '16:00', '4pm', 'friday'],
        ],
      },
      {
        id: 'access-cards',
        prompt: 'Confirm collection of the replacement access cards from reception before 17:30 today.',
        keywordGroups: [
          ['collect', 'collection', 'pick up', 'pickup', 'retrieve'],
          ['access cards', 'cards', 'passes'],
          ['reception', '17:30', '5:30', 'today'],
        ],
      },
    ],
    replies: {
      positive:
        'Perfect, thank you. I have recorded the 08:30 goods-lift handover, the red-labelled boxes in Bay C by Friday afternoon, and today\'s access-card collection. The move sheet is now gloriously complete.',
      omitted: {
        'mover-handover':
          'Thanks — I have the boxes and access cards covered. Could you also confirm who will meet the movers at the goods lift at 08:30 on Monday?',
        'archive-boxes':
          'Thanks — the Monday handover and card collection are clear. I still need confirmation that the archive boxes will be red-labelled and in Bay C by 16:00 Friday.',
        'access-cards':
          'Thanks — I have noted the handover and archive boxes. Could you confirm that the replacement access cards will be collected from reception before 17:30 today?',
      },
      confused:
        'I may be reading this too quickly, but I cannot identify the three confirmations. Could you restate the 08:30 mover handover, the Bay C archive boxes, and the access-card collection?',
      malfunction:
        'Your reply has arrived looking as though the office move happened inside the email. Please resend the three confirmations when your draft is behaving again.',
    },
  },
  {
    id: 'staff-away-day',
    senderName: 'Dan Mercer',
    senderEmail: 'dan.mercer@harthill.org',
    subject: 'Away-day choices before I release the booking',
    body: [
      'Hello — our staff away-day at Fernwick Hall is booked for Thursday 22 October. I am about to release the final numbers to the venue and coach company, and your team is the last one with blanks on the sheet.',
      'Please tell me whether you have any dietary requirements, including a clear “none” if there are none, by Tuesday at noon. Please also confirm that you will take the coach leaving King Street at 08:10 rather than travel independently. Finally, choose one afternoon workshop: systems mapping or difficult conversations.',
      'If you can put all three answers in one reply, I can stop sending emails titled “final final numbers”.',
      'Dan\nPeople Operations',
    ],
    matters: [
      {
        id: 'dietary-requirements',
        prompt: 'State any dietary requirements, or explicitly say there are none, by Tuesday noon.',
        keywordGroups: [
          ['dietary', 'diet', 'food', 'allergy', 'allergies', 'vegetarian', 'vegan', 'none', 'no requirements'],
        ],
      },
      {
        id: 'coach-travel',
        prompt: 'Confirm taking the coach from King Street at 08:10.',
        keywordGroups: [
          ['coach', 'bus', 'transport'],
          ['king street', 'king st', '08:10', '8:10', '8.10'],
        ],
      },
      {
        id: 'workshop-choice',
        prompt: 'Choose either the systems-mapping or difficult-conversations workshop.',
        keywordGroups: [
          ['systems mapping', 'mapping', 'difficult conversations', 'conversations'],
        ],
      },
    ],
    replies: {
      positive:
        'That gives me everything: dietary status, the 08:10 King Street coach, and your workshop choice. I have released the booking and ceremonially retired one spreadsheet column.',
      omitted: {
        'dietary-requirements':
          'I have your coach and workshop choices, thanks. Please also state any dietary requirements — or confirm none — by Tuesday noon.',
        'coach-travel':
          'Thanks for the dietary note and workshop choice. Could you confirm whether you are taking the 08:10 coach from King Street?',
        'workshop-choice':
          'Dietary and travel details noted. I still need your afternoon choice: systems mapping or difficult conversations.',
      },
      confused:
        'I cannot confidently extract the booking choices from that reply. Could you list your dietary status, coach confirmation, and selected workshop on separate lines?',
      malfunction:
        'Your message seems to have lost a contest with autocorrect. Please resend the dietary, coach, and workshop answers when the text has settled down.',
    },
  },
  {
    id: 'new-employee-first-week',
    senderName: 'Leah Okafor',
    senderEmail: 'leah.okafor@keplerworks.com',
    subject: 'Jordan Lee’s first week — remaining arrangements',
    body: [
      'Hi — Jordan Lee joins the product team next Monday, 9 November. Their induction plan is nearly complete, but there are three items that need an owner on your side.',
      'Please nominate a first-week buddy by 15:00 this Friday. Please reserve Tuesday from 10:00 to 10:45 for Jordan’s product walkthrough. And please arrange for the laptop to be collected from the IT desk at 09:15 on Monday morning; it is logged under ticket IT-2841.',
      'Send me the buddy’s name and confirm both appointments. That will keep Jordan’s first hour from becoming an archaeological dig through our shared drive.',
      'Leah\nPeople Partner',
    ],
    matters: [
      {
        id: 'buddy-nomination',
        prompt: 'Nominate a named first-week buddy by 15:00 Friday.',
        keywordGroups: [
          ['buddy', 'mentor', 'contact', 'pair'],
        ],
      },
      {
        id: 'product-walkthrough',
        prompt: 'Confirm the Tuesday product walkthrough from 10:00 to 10:45.',
        keywordGroups: [
          ['product walkthrough', 'walkthrough', 'product tour', 'induction'],
          ['tuesday'],
          ['10:00', '10am', '10:45', '10.45'],
        ],
      },
      {
        id: 'laptop-collection',
        prompt: 'Arrange collection of Jordan’s laptop from the IT desk at 09:15 Monday under ticket IT-2841.',
        keywordGroups: [
          ['laptop', 'computer', 'device'],
          ['collect', 'collection', 'pick up', 'pickup', 'it desk'],
          ['09:15', '9:15', 'monday', 'IT-2841', '2841'],
        ],
      },
    ],
    replies: {
      positive:
        'Excellent — I have recorded the buddy, Tuesday’s 10:00 walkthrough, and Monday’s 09:15 laptop collection under IT-2841. Jordan’s first week now has fewer blank squares than ours.',
      omitted: {
        'buddy-nomination':
          'The walkthrough and laptop collection are confirmed, thank you. Who should I list as Jordan’s first-week buddy by Friday at 15:00?',
        'product-walkthrough':
          'Thanks — the buddy and laptop plan are clear. Please also confirm the product walkthrough for Tuesday, 10:00–10:45.',
        'laptop-collection':
          'I have the buddy and walkthrough. Could you also confirm collection of Jordan’s laptop from IT at 09:15 Monday under ticket IT-2841?',
      },
      confused:
        'I am not sure which first-week arrangements you are confirming. Please restate the buddy, Tuesday walkthrough, and Monday laptop collection.',
      malfunction:
        'This reply appears to contain fragments from several parallel first weeks. Please resend the three arrangements in a fresh message.',
    },
  },
  {
    id: 'supplier-renewal',
    senderName: 'Owen Price',
    senderEmail: 'owen.price@ashgrovepartners.co.uk',
    subject: 'Cedar Office Supplies renewal decision',
    body: [
      'Good morning — the Cedar Office Supplies agreement expires on 30 November. Their renewal keeps current pricing for twelve months and adds a 2.5% cap on any delivery surcharge. Procurement has reviewed the terms and found no material changes elsewhere.',
      'To issue the order, I need you to approve the twelve-month renewal, confirm that purchases should continue against cost centre 4310, and confirm Nadia Shah as the operational contract owner. If any one of those is wrong, say so now rather than after the purchase order has developed feelings.',
      'Please reply by Wednesday at 16:00 so Cedar can hold the quoted prices.',
      'Owen\nProcurement Manager',
    ],
    matters: [
      {
        id: 'renewal-term',
        prompt: 'Approve the Cedar Office Supplies renewal for twelve months.',
        keywordGroups: [
          ['approve', 'approved', 'proceed', 'renew', 'renewal', 'agree'],
          ['twelve month', '12 month', 'one year', 'annual'],
        ],
      },
      {
        id: 'cost-centre',
        prompt: 'Confirm cost centre 4310 for the renewed purchases.',
        keywordGroups: [
          ['cost centre', 'cost center', 'budget code', 'charge'],
          ['4310'],
        ],
      },
      {
        id: 'contract-owner',
        prompt: 'Confirm Nadia Shah as the operational contract owner.',
        keywordGroups: [
          ['nadia shah', 'nadia'],
          ['contract owner', 'owner', 'operational lead', 'lead'],
        ],
      },
    ],
    replies: {
      positive:
        'Thanks. I now have approval for the twelve-month Cedar renewal, cost centre 4310, and Nadia Shah as contract owner. I will raise the purchase order before the quote escapes.',
      omitted: {
        'renewal-term':
          'I have the cost centre and contract owner. Please also confirm that you approve Cedar’s twelve-month renewal.',
        'cost-centre':
          'Renewal approval and ownership are clear. Could you confirm that the purchase order should use cost centre 4310?',
        'contract-owner':
          'Thanks — renewal and cost centre noted. Please confirm that Nadia Shah will be the operational contract owner.',
      },
      confused:
        'I cannot tell whether this authorises the renewal. Please confirm the twelve-month term, cost centre 4310, and Nadia Shah as owner explicitly.',
      malfunction:
        'Your reply arrived with the decision text scrambled. I cannot use it as purchasing approval; please resend the three confirmations.',
    },
  },
  {
    id: 'recurring-meeting-reorganisation',
    senderName: 'Hannah Brooks',
    senderEmail: 'hannah.brooks@commonthread.co.uk',
    subject: 'Moving the weekly operations meeting',
    body: [
      'Hi all — Friday’s weekly operations meeting now clashes with the warehouse dispatch review, so I am rebuilding the recurring invitation. Calendar arithmetic has produced one workable option for all team leads.',
      'Please confirm Wednesday at 14:30 as the new weekly time. The meeting will be on Teams, not in Room 2, because Room 2’s display is still showing what appears to be February. The new series should begin on 7 October; the existing Friday series will end after this week.',
      'I need confirmation of the time, location, and first date before I replace the invitation.',
      'Hannah\nOperations Coordinator',
    ],
    matters: [
      {
        id: 'weekly-time',
        prompt: 'Confirm Wednesday at 14:30 as the new weekly meeting time.',
        keywordGroups: [
          ['wednesday', 'weds'],
          ['14:30', '2:30', '2.30', 'half past two'],
        ],
      },
      {
        id: 'meeting-location',
        prompt: 'Confirm that the reorganised meeting will be held on Teams rather than in Room 2.',
        keywordGroups: [
          ['teams', 'online', 'video call', 'remote'],
        ],
      },
      {
        id: 'series-start',
        prompt: 'Confirm that the new recurring series begins on 7 October.',
        keywordGroups: [
          ['start', 'begin', 'first', 'from'],
          ['7 october', '7th october', 'october 7', '07/10'],
        ],
      },
    ],
    replies: {
      positive:
        'Confirmed, thank you: weekly on Wednesdays at 14:30, on Teams, beginning 7 October. I will send the replacement series and quietly retire the Friday one.',
      omitted: {
        'weekly-time':
          'I have Teams and the 7 October start date. Could you also confirm Wednesday at 14:30 as the new weekly time?',
        'meeting-location':
          'The time and start date are clear. Please confirm that the meeting should be on Teams rather than in Room 2.',
        'series-start':
          'Thanks — Wednesday at 14:30 on Teams is noted. I still need confirmation that the new series starts on 7 October.',
      },
      confused:
        'I cannot safely update the recurring invitation from this. Please restate the weekday and time, Teams location, and 7 October start date.',
      malfunction:
        'Your message seems to have been reorganised more aggressively than the meeting. Please resend the three calendar details.',
    },
  },
  {
    id: 'website-refresh',
    senderName: 'Mateo Ruiz',
    senderEmail: 'mateo@fieldworkdigital.co.uk',
    subject: 'Website refresh: final content decisions',
    body: [
      'Hi — the refreshed website is ready for its final content pass. We have fixed the mobile navigation and reduced the homepage image weight, so the remaining blockers are all decisions rather than development work.',
      'Please approve the homepage headline “Work, made workable.” Please send the three approved case-study images as original JPG or PNG files by Monday at 12:00. And please confirm that Aisha Khan will provide the final legal sign-off on the cookie notice.',
      'Once I have those three points, we can keep the planned Wednesday launch. Without them, the preview site will continue its distinguished private career.',
      'Mateo\nFieldwork Digital',
    ],
    matters: [
      {
        id: 'homepage-headline',
        prompt: 'Approve the homepage headline “Work, made workable.”',
        keywordGroups: [
          ['approve', 'approved', 'happy with', 'sign off', 'use'],
          ['work made workable', 'work, made workable', 'headline'],
        ],
      },
      {
        id: 'case-study-images',
        prompt: 'Send three approved case-study images as original JPG or PNG files by Monday at 12:00.',
        keywordGroups: [
          ['three', '3'],
          ['case-study images', 'case study images', 'images', 'photos'],
          ['jpg', 'jpeg', 'png', 'original files', 'originals'],
          ['monday', '12:00', 'noon', 'midday'],
        ],
      },
      {
        id: 'cookie-signoff',
        prompt: 'Confirm Aisha Khan as the person providing legal sign-off on the cookie notice.',
        keywordGroups: [
          ['aisha khan', 'aisha'],
          ['legal', 'sign-off', 'signoff', 'approve', 'approval'],
          ['cookie notice', 'cookie copy', 'cookies'],
        ],
      },
    ],
    replies: {
      positive:
        'Great — the headline is approved, the three original case-study images are due Monday at noon, and Aisha Khan owns the cookie-notice sign-off. Wednesday’s launch remains alive.',
      omitted: {
        'homepage-headline':
          'I have the image delivery and cookie sign-off. Please also confirm approval of the headline “Work, made workable.”',
        'case-study-images':
          'Headline and legal owner noted. I still need the three original JPG or PNG case-study images by Monday at 12:00.',
        'cookie-signoff':
          'Thanks — headline and images are covered. Could you confirm that Aisha Khan will provide legal sign-off on the cookie notice?',
      },
      confused:
        'I am not sure which launch blockers this resolves. Could you restate the headline approval, image delivery, and cookie-notice sign-off?',
      malfunction:
        'The reply rendered like a website before its CSS arrived. Please resend the three content decisions in plain text.',
    },
  },
  {
    id: 'conference-travel',
    senderName: 'Amy Chen',
    senderEmail: 'amy.chen@traveldesk.co.uk',
    subject: 'Bristol conference travel options on hold',
    body: [
      'Hello — I am holding travel for the Bristol Service Design Conference on 18–19 November. The rail fares and hotel rate expire tomorrow at 11:00, so I need a complete response before I ticket anything.',
      'Please approve the 07:42 outbound train from London Paddington on 18 November. For the return, confirm the 18:18 departure from Bristol Temple Meads on 19 November. Finally, approve one night at the Premier Inn Bristol City Centre at £129 including breakfast.',
      'Reply with all three approvals, or flag any accessibility requirements that change the booking. The reservation system is patient only in the technical sense.',
      'Amy\nTravel Desk',
    ],
    matters: [
      {
        id: 'outbound-train',
        prompt: 'Approve the 07:42 train from London Paddington on 18 November.',
        keywordGroups: [
          ['outbound', 'outward', 'train', 'departure'],
          ['07:42', '7:42', '7.42'],
          ['london paddington', 'paddington', '18 november', '18th november', 'november 18', '18th'],
        ],
      },
      {
        id: 'return-train',
        prompt: 'Confirm the 18:18 return from Bristol Temple Meads on 19 November.',
        keywordGroups: [
          ['return', 'coming back', 'homebound'],
          ['18:18', '6:18', '6.18'],
          ['bristol temple meads', 'temple meads', '19 november', '19th november', 'november 19', '19th'],
        ],
      },
      {
        id: 'hotel-booking',
        prompt: 'Approve one night at Premier Inn Bristol City Centre for £129 including breakfast.',
        keywordGroups: [
          ['premier inn', 'hotel'],
          ['129', '£129'],
          ['breakfast', 'including breakfast', 'one night', '1 night'],
        ],
      },
    ],
    replies: {
      positive:
        'All set: the 07:42 outbound, 18:18 return, and Premier Inn at £129 including breakfast are approved. I will issue the booking before the hold becomes theoretical.',
      omitted: {
        'outbound-train':
          'I have the return and hotel approval. Could you also confirm the 07:42 outbound from Paddington on 18 November?',
        'return-train':
          'Outbound and hotel noted. Please confirm the 18:18 return from Bristol Temple Meads on 19 November.',
        'hotel-booking':
          'Thanks — both trains are clear. I still need approval for the Premier Inn Bristol City Centre at £129 including breakfast.',
      },
      confused:
        'I cannot tell which itinerary you are approving. Please restate the outbound train, return train, and hotel choice.',
      malfunction:
        'Your reply arrived with several times but no recoverable itinerary. Please resend the three approvals before the booking hold expires.',
    },
  },
  {
    id: 'internal-training-day',
    senderName: 'Sofia Patel',
    senderEmail: 'sofia.patel@northfieldcare.org',
    subject: 'Training day: attendance and preparation',
    body: [
      'Hi — you are booked onto the safeguarding refresher in Training Room A on Tuesday 3 November. The session starts at 09:30 and runs until 15:30, with lunch provided.',
      'Please confirm that you will attend the 09:30 start. Bring your work laptop and charger because the afternoon exercises use the casework sandbox. Before arriving, complete the twenty-minute pre-course quiz in LearnHub by 17:00 on Monday.',
      'I need a reply covering attendance, equipment, and the quiz deadline so I can close the learner record. The system regards an empty field as a lifestyle choice.',
      'Sofia\nLearning and Development',
    ],
    matters: [
      {
        id: 'training-attendance',
        prompt: 'Confirm attendance at the safeguarding refresher at 09:30 on Tuesday 3 November.',
        keywordGroups: [
          ['attend', 'attendance', 'be there', 'confirmed', 'coming'],
          ['safeguarding', 'refresher', 'training'],
          ['09:30', '9:30', 'tuesday', '3 november'],
        ],
      },
      {
        id: 'laptop-and-charger',
        prompt: 'Confirm bringing a work laptop and charger.',
        keywordGroups: [
          ['bring', 'bringing', 'take', 'have'],
          ['laptop', 'work computer'],
          ['charger', 'power cable', 'power supply'],
        ],
      },
      {
        id: 'pre-course-quiz',
        prompt: 'Confirm completion of the LearnHub pre-course quiz by 17:00 Monday.',
        keywordGroups: [
          ['quiz', 'pre-course', 'pre course', 'learnhub'],
          ['complete', 'completed', 'completion', 'finish', 'done'],
          ['17:00', '5pm', 'monday'],
        ],
      },
    ],
    replies: {
      positive:
        'Thank you. I have confirmed your 09:30 attendance, noted the laptop and charger, and recorded that the LearnHub quiz will be complete by Monday at 17:00.',
      omitted: {
        'training-attendance':
          'Equipment and quiz noted. Please also confirm that you will attend the 09:30 safeguarding refresher on Tuesday 3 November.',
        'laptop-and-charger':
          'Attendance and quiz are clear. Could you confirm that you will bring both your work laptop and its charger?',
        'pre-course-quiz':
          'Thanks — attendance and equipment are covered. Please confirm that you will complete the LearnHub quiz by 17:00 Monday.',
      },
      confused:
        'I cannot update the learner record from this reply. Please restate your attendance, laptop-and-charger plan, and quiz completion.',
      malfunction:
        'Your reply appears to have been submitted by the training sandbox. Please resend the three confirmations in ordinary text.',
    },
  },
  {
    id: 'equipment-purchase',
    senderName: 'Marcus Bell',
    senderEmail: 'marcus.bell@greyfriarsfinance.co.uk',
    subject: 'Monitor purchase — approval details required',
    body: [
      'Hello — IT has approved the ergonomic assessment request and sourced the standard display from our framework supplier. Finance can place the order as soon as the coding and delivery details are confirmed.',
      'Please approve the purchase of two 27-inch Dell P2725H monitors at £184 each excluding VAT. Confirm that the order should be charged to cost centre 5204. Finally, confirm delivery to the Manchester office, marked for Facilities, rather than to a home address.',
      'Please include all three details in your reply. “Some screens, somewhere” remains just outside the purchasing policy.',
      'Marcus\nFinance Operations',
    ],
    matters: [
      {
        id: 'monitor-order',
        prompt: 'Approve two 27-inch Dell P2725H monitors at £184 each excluding VAT.',
        keywordGroups: [
          ['approve', 'approved', 'order', 'purchase', 'proceed'],
          ['two', '2'],
          ['dell p2725h', 'p2725h', '27-inch', '27 inch', 'monitors'],
          ['184', '£184'],
        ],
      },
      {
        id: 'purchase-cost-centre',
        prompt: 'Confirm cost centre 5204 for the monitor order.',
        keywordGroups: [
          ['cost centre', 'cost center', 'budget code', 'charge'],
          ['5204'],
        ],
      },
      {
        id: 'delivery-location',
        prompt: 'Confirm delivery to the Manchester office, marked for Facilities, not to a home address.',
        keywordGroups: [
          ['deliver', 'delivery', 'send', 'ship'],
          ['manchester office', 'manchester'],
          ['facilities', 'facilities team'],
        ],
      },
    ],
    replies: {
      positive:
        'Approved details received: two Dell P2725H monitors at £184 each, cost centre 5204, delivered to Facilities at the Manchester office. I will place the order.',
      omitted: {
        'monitor-order':
          'I have the coding and delivery details. Please also approve two Dell P2725H monitors at £184 each excluding VAT.',
        'purchase-cost-centre':
          'The equipment and delivery are clear. Could you confirm that this order should be charged to cost centre 5204?',
        'delivery-location':
          'Thanks — item and cost centre noted. Please confirm delivery to Facilities at the Manchester office rather than a home address.',
      },
      confused:
        'I cannot use this as purchase approval. Please restate the monitor quantity and model, cost centre, and office delivery instruction.',
      malfunction:
        'The approval text has arrived at a resolution Finance cannot display. Please resend the three order details.',
    },
  },
  {
    id: 'client-event-follow-up',
    senderName: 'Elsie Ward',
    senderEmail: 'elsie.ward@assemblyevents.co.uk',
    subject: 'Northstar client breakfast — follow-up actions',
    body: [
      'Hi — yesterday’s Northstar client breakfast went well, and the venue has now sent its final attendance scan. I am preparing the follow-up while the conversations are still recent enough to distinguish from other conversations near coffee.',
      'Please send any corrections to the attendee list by 16:00 today. Confirm that Ravi Mehta will own the individual thank-you notes for the six speakers. And approve sending the follow-up slide deck to all attendees at 10:00 on Friday.',
      'A single reply covering the list, the thank-you owner, and the deck timing will let me schedule everything this afternoon.',
      'Elsie\nClient Events Lead',
    ],
    matters: [
      {
        id: 'attendee-corrections',
        prompt: 'Send attendee-list corrections, or confirm there are none, by 16:00 today.',
        keywordGroups: [
          ['attendee list', 'attendance list', 'guest list', 'attendees'],
          ['corrections', 'changes', 'amendments', 'none', 'no changes'],
          ['16:00', '4pm', 'today'],
        ],
      },
      {
        id: 'thank-you-owner',
        prompt: 'Confirm Ravi Mehta as owner of the individual thank-you notes for the six speakers.',
        keywordGroups: [
          ['ravi mehta', 'ravi'],
          ['thank-you notes', 'thank you notes', 'speaker thanks', 'thank-yous'],
          ['six speakers', '6 speakers', 'speakers'],
        ],
      },
      {
        id: 'deck-send',
        prompt: 'Approve sending the follow-up slide deck to all attendees at 10:00 Friday.',
        keywordGroups: [
          ['approve', 'approved', 'send', 'schedule'],
          ['follow-up deck', 'follow up deck', 'slide deck', 'slides'],
          ['all attendees', 'everyone', 'attendees'],
          ['10:00', '10am', 'friday'],
        ],
      },
    ],
    replies: {
      positive:
        'Thanks — attendee-list corrections are covered, Ravi Mehta owns the six speaker notes, and the deck is approved for 10:00 Friday. I will schedule the follow-up.',
      omitted: {
        'attendee-corrections':
          'I have Ravi and the deck timing. Please also send attendee-list corrections — or confirm there are none — by 16:00 today.',
        'thank-you-owner':
          'List and deck noted. Could you confirm that Ravi Mehta will write the individual thank-you notes for the six speakers?',
        'deck-send':
          'Thanks — the attendee list and thank-you owner are clear. Please approve sending the follow-up deck to all attendees at 10:00 Friday.',
      },
      confused:
        'I cannot tell which follow-up actions this confirms. Please restate the attendee-list status, thank-you owner, and deck send time.',
      malfunction:
        'Your reply arrived with the sort of formatting normally reserved for conference lanyards. Please resend the three actions in plain text.',
    },
  },
] as const satisfies readonly EmailScenario[];
