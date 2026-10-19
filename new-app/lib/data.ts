/**
 * Demo workspace dataset. Every product page reads from these canonical
 * collections (one contacts directory, one call timeline, one number
 * inventory) so overlapping Phone / AI / MCTB events stay linked rather than
 * duplicated. Swap these exports for typed API adapters when wiring backend.
 */

export type Contact = {
  id: string
  name: string
  phone: string
  email?: string
  company?: string
  tags: string[]
  owner: string
  status: 'active' | 'lead' | 'customer' | 'blocked'
  consent: 'opted_in' | 'opted_out' | 'unknown'
  lastInteraction: string
}

export type PhoneNumber = {
  id: string
  number: string
  label: string
  type: 'transovo' | 'forwarded'
  products: ('phone' | 'receptionist' | 'mctb')[]
  status: 'active' | 'pending_verification' | 'partial' | 'disconnected'
  route: string
  assignedUser?: string
  sms: boolean
  provider?: string
  forwardingType?: 'all' | 'no_answer' | 'busy'
}

export type AiOutcome = 'booked' | 'transferred' | 'callback' | 'message' | 'unresolved' | 'failed'
export type McTbState =
  | 'eligible'
  | 'consent_pending'
  | 'declined'
  | 'texted'
  | 'replied'
  | 'needs_callback'
  | 'suppressed'
  | 'failed'

export type CallOutcome = 'answered' | 'missed' | 'voicemail' | 'ai_handled' | 'failed'

export type Call = {
  id: string
  contactId?: string
  caller: string
  callerNumber: string
  numberId: string
  direction: 'inbound' | 'outbound'
  startedAt: string
  durationSec: number
  outcome: CallOutcome
  routedTo: string
  user?: string
  recording: boolean
  /** Telnyx/S3 URL when stored on HumanCall (server-rendered on detail). */
  recordingUrl?: string | null
  callbackNeeded: boolean
  handled: boolean
  voicemail?: { transcript: string; durationSec: number }
  ai?: {
    intent: string
    outcome: AiOutcome
    summary: string
    followUp: 'open' | 'done' | 'none'
    tools: { name: string; status: 'success' | 'failed' | 'skipped'; detail: string }[]
    transcript: { speaker: 'agent' | 'caller'; text: string; at: string }[]
  }
  mctb?: {
    state: McTbState
    pressOne: 'pressed' | 'no_input' | 'declined' | 'not_offered'
    messageStatus: 'delivered' | 'sent' | 'failed' | 'not_sent'
    template?: string
    reply?: string
    suppressionReason?: string
    threadId?: string
  }
  campaignId?: string
  disposition?: string
}

export const BUSINESS = {
  name: 'Harbor & Pine Dental',
  workspace: 'Harbor & Pine',
  timezone: 'America/Chicago',
  timezoneLabel: 'Central Time (CT)',
  hours: [
    { day: 'Mon', open: '08:00', close: '17:30', closed: false },
    { day: 'Tue', open: '08:00', close: '17:30', closed: false },
    { day: 'Wed', open: '08:00', close: '17:30', closed: false },
    { day: 'Thu', open: '08:00', close: '19:00', closed: false },
    { day: 'Fri', open: '08:00', close: '15:00', closed: false },
    { day: 'Sat', open: '09:00', close: '13:00', closed: false },
    { day: 'Sun', open: '', close: '', closed: true },
  ],
  address: '418 Lakeshore Ave, Suite 200, Chicago, IL 60611',
  services: ['Cleanings & exams', 'Whitening', 'Invisalign', 'Emergency visits', 'Crowns & bridges'],
}

export const TEAM = [
  { id: 'u1', name: 'Maya Okafor', role: 'Owner', email: 'maya@harborpine.com', status: 'active' },
  { id: 'u2', name: 'Daniel Reyes', role: 'Admin', email: 'daniel@harborpine.com', status: 'active' },
  { id: 'u3', name: 'Priya Natarajan', role: 'Agent', email: 'priya@harborpine.com', status: 'active' },
  { id: 'u4', name: 'Tom Whitaker', role: 'Agent', email: 'tom@harborpine.com', status: 'invited' },
]

