export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

export const business = {
  name: 'Brightline Plumbing & Heating',
  receptionist: 'Amy',
  voice: 'Aria — warm, American English',
  line: '(512) 555-0142',
  forwardTo: '(512) 555-0199',
  timezone: 'America/Chicago',
  website: 'brightlineplumbing.com',
}

export type CallOutcome = 'Appointment' | 'Lead' | 'Message' | 'Transfer' | 'Voicemail' | 'No answer'

export type Call = {
  id: string
  caller: string
  number: string
  time: string
  date: string
  duration: string
  outcome: CallOutcome
  attention?: string
  recording: boolean
  summary: string
}

export const outcomeTone: Record<CallOutcome, Tone> = {
  Appointment: 'success',
  Lead: 'primary',
  Message: 'info',
  Transfer: 'neutral',
  Voicemail: 'warning',
  'No answer': 'danger',
}

export const calls: Call[] = [
  { id: 'c_1042', caller: 'Marcus Chen', number: '(512) 555-0187', time: '10:42 AM', date: 'Today', duration: '3:14', outcome: 'Appointment', recording: true, summary: 'Booked water heater inspection for Thursday 9:00 AM.' },
  { id: 'c_1041', caller: 'Priya Natarajan', number: '(737) 555-0123', time: '10:08 AM', date: 'Today', duration: '1:52', outcome: 'Lead', attention: 'Quote requested', recording: true, summary: 'Wants a quote for full bathroom repipe. Asked for callback.' },
  { id: 'c_1040', caller: 'Unknown caller', number: '(512) 555-0110', time: '9:31 AM', date: 'Today', duration: '0:48', outcome: 'Message', recording: true, summary: 'Left a message regarding an invoice question.' },
  { id: 'c_1039', caller: 'Dana Whitfield', number: '(512) 555-0164', time: '8:55 AM', date: 'Today', duration: '2:06', outcome: 'Transfer', recording: true, summary: 'Emergency leak — transferred to on-call technician.' },
  { id: 'c_1038', caller: 'Jorge Alvarez', number: '(830) 555-0191', time: '6:12 PM', date: 'Yesterday', duration: '0:37', outcome: 'Voicemail', attention: 'Callback requested', recording: true, summary: 'Asked for a callback about a clogged drain.' },
  { id: 'c_1037', caller: 'Hannah Brooks', number: '(512) 555-0145', time: '4:40 PM', date: 'Yesterday', duration: '4:21', outcome: 'Appointment', recording: true, summary: 'Booked annual furnace tune-up for next Monday.' },
  { id: 'c_1036', caller: 'Liam O’Connor', number: '(737) 555-0102', time: '2:15 PM', date: 'Yesterday', duration: '0:00', outcome: 'No answer', recording: false, summary: 'Caller hung up before greeting.' },
  { id: 'c_1035', caller: 'Sofia Rossi', number: '(512) 555-0176', time: '11:03 AM', date: 'Yesterday', duration: '2:48', outcome: 'Lead', attention: 'Knowledge gap', recording: true, summary: 'Asked about tankless financing — receptionist did not have an answer.' },
  { id: 'c_1034', caller: 'Ethan Park', number: '(512) 555-0133', time: '9:20 AM', date: 'Sep 23', duration: '1:34', outcome: 'Message', recording: true, summary: 'Requested a copy of last invoice by email.' },
  { id: 'c_1033', caller: 'Grace Kim', number: '(737) 555-0158', time: '5:47 PM', date: 'Sep 22', duration: '3:02', outcome: 'Appointment', recording: true, summary: 'Booked sump pump installation estimate.' },
]

export type RecoveryStatus = 'Replied' | 'Sent' | 'Waiting for consent' | 'Suppressed' | 'Failed' | 'Needs reply'
export type Trigger = 'No answer' | 'Busy' | 'Rejected' | 'Unreachable' | 'Voicemail'

export const recoveryTone: Record<RecoveryStatus, Tone> = {
  Replied: 'success',
  Sent: 'info',
  'Waiting for consent': 'warning',
  Suppressed: 'neutral',
  Failed: 'danger',
  'Needs reply': 'primary',
}

export type MissedCall = {
  id: string
  caller: string
  number: string
  missed: string
  trigger: Trigger
  recovery: RecoveryStatus
  reply: string | null
  line: string
}

