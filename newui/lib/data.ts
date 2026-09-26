export const BUSINESS = {
  name: 'Northside Plumbing & Heating',
  line: '(512) 555-0142',
  sender: '(512) 555-0199',
  timezone: 'America/Chicago',
  website: 'northsideplumbing.com',
}

export type CallOutcome = 'Appointment' | 'Lead' | 'Message' | 'Transfer' | 'Voicemail' | 'No Answer'

export type VoiceCall = {
  id: string
  caller: string
  phone: string
  date: string
  time: string
  duration: string
  outcome: CallOutcome
  attention?: string
  recording: boolean
  summary: string
}

export const VOICE_CALLS: VoiceCall[] = [
  { id: 'c_1042', caller: 'Maria Gonzalez', phone: '(512) 555-0187', date: 'Sep 25', time: '10:42 AM', duration: '3:12', outcome: 'Appointment', recording: true, summary: 'Water heater leaking in garage. Booked a diagnostic visit for Friday 9–11 AM.' },
  { id: 'c_1041', caller: 'Derek Hall', phone: '(737) 555-0123', date: 'Sep 25', time: '10:05 AM', duration: '1:48', outcome: 'Lead', attention: 'Callback requested', recording: true, summary: 'Wants a quote for a full repipe on a 1970s home. Asked for a callback after 4 PM.' },
  { id: 'c_1040', caller: 'Unknown caller', phone: '(512) 555-0911', date: 'Sep 25', time: '9:31 AM', duration: '0:42', outcome: 'Transfer', recording: true, summary: 'Burst pipe, water on floor. Flagged as emergency and transferred to on-call tech.' },
  { id: 'c_1039', caller: 'Priya Shah', phone: '(512) 555-0166', date: 'Sep 24', time: '5:58 PM', duration: '2:20', outcome: 'Message', recording: true, summary: 'Asked whether we service tankless units from Rinnai. Left a message for the office.' },
  { id: 'c_1038', caller: 'Tom Becker', phone: '(830) 555-0104', date: 'Sep 24', time: '4:17 PM', duration: '4:05', outcome: 'Appointment', recording: true, summary: 'Annual furnace tune-up. Booked Tuesday 1–3 PM, member discount applied.' },
  { id: 'c_1037', caller: 'Alyssa Moore', phone: '(512) 555-0138', date: 'Sep 24', time: '2:44 PM', duration: '1:02', outcome: 'Voicemail', attention: 'Knowledge gap', recording: true, summary: 'Asked about financing options. Receptionist did not have an approved answer.' },
  { id: 'c_1036', caller: 'Kevin Liu', phone: '(512) 555-0172', date: 'Sep 24', time: '11:20 AM', duration: '0:00', outcome: 'No Answer', recording: false, summary: 'Caller hung up before greeting completed.' },
  { id: 'c_1035', caller: 'Sandra Ortiz', phone: '(737) 555-0150', date: 'Sep 23', time: '3:36 PM', duration: '2:51', outcome: 'Lead', recording: true, summary: 'New construction bid inquiry for 4 bathrooms. Collected email and project timeline.' },
  { id: 'c_1034', caller: 'James Whitfield', phone: '(512) 555-0109', date: 'Sep 23', time: '9:12 AM', duration: '3:40', outcome: 'Appointment', recording: true, summary: 'Slow kitchen drain. Booked same-day slot at 2 PM.' },
]

export type RecoveryStatus = 'Replied' | 'Needs attention' | 'Waiting for consent' | 'Suppressed' | 'Failed' | 'Sent'

export type MissedCall = {
  id: string
  caller: string
  phone: string
  missed: string
  trigger: 'No answer' | 'Busy' | 'Rejected' | 'Unreachable' | 'Voicemail'
  recovery: RecoveryStatus
  reply: string | null
  line: string
  conversationId?: string
}