export const NUMBERS: PhoneNumber[] = [
  {
    id: 'n1',
    number: '+13125550142',
    label: 'Main line',
    type: 'transovo',
    products: ['phone', 'receptionist', 'mctb'],
    status: 'active',
    route: 'Front desk ring group → AI after-hours',
    assignedUser: 'Front desk',
    sms: true,
  },
  {
    id: 'n2',
    number: '+13125550199',
    label: 'Outbound — recalls',
    type: 'transovo',
    products: ['phone'],
    status: 'active',
    route: 'Priya Natarajan → voicemail',
    assignedUser: 'Priya Natarajan',
    sms: true,
  },
  {
    id: 'n3',
    number: '+17735550118',
    label: 'Lincoln Park office',
    type: 'forwarded',
    products: ['mctb', 'receptionist'],
    status: 'partial',
    route: 'Carrier no-answer forward → AI overflow → MCTB',
    sms: false,
    provider: 'Comcast Business',
    forwardingType: 'no_answer',
  },
]

const contactSeed: [string, string, string | undefined, string[], Contact['status'], Contact['consent']][] = [
  ['Elena Vasquez', '+13125558821', 'Vasquez Realty', ['new patient'], 'customer', 'opted_in'],
  ['Marcus Chen', '+17735552210', undefined, ['recall due'], 'customer', 'unknown'],
  ['Aisha Bello', '+13125559034', 'Bello & Co', ['invisalign'], 'lead', 'opted_in'],
  ['Robert Lindqvist', '+18475551170', undefined, ['emergency'], 'customer', 'unknown'],
  ['Sofia Marchetti', '+13125554456', undefined, ['whitening'], 'lead', 'opted_in'],
  ['James Okonkwo', '+17735553389', 'Lakeview Fitness', ['corporate plan'], 'lead', 'unknown'],
  ['Hannah Brooks', '+13125557712', undefined, ['recall due'], 'customer', 'opted_out'],
  ['Victor Nguyen', '+16305556641', undefined, [], 'lead', 'unknown'],
  ['Grace Kim', '+13125550987', 'Northside Montessori', ['family plan'], 'customer', 'opted_in'],
  ['Derek Thompson', '+17735558804', undefined, ['spam risk'], 'blocked', 'unknown'],
  ['Leila Haddad', '+13125552267', undefined, ['new patient'], 'lead', 'opted_in'],
  ['Owen Fitzgerald', '+18475559012', undefined, ['recall due'], 'customer', 'unknown'],
  ['Nadia Petrova', '+13125556120', 'Petrova Design', ['invisalign'], 'lead', 'opted_in'],
  ['Samuel Adeyemi', '+17735557745', undefined, [], 'customer', 'unknown'],
  ['Clara Johansson', '+13125553398', undefined, ['whitening'], 'lead', 'unknown'],
  ['Ian McAllister', '+16305552281', 'McAllister HVAC', ['corporate plan'], 'lead', 'unknown'],
]

const owners = ['Maya Okafor', 'Daniel Reyes', 'Priya Natarajan']

export const CONTACTS: Contact[] = contactSeed.map(([name, phone, company, tags, status, consent], i) => ({
  id: `c${i + 1}`,
  name,
  phone,
  company,
  email: `${name.split(' ')[0].toLowerCase()}@example.com`,
  tags,
  owner: owners[i % owners.length],
  status,
  consent,
  lastInteraction: new Date(Date.UTC(2026, 9, 18, 15, 0) - i * 5.5 * 3600_000).toISOString(),
}))

const BASE = Date.UTC(2026, 9, 18, 16, 40)
const at = (hoursAgo: number) => new Date(BASE - hoursAgo * 3600_000).toISOString()

