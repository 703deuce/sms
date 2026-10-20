/**
 * AI Receptionist configuration. The draft and the live (published) version
 * share this shape; editors write field-granular patches to the draft only.
 * Mandatory guardrails are enforced by runtime and intentionally absent here.
 */

import { RECEPTIONIST_VOICE_OPTIONS } from '@/lib/voice/gpt-live-built-in-voices'
import {
  DEFAULT_CUSTOM_COVERAGE,
  DEFAULT_OPERATING_MATURITY,
  DEFAULT_TRANSFER_ADVANCED,
} from '@/lib/receptionist/operating-defaults'

export type Capability = 'answer' | 'book' | 'reschedule' | 'cancel' | 'message' | 'qualify' | 'transfer' | 'smsConfirm'

export type IntakeField = {
  id: string
  label: string
  type: 'text' | 'phone' | 'email' | 'choice' | 'date' | 'zip'
  options?: string[]
  required: boolean
  qualifies: boolean
  stage: 'start' | 'before_booking' | 'before_transfer' | 'end'
  locked?: boolean
}

export type QualificationRule = {
  id: string
  field: string
  operator: 'in' | 'not_in' | 'equals' | 'contains' | 'exists'
  values: string
  resultStatus?: 'QUALIFIED' | 'NOT_QUALIFIED' | 'NEEDS_REVIEW'
  reasonLabel?: string
}

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export type TimeRange = { start: string; end: string }

export type WeeklyDaySchedule = { closed: boolean; ranges: TimeRange[] }

export type HolidayClosure = {
  id: string
  name: string
  startDate: string
  endDate: string
  closedAllDay: boolean
  ranges?: TimeRange[]
}

export type BusinessScheduleConfig = {
  timezone: string
  weekly: Partial<Record<DayOfWeek, WeeklyDaySchedule>>
  holidays: HolidayClosure[]
}

export type CustomCoverageSchedule = BusinessScheduleConfig

export type AfterHoursWhenClosed = {
  allowLiveBooking: boolean
  allowCallbackRequest: boolean
  allowMessageTaking: boolean
  allowOnCallEscalation: boolean
  allowOfficeTransfer: boolean
  allowNormalTransferDestinations: boolean
}

export type AfterHoursBehaviorConfig = {
  useOperatingStateDuringCalls: boolean
  whenClosed: AfterHoursWhenClosed
}

export type OnCallDestination = {
  label: string
  phoneE164?: string
  transferDestinationId?: string
  contactId?: string
  transferPlanId?: string | null
}

export type OnCallScheduleEntry = {
  id: string
  name?: string
  dayOfWeek?: number
  date?: string
  startTime: string
  endTime: string
  destination: OnCallDestination
  priority: number
  enabled: boolean
}

export type OnCallScheduleConfig = {
  enabled: boolean
  timezone: string
  entries: OnCallScheduleEntry[]
}

export type CallbackSlaPolicy = {
  normalTarget: '30m' | '1h' | 'next_business_day' | 'custom'
  normalCustomMinutes?: number
  urgentTarget: 'immediate' | '15m' | '30m' | 'custom'
  urgentCustomMinutes?: number
}

export type OperatingMaturityConfig = {
  revision: string
  businessSchedule: BusinessScheduleConfig
  afterHoursBehavior: AfterHoursBehaviorConfig
  onCallSchedule: OnCallScheduleConfig
  callbackSla: CallbackSlaPolicy
}

export type TransferPlanStep = {
  order: number
  destinationId: string
  transferMode: 'BASIC' | 'WARM'
  timeoutSeconds: number
}

export type TransferAdvancedConfig = {
  ringSeconds: number
  globalFallback: TransferDestination['fallback']
  routing: 'single' | 'waterfall'
  detectVoicemailOnTransfer: boolean
  humanTransferEnabled: boolean
  planSteps: TransferPlanStep[]
}

export type UrgencyRule = {
  id: string
  label?: string
  field: string
  operator: 'equals' | 'in' | 'contains' | 'exists'
  value: string
  severity: 'URGENT' | 'CRITICAL'
  action: 'TRANSFER' | 'TAKE_MESSAGE' | 'CALLBACK' | 'CONTINUE'
  destinationId?: string
}

export type TransferDestination = {
  id: string
  name: string
  number: string
  enabled: boolean
  reason: string
  fallback: 'backup' | 'callback' | 'message' | 'end'
}