export const missedCalls: MissedCall[] = [
  { id: 'm_2210', caller: 'Olivia Martinez', number: '(512) 555-0120', missed: '2 min ago', trigger: 'No answer', recovery: 'Needs reply', reply: 'Yes please — the kitchen sink is backing up.', line: 'Main line' },
  { id: 'm_2209', caller: 'Ben Carter', number: '(737) 555-0181', missed: '18 min ago', trigger: 'Busy', recovery: 'Replied', reply: 'Tomorrow morning works.', line: 'Main line' },
  { id: 'm_2208', caller: '(512) 555-0199', number: '(512) 555-0199', missed: '42 min ago', trigger: 'Voicemail', recovery: 'Waiting for consent', reply: null, line: 'Main line' },
  { id: 'm_2207', caller: 'Aisha Rahman', number: '(830) 555-0114', missed: '1 hr ago', trigger: 'No answer', recovery: 'Needs reply', reply: 'How much for a water heater swap?', line: 'After-hours' },
  { id: 'm_2206', caller: 'Tom Nguyen', number: '(512) 555-0156', missed: '2 hr ago', trigger: 'Rejected', recovery: 'Sent', reply: null, line: 'Main line' },
  { id: 'm_2205', caller: 'Rachel Stein', number: '(737) 555-0137', missed: '3 hr ago', trigger: 'Unreachable', recovery: 'Failed', reply: null, line: 'Main line' },
  { id: 'm_2204', caller: 'Blocked vendor', number: '(800) 555-0100', missed: '4 hr ago', trigger: 'No answer', recovery: 'Suppressed', reply: null, line: 'Main line' },
  { id: 'm_2203', caller: 'Kevin Walsh', number: '(512) 555-0172', missed: 'Yesterday', trigger: 'No answer', recovery: 'Replied', reply: 'Thanks, booked online.', line: 'After-hours' },
  { id: 'm_2202', caller: 'Mia Johnson', number: '(512) 555-0148', missed: 'Yesterday', trigger: 'Busy', recovery: 'Needs reply', reply: 'Can someone come out Saturday?', line: 'Main line' },
  { id: 'm_2201', caller: 'Daniel Foster', number: '(737) 555-0165', missed: 'Yesterday', trigger: 'Voicemail', recovery: 'Replied', reply: 'All good now, thanks!', line: 'Main line' },
]

export type Message = {
  from: 'customer' | 'business' | 'ai' | 'system'
  text: string
  time: string
  status?: 'Delivered' | 'Read' | 'Failed'
}

export type Conversation = {
  id: string
  name: string
  number: string
  preview: string
  time: string
  unread: boolean
  needsReply: boolean
  tag?: string
  missedCallId?: string
  messages: Message[]
}

export const conversations: Conversation[] = [
  {
    id: 'cv_1',
    name: 'Olivia Martinez',
    number: '(512) 555-0120',
    preview: 'Yes please — the kitchen sink is backing up.',
    time: '2m',
    unread: true,
    needsReply: true,
    tag: 'Urgent',
    missedCallId: 'm_2210',
    messages: [
      { from: 'system', text: 'Missed call · No answer · Main line', time: '10:48 AM' },
      { from: 'ai', text: 'Hi, this is Brightline Plumbing — sorry we missed your call! Reply here and we’ll get you taken care of. Reply STOP to opt out.', time: '10:48 AM', status: 'Delivered' },
      { from: 'customer', text: 'Yes please — the kitchen sink is backing up.', time: '10:50 AM' },
      { from: 'ai', text: 'Sorry to hear that! Is water overflowing right now, or is it draining slowly? And what’s the service address?', time: '10:50 AM', status: 'Read' },
      { from: 'customer', text: 'Draining slowly. 2204 Barton Hills Dr.', time: '10:51 AM' },
    ],
  },
  {
    id: 'cv_2',
    name: 'Aisha Rahman',
    number: '(830) 555-0114',
    preview: 'How much for a water heater swap?',
    time: '1h',
    unread: true,
    needsReply: true,
    missedCallId: 'm_2207',
    messages: [
      { from: 'system', text: 'Missed call · No answer · After-hours', time: '9:40 AM' },
      { from: 'ai', text: 'Hi, this is Brightline Plumbing — sorry we missed your call! How can we help?', time: '9:40 AM', status: 'Delivered' },
      { from: 'customer', text: 'How much for a water heater swap?', time: '9:52 AM' },
    ],
  },
  {
    id: 'cv_3',
    name: 'Ben Carter',
    number: '(737) 555-0181',
    preview: 'Tomorrow morning works.',
    time: '18m',
    unread: false,
    needsReply: false,
    tag: 'Booked',
    messages: [
      { from: 'ai', text: 'Sorry we missed you! Want to grab a time? brightline.link/book', time: '10:32 AM', status: 'Read' },
      { from: 'customer', text: 'Tomorrow morning works.', time: '10:34 AM' },
      { from: 'business', text: 'Perfect — you’re booked for 9 AM tomorrow. See you then!', time: '10:36 AM', status: 'Delivered' },
    ],
  },
  {
    id: 'cv_4',
    name: 'Mia Johnson',
    number: '(512) 555-0148',
    preview: 'Can someone come out Saturday?',
    time: '1d',
    unread: false,
    needsReply: true,
    messages: [
      { from: 'ai', text: 'Hi Mia, sorry we missed your call. How can we help?', time: 'Yesterday', status: 'Read' },
      { from: 'customer', text: 'Can someone come out Saturday?', time: 'Yesterday' },
    ],
  },
  {
    id: 'cv_5',
    name: 'Kevin Walsh',
    number: '(512) 555-0172',
    preview: 'Thanks, booked online.',
    time: '1d',
    unread: false,
    needsReply: false,
    messages: [
      { from: 'ai', text: 'Sorry we missed you! Book anytime: brightline.link/book', time: 'Yesterday', status: 'Read' },
      { from: 'customer', text: 'Thanks, booked online.', time: 'Yesterday' },
    ],
  },
  {
    id: 'cv_6',
    name: 'Daniel Foster',
    number: '(737) 555-0165',
    preview: 'All good now, thanks!',
    time: '2d',
    unread: false,
    needsReply: false,
    messages: [
      { from: 'ai', text: 'Hi Daniel — we got your voicemail. Still need help?', time: 'Sep 23', status: 'Read' },
      { from: 'customer', text: 'All good now, thanks!', time: 'Sep 23' },
    ],
  },
]