const richCalls: Call[] = [
  {
    id: 'call_1001',
    contactId: 'c1',
    caller: 'Elena Vasquez',
    callerNumber: '+13125558821',
    numberId: 'n1',
    direction: 'inbound',
    startedAt: at(0.4),
    durationSec: 214,
    outcome: 'answered',
    routedTo: 'Front desk ring group',
    user: 'Daniel Reyes',
    recording: true,
    callbackNeeded: false,
    handled: true,
  },
  {
    id: 'call_1002',
    contactId: 'c4',
    caller: 'Robert Lindqvist',
    callerNumber: '+18475551170',
    numberId: 'n1',
    direction: 'inbound',
    startedAt: at(1.2),
    durationSec: 176,
    outcome: 'ai_handled',
    routedTo: 'AI Receptionist (overflow)',
    recording: true,
    callbackNeeded: true,
    handled: false,
    ai: {
      intent: 'Emergency — cracked molar',
      outcome: 'transferred',
      summary:
        'Caller reported a cracked molar with moderate pain since this morning. AI confirmed he is an existing patient, collected pain level (6/10), and attempted a warm transfer to the on-call line. Transfer connected to Dr. Okafor.',
      followUp: 'open',
      tools: [
        { name: 'lookup_contact', status: 'success', detail: 'Matched existing patient record' },
        { name: 'classify_urgency', status: 'success', detail: 'Urgent — dental pain' },
        { name: 'transfer_call', status: 'success', detail: 'On-call line, connected after 14s' },
      ],
      transcript: [
        { speaker: 'agent', text: 'Thanks for calling Harbor & Pine Dental, this is Ava. How can I help?', at: '0:00' },
        { speaker: 'caller', text: 'Hi, I think I cracked a tooth this morning. It really hurts when I bite down.', at: '0:05' },
        { speaker: 'agent', text: "I'm sorry to hear that. On a scale of one to ten, how would you rate the pain right now?", at: '0:12' },
        { speaker: 'caller', text: 'Probably a six. It comes and goes.', at: '0:19' },
        { speaker: 'agent', text: "Understood. I'm going to connect you with our on-call dentist now. Please stay on the line.", at: '0:24' },
      ],
    },
  },
  {
    id: 'call_1003',
    contactId: 'c3',
    caller: 'Aisha Bello',
    callerNumber: '+13125559034',
    numberId: 'n3',
    direction: 'inbound',
    startedAt: at(2.1),
    durationSec: 0,
    outcome: 'missed',
    routedTo: 'Carrier forward → MCTB',
    recording: false,
    callbackNeeded: true,
    handled: false,
    mctb: {
      state: 'replied',
      pressOne: 'pressed',
      messageStatus: 'delivered',
      template: 'Sorry we missed you',
      reply: 'Hi! Wanted to ask about Invisalign pricing. Can someone call me after 5?',
      threadId: 't1',
    },
  },
  {
    id: 'call_1004',
    contactId: 'c5',
    caller: 'Sofia Marchetti',
    callerNumber: '+13125554456',
    numberId: 'n1',
    direction: 'inbound',
    startedAt: at(3.4),
    durationSec: 248,
    outcome: 'ai_handled',
    routedTo: 'AI Receptionist (after-hours)',
    recording: true,
    callbackNeeded: false,
    handled: true,
    ai: {
      intent: 'Book whitening consultation',
      outcome: 'booked',
      summary:
        'New caller interested in professional whitening. AI answered pricing FAQ, checked availability and booked a 30-minute consultation for Tue Oct 20 at 10:30 AM with Dr. Okafor. Confirmation SMS sent.',
      followUp: 'done',
      tools: [
        { name: 'search_knowledge', status: 'success', detail: 'FAQ: Whitening pricing' },
        { name: 'check_availability', status: 'success', detail: 'Google Calendar — 4 slots returned' },
        { name: 'book_appointment', status: 'success', detail: 'Whitening consult · Oct 20, 10:30 AM' },
        { name: 'send_sms', status: 'success', detail: 'Booking confirmation delivered' },
      ],
      transcript: [
        { speaker: 'agent', text: 'Thanks for calling Harbor & Pine Dental. Our office is closed, but I can help. What can I do for you?', at: '0:00' },
        { speaker: 'caller', text: 'I wanted to know how much whitening costs and if I can book something.', at: '0:06' },
        { speaker: 'agent', text: 'In-office whitening starts at $349. I can book a free 30-minute consultation. Does Tuesday morning work?', at: '0:14' },
        { speaker: 'caller', text: 'Tuesday at 10:30 would be perfect.', at: '0:26' },
      ],
    },
  },
  {
    id: 'call_1005',
    contactId: 'c2',
    caller: 'Marcus Chen',
    callerNumber: '+17735552210',
    numberId: 'n2',
    direction: 'outbound',
    startedAt: at(4.0),
    durationSec: 92,
    outcome: 'answered',
    routedTo: 'Power Dialer — Fall recall',
    user: 'Priya Natarajan',
    recording: true,
    callbackNeeded: false,
    handled: true,
    campaignId: 'cmp1',
    disposition: 'Connected',
  },
  {
    id: 'call_1006',
    contactId: 'c7',
    caller: 'Hannah Brooks',
    callerNumber: '+13125557712',
    numberId: 'n1',
    direction: 'inbound',
    startedAt: at(5.2),
    durationSec: 41,
    outcome: 'voicemail',
    routedTo: 'Front desk → voicemail',
    recording: true,
    callbackNeeded: true,
    handled: false,
    voicemail: {
      durationSec: 38,
      transcript:
        'Hi, this is Hannah Brooks. I need to reschedule my cleaning on Thursday — something came up at work. Please give me a call back at this number. Thanks.',
    },
    mctb: {
      state: 'suppressed',
      pressOne: 'not_offered',
      messageStatus: 'not_sent',
      suppressionReason: 'Contact replied STOP on Sep 12 — opted out',
    },
  },
  {
    id: 'call_1007',
    contactId: 'c8',
    caller: 'Victor Nguyen',
    callerNumber: '+16305556641',
    numberId: 'n3',
    direction: 'inbound',
    startedAt: at(6.6),
    durationSec: 0,
    outcome: 'missed',
    routedTo: 'Carrier forward → MCTB',
    recording: false,
    callbackNeeded: true,
    handled: false,
    mctb: {
      state: 'consent_pending',
      pressOne: 'no_input',
      messageStatus: 'not_sent',
      suppressionReason: 'No keypress — consent not recorded',
    },
  },
  {
    id: 'call_1008',
    contactId: 'c11',
    caller: 'Leila Haddad',
    callerNumber: '+13125552267',
    numberId: 'n1',
    direction: 'inbound',
    startedAt: at(8.1),
    durationSec: 133,
    outcome: 'ai_handled',
    routedTo: 'AI Receptionist (overflow)',
    recording: true,
    callbackNeeded: true,
    handled: false,
    ai: {
      intent: 'Insurance question — Delta PPO',
      outcome: 'unresolved',
      summary:
        'Caller asked whether the practice is in-network for Delta Dental PPO Plus Premier. AI could not confirm from knowledge base and took a callback request for 3–5 PM.',
      followUp: 'open',
      tools: [
        { name: 'search_knowledge', status: 'failed', detail: 'No confident answer for "Delta PPO Plus Premier"' },
        { name: 'create_callback', status: 'success', detail: 'Requested window 3–5 PM' },
      ],
      transcript: [
        { speaker: 'caller', text: 'Do you take Delta Dental PPO Plus Premier?', at: '0:08' },
        { speaker: 'agent', text: "I want to make sure I give you the right answer. Can I have someone from billing call you back to confirm?", at: '0:14' },
      ],
    },
  },
  {
    id: 'call_1009',
    contactId: 'c9',
    caller: 'Grace Kim',
    callerNumber: '+13125550987',
    numberId: 'n1',
    direction: 'inbound',
    startedAt: at(9.0),
    durationSec: 0,
    outcome: 'missed',
    routedTo: 'Front desk ring group',
    recording: false,
    callbackNeeded: true,
    handled: false,
    mctb: {
      state: 'texted',
      pressOne: 'pressed',
      messageStatus: 'delivered',
      template: 'Sorry we missed you',
      threadId: 't3',
    },
  },
  {
    id: 'call_1010',
    contactId: 'c13',
    caller: 'Nadia Petrova',
    callerNumber: '+13125556120',
    numberId: 'n1',
    direction: 'inbound',
    startedAt: at(11.5),
    durationSec: 162,
    outcome: 'ai_handled',
    routedTo: 'AI Receptionist (after-hours)',
    recording: true,
    callbackNeeded: false,
    handled: true,
    ai: {
      intent: 'Invisalign info request',
      outcome: 'message',
      summary: 'Caller asked about Invisalign timelines. AI shared general info and sent the consultation booking link by SMS.',
      followUp: 'done',
      tools: [
        { name: 'search_knowledge', status: 'success', detail: 'FAQ: Invisalign treatment length' },
        { name: 'send_link', status: 'success', detail: 'Booking link delivered by SMS' },
      ],
      transcript: [
        { speaker: 'caller', text: 'How long does Invisalign usually take?', at: '0:04' },
        { speaker: 'agent', text: 'Most treatments take 6 to 18 months. Would you like me to text you a link to book a free consult?', at: '0:09' },
      ],
    },
  },
  {
    id: 'call_1011',
    contactId: 'c10',
    caller: 'Derek Thompson',
    callerNumber: '+17735558804',
    numberId: 'n1',
    direction: 'inbound',
    startedAt: at(12.4),
    durationSec: 12,
    outcome: 'ai_handled',
    routedTo: 'AI Receptionist (overflow)',
    recording: false,
    callbackNeeded: false,
    handled: true,
    ai: {
      intent: 'Solicitor — SEO services',
      outcome: 'failed',
      summary: 'Unwanted solicitor. AI politely declined and ended the call per spam policy.',
      followUp: 'none',
      tools: [{ name: 'classify_spam', status: 'success', detail: 'Solicitor — ended call' }],
      transcript: [],
    },
  },
  {
    id: 'call_1012',
    contactId: 'c6',
    caller: 'James Okonkwo',
    callerNumber: '+17735553389',
    numberId: 'n3',
    direction: 'inbound',
    startedAt: at(14.0),
    durationSec: 0,
    outcome: 'missed',
    routedTo: 'Carrier forward → MCTB',
    recording: false,
    callbackNeeded: true,
    handled: false,
    mctb: {
      state: 'needs_callback',
      pressOne: 'pressed',
      messageStatus: 'delivered',
      template: 'Sorry we missed you',
      reply: 'Calling about a corporate plan for ~40 employees. Please call back.',
      threadId: 't2',
    },
  },
  {
    id: 'call_1013',
    contactId: 'c15',
    caller: 'Clara Johansson',
    callerNumber: '+13125553398',
    numberId: 'n3',
    direction: 'inbound',
    startedAt: at(20.0),
    durationSec: 0,
    outcome: 'missed',
    routedTo: 'Carrier forward → MCTB',
    recording: false,
    callbackNeeded: false,
    handled: false,
    mctb: {
      state: 'failed',
      pressOne: 'pressed',
      messageStatus: 'failed',
      template: 'Sorry we missed you',
      suppressionReason: 'Carrier rejected — landline number cannot receive SMS',
    },
  },
]