export const MISSED_CALLS: MissedCall[] = [
  { id: 'm_881', caller: 'Rachel Kim', phone: '(512) 555-0193', missed: '12 min ago', trigger: 'No answer', recovery: 'Needs attention', reply: 'Yes please, my AC stopped working', line: 'Main line', conversationId: 'cv_1' },
  { id: 'm_880', caller: 'Brandon Lee', phone: '(737) 555-0145', missed: '48 min ago', trigger: 'Busy', recovery: 'Replied', reply: 'Can someone come tomorrow?', line: 'Main line', conversationId: 'cv_2' },
  { id: 'm_879', caller: '(512) 555-0177', phone: '(512) 555-0177', missed: '1 hr ago', trigger: 'Voicemail', recovery: 'Waiting for consent', reply: null, line: 'Main line' },
  { id: 'm_878', caller: 'Olivia Carter', phone: '(512) 555-0114', missed: '2 hr ago', trigger: 'No answer', recovery: 'Sent', reply: null, line: 'Service line', conversationId: 'cv_3' },
  { id: 'm_877', caller: 'Marcus Dean', phone: '(830) 555-0182', missed: '3 hr ago', trigger: 'Rejected', recovery: 'Replied', reply: 'Thanks, just booked online', line: 'Main line', conversationId: 'cv_4' },
  { id: 'm_876', caller: '(512) 555-0100', phone: '(512) 555-0100', missed: '5 hr ago', trigger: 'Unreachable', recovery: 'Suppressed', reply: null, line: 'Main line' },
  { id: 'm_875', caller: 'Hannah Price', phone: '(512) 555-0161', missed: 'Yesterday', trigger: 'No answer', recovery: 'Failed', reply: null, line: 'Service line' },
  { id: 'm_874', caller: 'Luis Romero', phone: '(737) 555-0198', missed: 'Yesterday', trigger: 'Busy', recovery: 'Needs attention', reply: 'What are your rates for drain cleaning?', line: 'Main line', conversationId: 'cv_5' },
]

export type Message = { from: 'customer' | 'business' | 'system' | 'ai'; text: string; time: string; status?: string }

export type Conversation = {
  id: string
  name: string
  phone: string
  preview: string
  time: string
  unread: boolean
  needsReply: boolean
  tag?: string
  messages: Message[]
}

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'cv_1', name: 'Rachel Kim', phone: '(512) 555-0193', preview: 'Yes please, my AC stopped working', time: '12m', unread: true, needsReply: true, tag: 'HVAC',
    messages: [
      { from: 'system', text: 'Missed call · No answer · 10:31 AM', time: '10:31 AM' },
      { from: 'business', text: "Hi, this is Northside Plumbing & Heating — sorry we missed your call! Reply STOP to opt out. How can we help?", time: '10:32 AM', status: 'Delivered' },
      { from: 'customer', text: 'Yes please, my AC stopped working', time: '10:35 AM' },
      { from: 'ai', text: "Sorry to hear that! Can you share your address and whether the unit is making any noise? We'll get a tech out quickly.", time: '10:35 AM', status: 'Delivered' },
      { from: 'customer', text: '4410 Ridgeview Dr. It hums but no cold air', time: '10:38 AM' },
    ],
  },
  {
    id: 'cv_2', name: 'Brandon Lee', phone: '(737) 555-0145', preview: 'Can someone come tomorrow?', time: '48m', unread: true, needsReply: true,
    messages: [
      { from: 'system', text: 'Missed call · Busy · 9:55 AM', time: '9:55 AM' },
      { from: 'business', text: "Hi, it's Northside Plumbing — sorry we missed you. What can we help with?", time: '9:56 AM', status: 'Delivered' },
      { from: 'customer', text: 'Toilet keeps running. Can someone come tomorrow?', time: '10:01 AM' },
    ],
  },
  {
    id: 'cv_3', name: 'Olivia Carter', phone: '(512) 555-0114', preview: 'Hi, this is Northside Plumbing — sorry we...', time: '2h', unread: false, needsReply: false,
    messages: [
      { from: 'system', text: 'Missed call · No answer · 8:47 AM', time: '8:47 AM' },
      { from: 'business', text: "Hi, this is Northside Plumbing — sorry we missed your call! Book here: nsph.co/book", time: '8:48 AM', status: 'Delivered' },
    ],
  },
  {
    id: 'cv_4', name: 'Marcus Dean', phone: '(830) 555-0182', preview: 'Thanks, just booked online', time: '3h', unread: false, needsReply: false, tag: 'Booked',
    messages: [
      { from: 'system', text: 'Missed call · Rejected · 7:40 AM', time: '7:40 AM' },
      { from: 'business', text: 'Sorry we missed you! Grab a time that works: nsph.co/book', time: '7:41 AM', status: 'Delivered' },
      { from: 'customer', text: 'Thanks, just booked online', time: '7:52 AM' },
    ],
  },
  {
    id: 'cv_5', name: 'Luis Romero', phone: '(737) 555-0198', preview: 'What are your rates for drain cleaning?', time: '1d', unread: true, needsReply: true,
    messages: [
      { from: 'system', text: 'Missed call · Busy · Yesterday 4:12 PM', time: '4:12 PM' },
      { from: 'business', text: 'Hi from Northside Plumbing — sorry we missed you. How can we help?', time: '4:13 PM', status: 'Delivered' },
      { from: 'customer', text: 'What are your rates for drain cleaning?', time: '4:20 PM' },
    ],
  },
  {
    id: 'cv_6', name: 'Grace Nolan', phone: '(512) 555-0155', preview: 'Perfect, see you Thursday', time: '2d', unread: false, needsReply: true,
    messages: [
      { from: 'customer', text: 'Perfect, see you Thursday', time: 'Tue' },
    ],
  },
]

