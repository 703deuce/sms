/**
 * Global Numbers domain. Owned numbers, external forwarding connections, and
 * port requests are distinct records with distinct IDs — never collapsed into
 * one list or one status boolean. All values here are v0 demo data; Cursor
 * replaces them with provider-backed adapters.
 */

export type NumberProduct = 'phone' | 'receptionist' | 'mctb' | 'sms'

export const PRODUCT_LABEL: Record<NumberProduct, string> = {
  phone: 'Phone',
  receptionist: 'Conversational IVR',
  mctb: 'MCTB',
  sms: 'SMS',
}

export const PRODUCT_RETURN: Record<NumberProduct, { label: string; href: string }> = {
  phone: { label: 'Phone call handling', href: '/app/phone/call-handling' },
  receptionist: { label: 'Conversational IVR', href: '/app/receptionist' },
  mctb: { label: 'MCTB recovery settings', href: '/app/mctb/recovery' },
  sms: { label: 'SMS settings', href: '/app/settings' },
}

export type OwnedStatus = 'active' | 'reserved' | 'provisioning' | 'issue' | 'releasing'

export type Assignment = {
  id: string
  product: NumberProduct
  target: string
  schedule: string
  priority: number
  status: 'active' | 'pending'
}

export type OwnedNumber = {
  id: string
  number: string
  nickname: string
  numberType: 'local' | 'toll_free'
  region: string
  country: 'US' | 'CA'
  status: OwnedStatus
  capabilities: { voice: boolean; sms: boolean; mms: boolean }
  assignments: Assignment[]
  destination: string
  addedAt: string
  monthly: number | null
  setupFee: number | null
  defaultCallerId: boolean
  demo?: boolean
}

export type ForwardingType = 'all' | 'no_answer' | 'busy'
export type ConnectionStatus = 'not_tested' | 'pending' | 'verified' | 'needs_attention'

export type TestEvent = {
  id: string
  at: string
  result: 'passed' | 'failed'
  callerId: string | null
  calledLine: string | null
  routedTo: string | null
  note: string
}

export type ExternalConnection = {
  id: string
  number: string
  label: string
  carrier: string
  forwardsTo: string
  products: ('receptionist' | 'mctb')[]
  forwardingTypes: ForwardingType[]
  status: ConnectionStatus
  lastTest: string | null
  tests: TestEvent[]
}

export type PortStatus = 'draft' | 'submitted' | 'info_needed' | 'in_review' | 'scheduled' | 'completed' | 'rejected'

export type PortRequest = {
  id: string
  number: string
  carrierFrom: string
  requestedAt: string
  status: PortStatus
  expectedDate: string | null
  reference: string | null
  owner: string
  serviceAddress: string
  accountMasked: string
  documents: { name: string; uploadedAt: string }[]
  milestones: { label: string; at: string | null; state: 'done' | 'current' | 'upcoming' | 'attention' }[]
}

const NOW = new Date('2026-10-18T15:30:00-05:00').getTime()
export const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString()
export const ahead = (days: number) => new Date(NOW + days * 86_400_000).toISOString()

export const OWNED_SEED: OwnedNumber[] = [
  {
    id: 'n1',
    number: '+13125550142',
    nickname: 'Main line',
    numberType: 'local',
    region: 'Chicago, IL',
    country: 'US',
    status: 'active',
    capabilities: { voice: true, sms: true, mms: true },
    assignments: [
      { id: 'as1', product: 'phone', target: 'Front desk ring group', schedule: 'Business hours', priority: 1, status: 'active' },
      { id: 'as2', product: 'receptionist', target: 'Ava (AI agent)', schedule: 'After hours + no answer', priority: 2, status: 'active' },
      { id: 'as3', product: 'mctb', target: 'Missed-call recovery', schedule: 'When unanswered', priority: 3, status: 'active' },
    ],
    destination: 'Front desk ring group',
    addedAt: ago(24 * 410),
    monthly: 2,
    setupFee: 0,
    defaultCallerId: true,
  },
  {
    id: 'n2',
    number: '+13125550199',
    nickname: 'Outbound — recalls',
    numberType: 'local',
    region: 'Chicago, IL',
    country: 'US',
    status: 'active',
    capabilities: { voice: true, sms: true, mms: false },
    assignments: [
      { id: 'as4', product: 'phone', target: 'Priya Natarajan', schedule: 'Always', priority: 1, status: 'active' },
    ],
    destination: 'Priya Natarajan → voicemail',
    addedAt: ago(24 * 190),
    monthly: 2,
    setupFee: 0,
    defaultCallerId: false,
  },
  {
    id: 'n4',
    number: '+18885550123',
    nickname: 'Toll-free campaigns',
    numberType: 'toll_free',
    region: 'United States',
    country: 'US',
    status: 'active',
    capabilities: { voice: true, sms: false, mms: false },
    assignments: [],
    destination: 'Not routed',
    addedAt: ago(24 * 21),
    monthly: 3,
    setupFee: 0,
    defaultCallerId: false,
  },
  {
    id: 'n5',
    number: '+18475550164',
    nickname: 'Evanston expansion',
    numberType: 'local',
    region: 'Evanston, IL',
    country: 'US',
    status: 'provisioning',
    capabilities: { voice: true, sms: true, mms: true },
    assignments: [],
    destination: 'Provisioning',
    addedAt: ago(3),
    monthly: 2,
    setupFee: 0,
    defaultCallerId: false,
  },
]