const genNames = CONTACTS.slice(0, 16)
const genOutcomes: CallOutcome[] = ['answered', 'answered', 'answered', 'missed', 'voicemail', 'answered', 'ai_handled']
const genUsers = ['Daniel Reyes', 'Priya Natarajan', 'Maya Okafor']

const generatedCalls: Call[] = Array.from({ length: 34 }, (_, i) => {
  const c = genNames[(i * 7) % genNames.length]
  const outbound = i % 3 === 0
  const outcome: CallOutcome = outbound ? (i % 4 === 0 ? 'missed' : 'answered') : genOutcomes[i % genOutcomes.length]
  const duration = outcome === 'answered' ? 45 + ((i * 53) % 420) : outcome === 'voicemail' ? 30 : outcome === 'ai_handled' ? 90 + i * 3 : 0
  return {
    id: `call_${2000 + i}`,
    contactId: c.id,
    caller: c.name,
    callerNumber: c.phone,
    numberId: outbound ? 'n2' : 'n1',
    direction: outbound ? 'outbound' : 'inbound',
    startedAt: at(22 + i * 3.7),
    durationSec: duration,
    outcome,
    routedTo: outbound ? 'Manual dial' : outcome === 'ai_handled' ? 'AI Receptionist (after-hours)' : 'Front desk ring group',
    user: outcome === 'answered' || outbound ? genUsers[i % 3] : undefined,
    recording: outcome === 'answered' && i % 2 === 0,
    callbackNeeded: false,
    handled: true,
    voicemail: outcome === 'voicemail' ? { durationSec: 28, transcript: 'Hi, just calling to confirm my appointment next week. Thanks!' } : undefined,
    ai:
      outcome === 'ai_handled'
        ? {
            intent: 'Appointment confirmation',
            outcome: i % 2 === 0 ? 'booked' : 'callback',
            summary: 'Caller asked to confirm or move an upcoming appointment.',
            followUp: 'done',
            tools: [{ name: 'check_availability', status: 'success', detail: 'Calendar checked' }],
            transcript: [],
          }
        : undefined,
  }
})