export type AppointmentType = {
  id: string
  name: string
  duration: number
  modality: 'in_person' | 'phone' | 'video'
  location: string
  calendar: string
  hours: string
  noticeHours: number
  advanceDays: number
  booking: 'book' | 'request'
  enabled: boolean
  requiredFields: string[]
}

export type SpamRule = { id: string; kind: 'spam_likely' | 'solicitor' | 'blocked'; action: 'screen' | 'message' | 'transfer' | 'end'; enabled: boolean; note: string }

export type KnowledgeProfile = {
  /** Company name, what you do, location, hours, service area — injected into prompts. */
  businessOverview: string
  /** What this agent is responsible for on calls (receptionist job). */
  agentJob: string
  pricing: string
  policies: string
  paymentMethods: string
}

export const DEFAULT_KNOWLEDGE_PROFILE: KnowledgeProfile = {
  businessOverview: '',
  agentJob: '',
  pricing: '',
  policies: '',
  paymentMethods: '',
}

export type AgentConfig = {
  identity: {
    name: string
    role: string
    language: string
    voice: string
    customVoiceId: string
    greeting: string
  }
  style: {
    pace: 'slow' | 'normal' | 'fast'
    backchannels: 'none' | 'minimal' | 'natural'
    patience: 'quick' | 'normal' | 'patient'
    interruptions: 'natural' | 'yield'
  }
  capabilities: Record<Capability, boolean>
  intake: IntakeField[]
  qualification: { match: 'all' | 'any'; rules: QualificationRule[]; fallback: 'callback' | 'transfer' | 'decline' }
  instructions: string
  memory: boolean
  crmWrite: boolean
  appointments: {
    provider: 'google' | 'microsoft' | 'calendly' | 'none'
    strategy: 'live' | 'request' | 'link' | 'none'
    bookingLink: string
    linkSender: string
    askType: boolean
    askNewExisting: boolean
    preferredDayFirst: boolean
    offerCount: number
    confirmBeforeWrite: boolean
    smsConfirmation: boolean
    allowReschedule: boolean
    allowCancel: boolean
    cancelPolicy: string
    types: AppointmentType[]
  }
  connection: { kind: 'owned' | 'external'; id: string }
  coverage: {
    mode: 'every_call' | 'after_hours' | 'overflow' | 'busy' | 'custom'
    staffFirstSec: number
    customSchedule: CustomCoverageSchedule
  }
  operating: OperatingMaturityConfig
  transferAdvanced: TransferAdvancedConfig
  urgency: { enabled: boolean; rules: UrgencyRule[] }
  transfers: TransferDestination[]
  triggers: Record<'asks_person' | 'emergency' | 'unsupported' | 'booking_staff' | 'custom', boolean>
  customTrigger: string
  transferStyle: 'cold' | 'warm'
  messages: {
    takeMessage: boolean
    callbacks: boolean
    requiredFields: Record<'ani' | 'confirm' | 'time' | 'reason', boolean>
    slaHours: number
    smsRecipients: string
    emailRecipients: string
    urgentAlerts: boolean
    bookingFailureAlerts: boolean
    dailyDigest: boolean
    quietHours: string
  }
  recovery: {
    enabled: boolean
    consentMode: 'disabled' | 'existing' | 'platform'
    carryover: boolean
    delaySec: 0 | 15 | 30
  }
  protection: SpamRule[]
  audio: {
    recording: 'all' | 'inbound' | 'off'
    connectionGreeting: 'none' | 'professional' | 'warm' | 'upload' | 'tts'
    connectionGreetingText: string
  }
  knowledgeProfile: KnowledgeProfile
}

export const VOICES = RECEPTIONIST_VOICE_OPTIONS.map((v) => ({
  id: v.id,
  name: v.name,
  note: v.note,
  recommended: v.recommended,
}))

export const GREETING_VARIABLES = ['{business_name}', '{agent_name}', '{time_of_day}']