export const CONNECTIONS_SEED: ExternalConnection[] = [
  {
    id: 'c1',
    number: '+17735550118',
    label: 'Lincoln Park office',
    carrier: 'Comcast Business',
    forwardsTo: '+13125550188',
    products: ['receptionist', 'mctb'],
    forwardingTypes: ['no_answer'],
    status: 'needs_attention',
    lastTest: ago(20),
    tests: [
      { id: 't3', at: ago(20), result: 'failed', callerId: '+13125558821', calledLine: null, routedTo: null, note: 'Inbound call received, but the original called number was not present. Carrier may be sending its own number as the redirect line.' },
      { id: 't2', at: ago(24 * 9), result: 'passed', callerId: '+13125550101', calledLine: '+17735550118', routedTo: 'Ava (AI agent)', note: 'Routed to AI Receptionist after 4 rings.' },
      { id: 't1', at: ago(24 * 30), result: 'passed', callerId: '+13125550101', calledLine: '+17735550118', routedTo: 'Ava (AI agent)', note: 'Initial verification.' },
    ],
  },
  {
    id: 'c2',
    number: '+16305550177',
    label: 'Naperville satellite',
    carrier: 'AT&T',
    forwardsTo: '+13125550189',
    products: ['mctb'],
    forwardingTypes: ['busy', 'no_answer'],
    status: 'verified',
    lastTest: ago(24 * 4),
    tests: [
      { id: 't4', at: ago(24 * 4), result: 'passed', callerId: '+13125550101', calledLine: '+16305550177', routedTo: 'Missed-call recovery', note: 'Forwarded on no answer; MCTB eligibility evaluated.' },
    ],
  },
]

export const PORTS_SEED: PortRequest[] = [
  {
    id: 'p1',
    number: '+13125550110',
    carrierFrom: 'Verizon Business',
    requestedAt: ago(24 * 6),
    status: 'info_needed',
    expectedDate: null,
    reference: 'PRT-48213',
    owner: 'Harbor & Pine Dental LLC',
    serviceAddress: '418 Lakeshore Ave, Suite 200, Chicago, IL 60611',
    accountMasked: '•••• 4417',
    documents: [{ name: 'Letter of authorization.pdf', uploadedAt: ago(24 * 6) }],
    milestones: [
      { label: 'Draft created', at: ago(24 * 7), state: 'done' },
      { label: 'Submitted', at: ago(24 * 6), state: 'done' },
      { label: 'Information needed', at: ago(24 * 2), state: 'attention' },
      { label: 'Carrier review', at: null, state: 'upcoming' },
      { label: 'Port date scheduled', at: null, state: 'upcoming' },
      { label: 'Completed', at: null, state: 'upcoming' },
    ],
  },
  {
    id: 'p2',
    number: '+17735550190',
    carrierFrom: 'Comcast Business',
    requestedAt: ago(24 * 1),
    status: 'draft',
    expectedDate: null,
    reference: null,
    owner: 'Harbor & Pine Dental LLC',
    serviceAddress: '2210 N Clark St, Chicago, IL 60614',
    accountMasked: '—',
    documents: [],
    milestones: [
      { label: 'Draft created', at: ago(24), state: 'current' },
      { label: 'Submitted', at: null, state: 'upcoming' },
      { label: 'Carrier review', at: null, state: 'upcoming' },
      { label: 'Port date scheduled', at: null, state: 'upcoming' },
      { label: 'Completed', at: null, state: 'upcoming' },
    ],
  },
]

export const OWNED_STATUS: Record<OwnedStatus, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'muted' }> = {
  active: { label: 'Active', tone: 'success' },
  reserved: { label: 'Reserved', tone: 'info' },
  provisioning: { label: 'Provisioning', tone: 'info' },
  issue: { label: 'Issue', tone: 'danger' },
  releasing: { label: 'Releasing', tone: 'warning' },
}