export const CALLS: Call[] = [...richCalls, ...generatedCalls]

export const getCall = (id: string) => CALLS.find((c) => c.id === id)
export const getContact = (id?: string) => CONTACTS.find((c) => c.id === id)
export const getNumber = (id: string) => NUMBERS.find((n) => n.id === id)
export const callsForContact = (id: string) => CALLS.filter((c) => c.contactId === id)

export type Campaign = {
  id: string
  name: string
  listId: string
  owner: string
  status: 'active' | 'paused' | 'draft' | 'completed'
  attempts: number
  completedPct: number
  created: string
  callerId: string
  maxAttempts: number
}

export const LISTS = [
  { id: 'l1', name: 'Fall recall — overdue 6mo+', entries: 184, eligible: 161, ineligible: 23, source: 'Contacts filter', updated: at(30) },
  { id: 'l2', name: 'Invisalign inquiries Q3', entries: 52, eligible: 49, ineligible: 3, source: 'CSV import', updated: at(80) },
  { id: 'l3', name: 'Corporate plan prospects', entries: 37, eligible: 31, ineligible: 6, source: 'CSV import', updated: at(140) },
]

export const CAMPAIGNS: Campaign[] = [
  { id: 'cmp1', name: 'Fall recall outreach', listId: 'l1', owner: 'Priya Natarajan', status: 'active', attempts: 212, completedPct: 58, created: at(240), callerId: '+13125550199', maxAttempts: 3 },
  { id: 'cmp2', name: 'Invisalign follow-up', listId: 'l2', owner: 'Daniel Reyes', status: 'paused', attempts: 61, completedPct: 74, created: at(400), callerId: '+13125550199', maxAttempts: 2 },
  { id: 'cmp3', name: 'Corporate plans — Q4', listId: 'l3', owner: 'Maya Okafor', status: 'draft', attempts: 0, completedPct: 0, created: at(30), callerId: '+13125550142', maxAttempts: 3 },
]

