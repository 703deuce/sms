export type QrAction = 'keyword' | 'webform' | 'url';

export interface Keyword {
  id: string;
  name: string;
  lastSaved: string;
  description: string;
  connectedLists: number;
  status: 'Active' | 'Inactive';
}

export const keywords: Keyword[] = [
  { id: '1', name: 'Jot', lastSaved: 'Last saved on Oct 17th, 2024 @ 9:58 am', description: 'Subscribes to general list', connectedLists: 1, status: 'Active' },
  { id: '2', name: 'BlackFriday', lastSaved: 'Last saved on Oct 10th, 2024 @ 2:30 pm', description: 'Joined during our Black Friday sale.', connectedLists: 1, status: 'Active' },
  { id: '3', name: 'SoCalVIP', lastSaved: 'Last saved on Oct 10th, 2024 @ 2:30 pm', description: 'Subscribers who have opted in at our SoCal locations.', connectedLists: 1, status: 'Active' },
  { id: '4', name: 'NYCVIP', lastSaved: 'Last saved on Oct 10th, 2024 @ 2:30 pm', description: 'Subscribers who have opted in at our NYC locations.', connectedLists: 1, status: 'Active' },
  { id: '5', name: 'MiamiVIP', lastSaved: 'Last saved on Oct 10th, 2024 @ 2:30 pm', description: 'Subscribers who have opted in at our Miami location', connectedLists: 1, status: 'Active' },
  { id: '6', name: 'NashVIP', lastSaved: 'Last saved on Oct 10th, 2024 @ 2:30 pm', description: 'Subscribers who have shopped at our Nashville location.', connectedLists: 1, status: 'Active' },
];

export const qrActions = [
  { value: 'keyword', label: 'Text a Keyword' },
  { value: 'webform', label: 'Send people to a web form' },
  { value: 'url', label: 'Send people to a url' },
];

export const webforms = [
  { value: 'signup', label: 'General Signup Form' },
  { value: 'vip', label: 'VIP Club Form' },
  { value: 'events', label: 'Event RSVP Form' },
];

export const swatches = [
  '#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff',
  '#3e4a57', '#2986cc', '#0b5394', '#674ea7', '#8e7cc3', '#c27ba0',
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#38761d',
  '#134f5c', '#45818e', '#76a5af', '#b45f06', '#783f04', '#990000',
];

export const stats = {
  totalContacts: '6,767',
  totalSubscribed: '2,251',
  unreadInbox: '3',
  newContacts: '6,768',
  creditsRemaining: '5,875 Credits Remaining',
};