export type VoicemailItem = {
  id: string
  caller: string
  number: string
  isNew: boolean
  summary: string
  transcript: string
  time: string
  duration: string
}

export const voicemails: VoicemailItem[] = [
  {
    id: 'v_1',
    caller: '(512) 555-0199',
    number: '(512) 555-0199',
    isNew: true,
    summary: 'Caller reports no hot water since this morning. Wants someone out today if possible.',
    transcript:
      'Hi, uh, this is Karen over on Rainey Street. We haven’t had any hot water since this morning — the pilot light seems to be out and I can’t get it relit. If someone could come out today that would be great. My number is 512-555-0199. Thanks.',
    time: '42 min ago',
    duration: '0:38',
  },
  {
    id: 'v_2',
    caller: 'Jorge Alvarez',
    number: '(830) 555-0191',
    isNew: true,
    summary: 'Clogged bathroom drain, requests a callback after 5 PM.',
    transcript:
      'Hey, it’s Jorge. My bathroom drain’s totally clogged — tried the snake, didn’t work. Can you call me back after five? Thanks.',
    time: 'Yesterday · 6:12 PM',
    duration: '0:22',
  },
  {
    id: 'v_3',
    caller: 'Daniel Foster',
    number: '(737) 555-0165',
    isNew: false,
    summary: 'Asked about a dripping outdoor spigot. Low urgency.',
    transcript:
      'Hi, Daniel Foster here. Got an outdoor spigot that keeps dripping even when it’s off. No rush, just whenever you have a slot. Thanks!',
    time: 'Sep 23 · 3:05 PM',
    duration: '0:19',
  },
  {
    id: 'v_4',
    caller: 'Linda Park',
    number: '(512) 555-0109',
    isNew: false,
    summary: 'Following up on a quote she received last week.',
    transcript:
      'Hi, this is Linda Park. Just following up on the repipe quote from last week — we’d like to move ahead. Give me a call when you can.',
    time: 'Sep 22 · 11:48 AM',
    duration: '0:26',
  },
]

function series(days: number, base: number, amp: number, seed: number) {
  return Array.from({ length: days }, (_, i) => {
    const v = base + Math.round(Math.sin((i + seed) / 2.3) * amp + Math.cos((i * seed) / 5) * (amp / 2))
    return Math.max(0, v)
  })
}

const dayLabels = (days: number) =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(2026, 8, 25)
    d.setDate(d.getDate() - (days - 1 - i))
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

export function voiceVolume(days = 30) {
  const labels = dayLabels(days)
  const answered = series(days, 38, 9, 2)
  const booked = series(days, 12, 4, 5)
  return labels.map((date, i) => ({ date, calls: answered[i], booked: booked[i] }))
}

export function mctbVolume(days = 30) {
  const labels = dayLabels(days)
  const missed = series(days, 18, 6, 3)
  const texts = missed.map((m) => Math.round(m * 0.88))
  const replies = texts.map((t, i) => Math.round(t * (0.46 + ((i % 5) * 0.02))))
  return labels.map((date, i) => ({ date, missed: missed[i], texts: texts[i], replies: replies[i] }))
}

export const numbers = [
  { number: '(512) 555-0142', label: 'Main line', type: 'Local', messaging: 'Registered', line: 'Active' },
  { number: '(512) 555-0188', label: 'After-hours', type: 'Local', messaging: 'Registered', line: 'Active' },
  { number: '(888) 555-0130', label: 'Google Ads tracking', type: 'Toll-free', messaging: 'Pending verification', line: 'Active' },
  { number: '(737) 555-0126', label: 'North Austin', type: 'Local', messaging: 'Not enabled', line: 'Inactive' },
]
