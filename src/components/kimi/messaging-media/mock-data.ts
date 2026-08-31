export interface Campaign {
  id: string
  name: string
  detail: string
  audience: string
  contacts: number
  audienceType: string
  clicks: number
  unsubs: number
  revenue: string
  status: 'Draft' | 'Sent' | 'Sending'
  hasAttachment?: boolean
}

export interface CampaignDraft {
  name: string
  audience: string[]
  message: string
  attachment: { name: string; color: string; label: string } | null
  timing: 'now' | 'later' | 'recurring'
}

export const campaigns: Campaign[] = [
  { id: 'c1', name: 'Black Friday Dress Sale', detail: 'Last saved on Oct 14th, 2024 @ 8:49 am', audience: '3 Lists', contacts: 2249, audienceType: '3 Lists', clicks: 0, unsubs: 0, revenue: '—', status: 'Draft' },
  { id: 'c2', name: 'Fall Collection Announcement', detail: 'Last saved on Oct 10th, 2024 @ 12:58 pm', audience: '2 Lists', contacts: 2136, audienceType: '2 Lists', clicks: 0, unsubs: 0, revenue: '—', status: 'Draft' },
  { id: 'c3', name: 'Labor Day 2024 - Free Shipping - Final Reminder', detail: 'Sent on Sep 2nd, 2024 @ 2:10 pm', audience: 'No Audience', contacts: 4653, audienceType: 'No Audience', clicks: 384, unsubs: 0, revenue: '$13,795', status: 'Sent' },
  { id: 'c4', name: 'Labor Day 2024 - Free Shipping', detail: 'Sent on Aug 30th, 2024 @ 2:10 pm', audience: 'No Audience', contacts: 4599, audienceType: 'No Audience', clicks: 391, unsubs: 0, revenue: '$11,824', status: 'Sent' },
  { id: 'c5', name: 'Store Hours Reminder', detail: 'Sent on Aug 27th, 2024 @ 3:21 pm', audience: 'No Audience', contacts: 1232, audienceType: 'No Audience', clicks: 0, unsubs: 0, revenue: '$0', status: 'Sent' },
  { id: 'c6', name: 'SoCal Only - Store Hours Change', detail: 'Sent on Aug 27th, 2024 @ 8:48 am', audience: 'No Audience', contacts: 804, audienceType: 'No Audience', clicks: 0, unsubs: 0, revenue: '—', status: 'Sent' },
  { id: 'c7', name: 'Nashville Anniversary Party', detail: 'Sent on Aug 26th, 2024 @ 1:52 pm', audience: 'No Audience', contacts: 4409, audienceType: 'No Audience', clicks: 0, unsubs: 0, revenue: '—', status: 'Sent' },
]

export const lists = [
  'Distribution Center',
  'Las Vegas Store',
  'Marketing Team',
  'Miami Store',
  'Nashville Store',
  'NYC Store',
  'VIP List',
]

export const segments = ['49ers Fans', 'Clicked on Welcome Drip #1']

export const sampleAttachment = {
  name: 'basics-sale-mms.jpg',
  color: '#1a1a2e',
  label: 'SALE',
}

export const creditsAvailable = 5884