export const DIALER_QUEUE = [
  { contactId: 'c12', attempts: 1, tz: 'CT', lastResult: 'No answer · Oct 14', notes: 'Last cleaning Mar 2026. Prefers mornings.' },
  { contactId: 'c14', attempts: 0, tz: 'CT', lastResult: '—', notes: 'Recall overdue 7 months.' },
  { contactId: 'c16', attempts: 2, tz: 'CT', lastResult: 'Voicemail · Oct 15', notes: 'Asked about family plan pricing.' },
  { contactId: 'c2', attempts: 1, tz: 'CT', lastResult: 'Callback · Oct 16', notes: 'Callback requested after 4pm.' },
]

export type Thread = {
  id: string
  contactId: string
  source: string
  unread: boolean
  needsReply: boolean
  owner?: string
  kind: 'mctb' | 'ai_followup' | 'direct'
  optedOut: boolean
  callId?: string
  attribution: 'confirmed' | 'unresolved'
  messages: { from: 'customer' | 'business' | 'system'; text: string; at: string }[]
}

export const THREADS: Thread[] = [
  {
    id: 't1',
    contactId: 'c3',
    source: 'Lincoln Park office',
    unread: true,
    needsReply: true,
    kind: 'mctb',
    optedOut: false,
    callId: 'call_1003',
    attribution: 'confirmed',
    messages: [
      { from: 'system', text: 'Caller pressed 1 to receive a text. Consent recorded.', at: at(2.1) },
      { from: 'business', text: "Hi, it's Harbor & Pine Dental — sorry we missed your call! Reply here or book online: hp.dental/book. Reply STOP to opt out.", at: at(2.09) },
      { from: 'customer', text: 'Hi! Wanted to ask about Invisalign pricing. Can someone call me after 5?', at: at(1.9) },
    ],
  },
  {
    id: 't2',
    contactId: 'c6',
    source: 'Lincoln Park office',
    unread: true,
    needsReply: true,
    owner: 'Daniel Reyes',
    kind: 'mctb',
    optedOut: false,
    callId: 'call_1012',
    attribution: 'unresolved',
    messages: [
      { from: 'system', text: 'Caller pressed 1 to receive a text. Consent recorded.', at: at(14) },
      { from: 'business', text: "Hi, it's Harbor & Pine Dental — sorry we missed your call! Reply here or book online: hp.dental/book. Reply STOP to opt out.", at: at(13.99) },
      { from: 'customer', text: 'Calling about a corporate plan for ~40 employees. Please call back.', at: at(13.5) },
    ],
  },
  {
    id: 't3',
    contactId: 'c9',
    source: 'Main line',
    unread: false,
    needsReply: false,
    owner: 'Maya Okafor',
    kind: 'mctb',
    optedOut: false,
    callId: 'call_1009',
    attribution: 'confirmed',
    messages: [
      { from: 'system', text: 'Caller pressed 1 to receive a text. Consent recorded.', at: at(9) },
      { from: 'business', text: "Hi, it's Harbor & Pine Dental — sorry we missed your call! Reply here or book online: hp.dental/book. Reply STOP to opt out.", at: at(8.99) },
    ],
  },
  {
    id: 't4',
    contactId: 'c5',
    source: 'Main line',
    unread: false,
    needsReply: false,
    kind: 'ai_followup',
    optedOut: false,
    callId: 'call_1004',
    attribution: 'confirmed',
    messages: [
      { from: 'business', text: 'You are booked: Whitening consultation, Tue Oct 20 at 10:30 AM with Dr. Okafor. Reply C to confirm or R to reschedule.', at: at(3.3) },
      { from: 'customer', text: 'C', at: at(3.1) },
    ],
  },
  {
    id: 't5',
    contactId: 'c13',
    source: 'Main line',
    unread: true,
    needsReply: false,
    kind: 'ai_followup',
    optedOut: false,
    callId: 'call_1010',
    attribution: 'confirmed',
    messages: [
      { from: 'business', text: 'Thanks for calling Harbor & Pine! Book your free Invisalign consult here: hp.dental/invisalign', at: at(11.4) },
    ],
  },
]