export const CONNECTION_STATUS: Record<ConnectionStatus, { label: string; tone: 'success' | 'warning' | 'muted' | 'info' }> = {
  verified: { label: 'Verified', tone: 'success' },
  needs_attention: { label: 'Needs attention', tone: 'warning' },
  pending: { label: 'Pending', tone: 'info' },
  not_tested: { label: 'Not tested', tone: 'muted' },
}

export const PORT_STATUS: Record<PortStatus, { label: string; tone: 'success' | 'warning' | 'muted' | 'info' | 'danger' }> = {
  draft: { label: 'Draft', tone: 'muted' },
  submitted: { label: 'Submitted', tone: 'info' },
  info_needed: { label: 'Info needed', tone: 'warning' },
  in_review: { label: 'In review', tone: 'info' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export const FORWARDING_LABEL: Record<ForwardingType, string> = {
  all: 'All calls',
  no_answer: 'When unanswered',
  busy: 'When busy',
}

export const CARRIERS = ['AT&T', 'Verizon Business', 'Comcast Business', 'Spectrum Business', 'T-Mobile for Business', 'RingCentral', 'Other', "Don't know"]

/** Carrier instructions are only shown where we have documented steps; never invent dial codes. */
export const CARRIER_INSTRUCTIONS: Record<string, { steps: string[]; codes?: { label: string; code: string }[] }> = {
  'Comcast Business': {
    steps: ['Sign in to the Comcast Business VoiceEdge or Business Voice portal.', 'Open Call Forwarding for the line you are connecting.', 'Choose the forwarding condition you selected and paste your Transovo destination.', 'Save, then return here to run a test call.'],
  },
  'AT&T': {
    steps: ['Open the AT&T Business Center (or call AT&T Business support).', 'Find Call Forwarding for the line.', 'Set the destination to your Transovo forwarding number.', 'Save, then return here to test.'],
  },
}

export function inboundFlow(assignments: Assignment[]) {
  const sorted = [...assignments].filter((a) => a.status === 'active').sort((a, b) => a.priority - b.priority)
  if (!sorted.length) return ['Inbound call', 'No handler — caller hears unavailable message']
  return ['Inbound call', ...sorted.map((a) => `${a.target} (${a.schedule.toLowerCase()})`)]
}

export type Compatibility = { ok: true; warning?: string } | { ok: false; reason: string }

export function compatibility(n: OwnedNumber, product: NumberProduct): Compatibility {
  if (n.status === 'provisioning') return { ok: false, reason: 'Still provisioning — voice is not usable yet.' }
  if (n.status === 'releasing') return { ok: false, reason: 'Release in progress.' }
  if ((product === 'mctb' || product === 'sms') && !n.capabilities.sms)
    return { ok: false, reason: product === 'mctb' ? 'MCTB texts from the called number, and this number has no SMS capability.' : 'No SMS capability on this number.' }
  if (n.assignments.some((a) => a.product === product)) return { ok: true, warning: `Already linked to ${PRODUCT_LABEL[product]}.` }
  const phoneOwner = n.assignments.find((a) => a.product === 'phone')
  if (phoneOwner && product === 'receptionist')
    return { ok: true, warning: `Rings ${phoneOwner.target} first; AI answers per the shared routing policy.` }
  return { ok: true }
}

/** Demo availability search. Area code 000 returns empty; 999 simulates a provider error. */
export type AvailableNumber = {
  number: string
  numberType: 'local' | 'toll_free'
  region: string
  monthly: number
  setupFee: number
  capabilities: { voice: boolean; sms: boolean; mms: boolean }
}

export function demoSearch(params: { numberType: 'local' | 'toll_free'; areaCode: string; city: string; contains: string }): AvailableNumber[] | 'error' {
  if (params.areaCode === '999') return 'error'
  if (params.areaCode === '000') return []
  const prefix = params.numberType === 'toll_free' ? params.areaCode || '833' : params.areaCode || '312'
  const city = params.numberType === 'toll_free' ? 'United States' : params.city || (prefix === '773' ? 'Chicago, IL' : prefix === '847' ? 'Evanston, IL' : 'Chicago, IL')
  const tails = ['0137', '0172', '0185', '0214', '0249', '0263', '0281', '0306']
  return tails
    .map((t, i) => ({
      number: `+1${prefix}555${params.contains && i % 2 === 0 ? params.contains.slice(0, 4).padEnd(4, '0') : t}`,
      numberType: params.numberType,
      region: city,
      monthly: params.numberType === 'toll_free' ? 3 : 2,
      setupFee: 0,
      capabilities: { voice: true, sms: i !== 5, mms: params.numberType === 'local' && i % 3 !== 0 },
    }))
    .filter((n, i, all) => all.findIndex((m) => m.number === n.number) === i)
}