export const CAPABILITY_META: Record<Capability, { title: string; description: string; configure?: string; depends?: string; supported: boolean }> = {
  answer: { title: 'Answer business questions', description: 'Uses approved Knowledge to answer pricing, hours, insurance and policy questions.', configure: '/app/receptionist/knowledge', depends: 'Knowledge', supported: true },
  book: { title: 'Book appointments', description: 'Finds availability and books into a connected calendar, or takes a request.', configure: '/app/receptionist/appointments', depends: 'Appointments', supported: true },
  reschedule: { title: 'Reschedule appointments', description: 'Moves an existing appointment after verifying the caller.', configure: '/app/receptionist/appointments', depends: 'Appointments', supported: true },
  cancel: { title: 'Cancel appointments', description: 'Cancels per your policy and offers to rebook.', configure: '/app/receptionist/appointments', depends: 'Appointments', supported: true },
  message: { title: 'Take messages', description: 'Captures a message and creates a follow-up for your team.', configure: '/app/receptionist/call-handling#messages', supported: true },
  qualify: { title: 'Qualify callers', description: 'Asks intake questions and applies your qualification rules.', configure: '#intake', supported: true },
  transfer: { title: 'Transfer to a person', description: 'Hands off to a staff destination when a trigger matches.', configure: '/app/receptionist/call-handling#transfers', depends: 'Transfer destination', supported: true },
  smsConfirm: { title: 'Send SMS booking confirmation / link', description: 'Texts a confirmation or booking link from a platform sender, with consent.', configure: '/app/receptionist/appointments#strategy', depends: 'SMS sender + consent', supported: true },
}

export const DEFAULT_AGENT: AgentConfig = {
  identity: {
    name: 'Ava',
    role: 'Front desk receptionist',
    language: 'en-US',
    voice: 'marin',
    customVoiceId: '',
    greeting: 'Thanks for calling {business_name}, this is {agent_name}. How can I help you {time_of_day}?',
  },
  style: { pace: 'normal', backchannels: 'minimal', patience: 'normal', interruptions: 'natural' },
  capabilities: { answer: true, book: true, reschedule: true, cancel: true, message: true, qualify: false, transfer: true, smsConfirm: true },
  intake: [
    { id: 'i1', label: 'Full name', type: 'text', required: true, qualifies: false, stage: 'start', locked: true },
    { id: 'i2', label: 'Callback number', type: 'phone', required: true, qualifies: false, stage: 'start', locked: true },
    { id: 'i3', label: 'Email', type: 'email', required: false, qualifies: false, stage: 'before_booking', locked: true },
    { id: 'i4', label: 'Insurance provider', type: 'choice', options: ['Delta Dental', 'Cigna', 'MetLife', 'Aetna', 'Self-pay'], required: false, qualifies: false, stage: 'before_booking' },
    { id: 'i5', label: 'ZIP code', type: 'zip', required: false, qualifies: true, stage: 'start' },
  ],
  qualification: {
    match: 'any',
    rules: [{ id: 'q1', field: 'ZIP code', operator: 'in', values: '60601–60661, 60201–60202' }],
    fallback: 'callback',
  },
  instructions: 'Always offer the earliest available cleaning first. Never quote treatment prices beyond those in Knowledge. If the caller mentions swelling or trauma, treat it as urgent.',
  memory: false,
  crmWrite: false,
  appointments: {
    provider: 'google',
    strategy: 'live',
    bookingLink: 'https://hp.dental/book',
    linkSender: 'Main line (+1 312-555-0142)',
    askType: true,
    askNewExisting: true,
    preferredDayFirst: true,
    offerCount: 3,
    confirmBeforeWrite: true,
    smsConfirmation: true,
    allowReschedule: true,
    allowCancel: true,
    cancelPolicy: 'Please give at least 24 hours notice for cancellations.',
    types: [
      { id: 'a1', name: 'New patient exam', duration: 60, modality: 'in_person', location: 'Lakeshore office', calendar: 'Dr. Okafor', hours: 'Mon–Fri 8a–4p', noticeHours: 24, advanceDays: 60, booking: 'book', enabled: true, requiredFields: ['Insurance provider'] },
      { id: 'a2', name: 'Cleaning', duration: 45, modality: 'in_person', location: 'Lakeshore office', calendar: 'Hygiene team', hours: 'Mon–Sat business hours', noticeHours: 12, advanceDays: 90, booking: 'book', enabled: true, requiredFields: [] },
      { id: 'a3', name: 'Whitening consultation', duration: 30, modality: 'video', location: 'Video call', calendar: 'Dr. Okafor', hours: 'Tue & Thu 1p–5p', noticeHours: 4, advanceDays: 30, booking: 'book', enabled: true, requiredFields: [] },
      { id: 'a4', name: 'Invisalign consult', duration: 45, modality: 'in_person', location: 'Lincoln Park office', calendar: 'Dr. Reyes', hours: 'Wed 9a–3p', noticeHours: 48, advanceDays: 45, booking: 'request', enabled: false, requiredFields: ['Insurance provider'] },
    ],
  },
  connection: { kind: 'owned', id: 'n1' },
  coverage: { mode: 'overflow', staffFirstSec: 20, customSchedule: DEFAULT_CUSTOM_COVERAGE },
  operating: DEFAULT_OPERATING_MATURITY,
  transferAdvanced: DEFAULT_TRANSFER_ADVANCED,
  urgency: {
    enabled: true,
    rules: [
      {
        id: 'urg1',
        label: 'Dental emergency keywords',
        field: 'Reason for call',
        operator: 'contains',
        value: 'swelling, trauma, bleeding, severe pain',
        severity: 'CRITICAL',
        action: 'TRANSFER',
        destinationId: 'tr1',
      },
    ],
  },
  transfers: [
    { id: 'tr1', name: 'On-call dentist', number: '+13125550177', enabled: true, reason: 'Urgent pain, swelling, trauma', fallback: 'callback' },
    { id: 'tr2', name: 'Billing desk', number: '+13125550150', enabled: true, reason: 'Insurance & payment questions', fallback: 'message' },
    { id: 'tr3', name: 'Maya Okafor (owner)', number: '+13125550101', enabled: false, reason: 'Caller asks for the owner by name', fallback: 'message' },
  ],
  triggers: { asks_person: true, emergency: true, unsupported: true, booking_staff: false, custom: false },
  customTrigger: '',
  transferStyle: 'cold',
  messages: {
    takeMessage: true,
    callbacks: true,
    requiredFields: { ani: true, confirm: true, time: true, reason: true },
    slaHours: 4,
    smsRecipients: '+1 312-555-0101',
    emailRecipients: 'frontdesk@harborpine.com, maya@harborpine.com',
    urgentAlerts: true,
    bookingFailureAlerts: true,
    dailyDigest: true,
    quietHours: '9:00 PM – 7:00 AM',
  },
  recovery: { enabled: false, consentMode: 'existing', carryover: true, delaySec: 15 },
  protection: [
    { id: 'sp1', kind: 'spam_likely', action: 'screen', enabled: true, note: 'Carrier-labeled spam risk' },
    { id: 'sp2', kind: 'solicitor', action: 'message', enabled: true, note: 'Sales, SEO, merchant services' },
    { id: 'sp3', kind: 'blocked', action: 'end', enabled: true, note: '4 numbers on the block list' },
  ],
  audio: { recording: 'all', connectionGreeting: 'none', connectionGreetingText: 'This call may be recorded for quality.' },
  knowledgeProfile: {
    businessOverview: 'Harbor & Pine Dental — family dentistry on Chicago’s lakefront. Lakeshore office Mon–Fri 8am–5pm, Sat 9am–1pm.',
    agentJob: 'Answer calls professionally, answer common questions from approved knowledge, book and reschedule hygiene and exam visits, and transfer urgent dental pain to the on-call dentist.',
    pricing: 'New patient exam $189. Routine cleaning $165. Whitening consult complimentary.',
    policies: '24-hour cancellation notice. We accept most PPO plans; verify at booking.',
    paymentMethods: 'Card, HSA/FSA, CareCredit, in-office payment plans for treatment over $500.',
  },
}