export const FAQS = [
  { id: 'f1', q: 'How much does professional whitening cost?', a: 'In-office whitening starts at $349. Take-home trays are $199.', status: 'published', source: 'Manual' },
  { id: 'f2', q: 'Do you accept new patients?', a: 'Yes — we accept new patients of all ages, including children over 3.', status: 'published', source: 'Website import' },
  { id: 'f3', q: 'What insurance do you accept?', a: 'We are in-network with Delta Dental PPO, Cigna, MetLife and Aetna.', status: 'published', source: 'Website import' },
  { id: 'f4', q: 'How long does Invisalign take?', a: 'Most treatments take 6–18 months depending on complexity.', status: 'published', source: 'Manual' },
  { id: 'f5', q: 'Do you offer payment plans?', a: 'Yes, through CareCredit with 0% financing for 12 months on approved credit.', status: 'draft', source: 'Manual' },
]

export const SOURCES = [
  { id: 's1', name: 'harborpinedental.com', kind: 'Website', status: 'synced', lastProcessed: at(26), items: 42 },
  { id: 's2', name: 'New patient packet.pdf', kind: 'File', status: 'synced', lastProcessed: at(300), items: 18 },
  { id: 's3', name: 'harborpinedental.com/insurance', kind: 'Website', status: 'stale', lastProcessed: at(1100), items: 6 },
  { id: 's4', name: 'Fee schedule 2026.xlsx', kind: 'File', status: 'failed', lastProcessed: at(50), items: 0 },
]

export const GAPS = [
  { id: 'g1', question: 'Are you in-network for Delta Dental PPO Plus Premier?', count: 4, lastCallId: 'call_1008', impact: 'high' },
  { id: 'g2', question: 'Do you offer sedation for anxious patients?', count: 3, lastCallId: 'call_1002', impact: 'medium' },
  { id: 'g3', question: 'Is there parking at the Lakeshore office?', count: 2, lastCallId: 'call_1010', impact: 'low' },
]

export const APPOINTMENT_TYPES = [
  { id: 'a1', title: 'New patient exam', length: 60, location: 'Lakeshore office', calendar: 'Dr. Okafor', buffer: 15, active: true },
  { id: 'a2', title: 'Cleaning', length: 45, location: 'Lakeshore office', calendar: 'Hygiene team', buffer: 10, active: true },
  { id: 'a3', title: 'Whitening consultation', length: 30, location: 'Lakeshore office', calendar: 'Dr. Okafor', buffer: 0, active: true },
  { id: 'a4', title: 'Invisalign consult', length: 45, location: 'Lincoln Park office', calendar: 'Dr. Reyes', buffer: 15, active: false },
]

export const TRANSFERS = [
  { id: 'tr1', name: 'On-call dentist', number: '+13125550177', scenario: 'Urgent pain, swelling, trauma', enabled: true },
  { id: 'tr2', name: 'Billing desk', number: '+13125550150', scenario: 'Insurance & payment questions (business hours)', enabled: true },
  { id: 'tr3', name: 'Maya Okafor (owner)', number: '+13125550101', scenario: 'Caller asks for the owner by name', enabled: false },
]

export const INTEGRATIONS = [
  { id: 'google-calendar', name: 'Google Calendar', category: 'Calendar', status: 'connected', detail: 'maya@harborpine.com · 3 calendars', lastSync: at(0.2), impacts: ['AI booking', 'Availability'] },
  { id: 'microsoft-365', name: 'Microsoft 365 Calendar', category: 'Calendar', status: 'available', detail: 'Outlook calendars for booking', lastSync: null, impacts: ['AI booking'] },
  { id: 'calendly', name: 'Calendly', category: 'Calendar', status: 'error', detail: 'Token expired Oct 16 — reconnect required', lastSync: at(52), impacts: ['Booking links'] },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', status: 'available', detail: 'Sync contacts and call activity', lastSync: null, impacts: ['Lead sync'] },
  { id: 'slack', name: 'Slack', category: 'Notifications', status: 'connected', detail: '#front-desk · urgent calls & callbacks', lastSync: at(1), impacts: ['Notifications'] },
  { id: 'email', name: 'Email digests', category: 'Notifications', status: 'connected', detail: 'Daily digest to 2 recipients', lastSync: at(16), impacts: ['Notifications'] },
  { id: 'webhooks', name: 'Webhooks', category: 'Webhooks', status: 'available', detail: 'POST call.completed, mctb.replied events', lastSync: null, impacts: ['Custom automations'] },
]