export type VoicemailItem = {
  id: string
  caller: string
  phone: string
  isNew: boolean
  time: string
  duration: string
  summary: string
  transcript: string | null
}

export const VOICEMAILS: VoicemailItem[] = [
  { id: 'vm_1', caller: 'Unknown caller', phone: '(512) 555-0177', isNew: true, time: '1 hr ago', duration: '0:38', summary: 'Needs a gas line inspection before selling home. Wants a call back today.', transcript: "Hi, I'm selling my house and the inspector flagged the gas line. I need someone to come look at it this week if possible. Please call me back at this number. Thanks." },
  { id: 'vm_2', caller: 'Hannah Price', phone: '(512) 555-0161', isNew: true, time: 'Yesterday', duration: '0:52', summary: 'Garbage disposal jammed; asks about weekend availability.', transcript: "Hey, it's Hannah. My garbage disposal is totally jammed and making a grinding sound. Do you guys do weekends? Call me back when you can." },
  { id: 'vm_3', caller: 'Frank Delgado', phone: '(737) 555-0120', isNew: false, time: 'Sep 23', duration: '1:14', summary: 'Existing customer confirming invoice amount for last visit.', transcript: null },
]

export const CHART_WEEK = [
  { day: 'Mon', calls: 42, missed: 11, texts: 10, replies: 6, booked: 9 },
  { day: 'Tue', calls: 51, missed: 14, texts: 13, replies: 8, booked: 12 },
  { day: 'Wed', calls: 47, missed: 9, texts: 9, replies: 6, booked: 10 },
  { day: 'Thu', calls: 58, missed: 16, texts: 15, replies: 10, booked: 14 },
  { day: 'Fri', calls: 63, missed: 18, texts: 17, replies: 12, booked: 16 },
  { day: 'Sat', calls: 29, missed: 12, texts: 11, replies: 7, booked: 6 },
  { day: 'Sun', calls: 18, missed: 7, texts: 6, replies: 3, booked: 3 },
]

export const NUMBERS = [
  { number: '(512) 555-0142', label: 'Main line', type: 'Forwarded', messaging: 'Registered', line: 'Active' },
  { number: '(512) 555-0199', label: 'Text-back sender', type: 'Local', messaging: 'Registered', line: 'Active' },
  { number: '(737) 555-0111', label: 'Service line', type: 'Local', messaging: 'Pending review', line: 'Active' },
  { number: '(888) 555-0130', label: 'Ads tracking', type: 'Toll-free', messaging: 'Not enabled', line: 'Inactive' },
]