export function renderGreeting(greeting: string, name: string) {
  return greeting
    .replaceAll('{business_name}', 'Harbor & Pine Dental')
    .replaceAll('{agent_name}', name || 'your assistant')
    .replaceAll('{time_of_day}', 'this afternoon')
}

/** Top-level sections that differ between two configs, used for the publish diff. */
export function diffSections(a: AgentConfig, b: AgentConfig) {
  const labels: Record<keyof AgentConfig, string> = {
    identity: 'Identity & greeting',
    style: 'Conversation style',
    capabilities: 'Capabilities',
    intake: 'Intake fields',
    qualification: 'Qualification rules',
    instructions: 'Conversation instructions',
    memory: 'Caller memory',
    crmWrite: 'CRM writing',
    appointments: 'Appointments',
    connection: 'Number connection',
    coverage: 'Coverage & routing',
    operating: 'Business hours & after-hours',
    transferAdvanced: 'Transfer waterfall',
    urgency: 'Urgency rules',
    transfers: 'Transfer destinations',
    triggers: 'Transfer triggers',
    customTrigger: 'Custom trigger',
    transferStyle: 'Transfer style',
    messages: 'Messages & notifications',
    recovery: 'AI Call Recovery SMS',
    protection: 'Call protection',
    audio: 'Recording & connection audio',
    knowledgeProfile: 'Business knowledge & agent job',
  }
  return (Object.keys(labels) as (keyof AgentConfig)[])
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => ({ key: k, label: labels[k] }))
}