export const NOTIFICATIONS = [
  { id: 'nt1', title: 'Callback requested', body: 'Leila Haddad asked for a billing callback 3–5 PM.', href: '/app/calls/call_1008', at: at(8.1), read: false, kind: 'callback' },
  { id: 'nt2', title: 'Forwarding not verified', body: 'Lincoln Park office: source number not identified on last test.', href: '/app/numbers/connections/c1', at: at(20), read: false, kind: 'warning' },
  { id: 'nt3', title: 'Calendly disconnected', body: 'Booking links may fail until you reconnect.', href: '/app/integrations', at: at(52), read: false, kind: 'error' },
  { id: 'nt4', title: 'New knowledge gap', body: '"Delta Dental PPO Plus Premier" asked 4 times.', href: '/app/receptionist/knowledge', at: at(8), read: true, kind: 'info' },
]

export const ROUTE_POLICY_DEFAULT = {
  numberId: 'n1',
  duringHours: 'ring_group' as 'ring_group' | 'user' | 'external' | 'ai' | 'voicemail',
  ringStrategy: 'simultaneous' as 'simultaneous' | 'sequential',
  ringTimeout: 35,
  noAnswer: 'ai' as 'ai' | 'voicemail' | 'external',
  afterHours: 'ai' as 'ai' | 'voicemail' | 'external',
  aiCoverage: 'after_hours_overflow' as 'full_time' | 'after_hours' | 'overflow' | 'after_hours_overflow' | 'off',
  mctbEnabled: true,
  updatedAt: at(48),
  updatedBy: 'Maya Okafor',
}

export type RoutePolicy = typeof ROUTE_POLICY_DEFAULT

export const PHONE_TREND = [
  { day: 'Oct 12', inbound: 64, outbound: 38, missed: 7 },
  { day: 'Oct 13', inbound: 72, outbound: 51, missed: 9 },
  { day: 'Oct 14', inbound: 69, outbound: 44, missed: 5 },
  { day: 'Oct 15', inbound: 81, outbound: 57, missed: 11 },
  { day: 'Oct 16', inbound: 77, outbound: 49, missed: 6 },
  { day: 'Oct 17', inbound: 42, outbound: 12, missed: 4 },
  { day: 'Oct 18', inbound: 36, outbound: 22, missed: 3 },
]

export const HOURLY_VOLUME = [
  { hour: '8a', calls: 14 }, { hour: '9a', calls: 26 }, { hour: '10a', calls: 31 }, { hour: '11a', calls: 28 },
  { hour: '12p', calls: 17 }, { hour: '1p', calls: 22 }, { hour: '2p', calls: 25 }, { hour: '3p', calls: 29 },
  { hour: '4p', calls: 21 }, { hour: '5p', calls: 12 }, { hour: '6p', calls: 6 },
]

export const AI_TREND = [
  { day: 'Oct 12', handled: 18, booked: 6, transferred: 3 },
  { day: 'Oct 13', handled: 22, booked: 8, transferred: 4 },
  { day: 'Oct 14', handled: 15, booked: 5, transferred: 2 },
  { day: 'Oct 15', handled: 27, booked: 11, transferred: 5 },
  { day: 'Oct 16', handled: 24, booked: 9, transferred: 3 },
  { day: 'Oct 17', handled: 31, booked: 12, transferred: 2 },
  { day: 'Oct 18', handled: 19, booked: 7, transferred: 2 },
]

export const AI_INTENTS = [
  { intent: 'Book appointment', calls: 58 },
  { intent: 'Reschedule / cancel', calls: 34 },
  { intent: 'Insurance question', calls: 22 },
  { intent: 'Pricing', calls: 19 },
  { intent: 'Emergency', calls: 9 },
  { intent: 'Solicitor / spam', calls: 14 },
]

export const MCTB_FUNNEL = [
  { stage: 'Missed calls', value: 96, note: 'No eligible human or AI answer' },
  { stage: 'Consent offered', value: 81, note: 'Press-1 disclosure played' },
  { stage: 'Consent recorded', value: 57, note: 'Caller pressed 1' },
  { stage: 'Message delivered', value: 53, note: 'Carrier delivery receipt' },
  { stage: 'Replied', value: 29, note: 'Inbound SMS on thread' },
  { stage: 'Recovered', value: 17, note: 'Callback completed or booked' },
]
