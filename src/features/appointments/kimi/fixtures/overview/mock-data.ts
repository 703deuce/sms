export const stats = [
  { label: 'Upcoming appointments', value: '12', sub: 'Next: 09:00 AM →', icon: 'calendar', tint: 'purple' },
  { label: 'Confirmation rate', value: '92%', sub: '↑ 8% vs last 7 days', icon: 'check', tint: 'green' },
  { label: 'Reminders sent', value: '156', sub: 'Today', icon: 'send', tint: 'blue' },
  { label: 'Reminder health', value: '98%', sub: 'Excellent', icon: 'shield', tint: 'amber' },
];

export const schedule = [
  { time: '09:00 AM', dur: '30m', type: 'Consultation', loc: 'In-office', name: 'Alex Johnson', phone: '(555) 123-4567', status: 'Confirmed' },
  { time: '09:45 AM', dur: '30m', type: 'Consultation', loc: 'In-office', name: 'Maria Garcia', phone: '(555) 234-5678', status: 'Confirmed' },
  { time: '10:30 AM', dur: '30m', type: 'Consultation', loc: 'In-office', name: 'James Lee', phone: '(555) 345-6789', status: 'Pending' },
  { time: '11:15 AM', dur: '30m', type: 'Consultation', loc: 'In-office', name: 'Sarah Williams', phone: '(555) 456-7890', status: 'Confirmed' },
  { time: '02:00 PM', dur: '30m', type: 'Consultation', loc: 'In-office', name: 'Robert Brown', phone: '(555) 567-8901', status: 'Confirmed' },
];

export const chartPoints = [5, 12, 19, 26, 20, 27, 14];
export const chartDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const conversations = [
  { initials: 'AJ', color: 'purple', name: 'Alex Johnson', msg: 'Perfect, see you tomorrow at 9:00 AM!', tag: 'Confirmed', tagColor: 'green', time: '9:12 AM' },
  { initials: 'MG', color: 'green', name: 'Maria Garcia', msg: 'Can I reschedule to later this week?', tag: 'Reschedule', tagColor: 'purple', time: '8:47 AM' },
  { initials: 'JL', color: 'blue', name: 'James Lee', msg: 'Thanks for the reminder!', tag: 'Confirmed', tagColor: 'green', time: '8:21 AM' },
  { initials: 'SW', color: 'red', name: 'Sarah Williams', msg: 'Do you have any openings next Monday?', tag: 'Inquiry', tagColor: 'blue', time: 'Yesterday' },
];

export const attention = [
  { icon: 'bell', tint: 'red', title: '3 reminder failures', sub: "Reminders couldn't be delivered" },
  { icon: 'shield', tint: 'amber', title: '2 suspicious bookings', sub: 'Flagged by AI Booking Protection' },
  { icon: 'check-square', tint: 'purple', title: 'Incomplete setup', sub: 'Finish 2 remaining setup steps' },
];
