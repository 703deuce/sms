export type OptInMessage = {
  id: string;
  title: string;
  description: string;
  body: string;
  editable: boolean;
};

export const optInMessages: OptInMessage[] = [
  {
    id: "optin",
    title: "Opt-In Message",
    description:
      "This is the message people will receive after they've successfully subscribed. You'll have the opportunity to override this message with each opt-in method you set up.",
    body: "Thanks for subscribing to Transovo text alerts.",
    editable: true,
  },
  {
    id: "double-optin",
    title: "Double Opt-In Message",
    description:
      "This is the message people will receive asking them to reply YES after starting an opt-in process that requires double opt-in. You'll have the opportunity to override this message with each opt-in method you set up.",
    body: "To complete your subscription to Transovo text alerts, reply YES.",
    editable: true,
  },
  {
    id: "optin-exists",
    title: "Opt-In Exists Message",
    description:
      "This is the message people will receive when attempting to subscribe but already exist as a subscribed contact.",
    body: "You're already subscribed to Transovo text alerts.",
    editable: true,
  },
  {
    id: "re-optin",
    title: "Re-Opt-In Message",
    description:
      "This is the message people will receive when subscribing after having previously subscribed.",
    body: "You've resubscribed to Transovo text alerts.",
    editable: true,
  },
];

export const complianceMessages = [
  {
    id: "pre-optin",
    title: "Pre Opt-In Compliance Statement",
    description:
      "This statement appears before a contact subscribes, wherever opt-in methods are displayed.",
    body: "By subscribing, you agree to receive recurring automated marketing text messages from Transovo. Consent is not a condition of purchase.",
    editable: false,
  },
  {
    id: "optin-compliance",
    title: "Opt-In Compliance Statement",
    description:
      "When a contact opts in, specific verbiage must be appended to the initial confirmation message they receive. This is what yours looks like.",
    body: "Msg & data rates may apply. Msg frequency varies. Reply HELP for help, STOP to cancel. Terms & Privacy: s.trnvs.io/tos",
    editable: false,
  },
  {
    id: "optout",
    title: "Opt-Out Message",
    description:
      "When someone texts stop, unsubscribe, remove, cancel, end, quit, or opt out to your number they'll receive the following message:",
    body: "Transovo: You are unsubscribed from messaging. No more messages will be sent.\n\nHelp at info@transovo.com. Reply START to resubscribe.\nReport spam at spam@transovo.co.",
    editable: false,
  },
  {
    id: "help",
    title: "Help Message",
    description:
      "When someone texts help to your number they'll receive the following message:",
    body: "Transovo: Help at info@transovo.com. Msg & data rates may apply. Msg freq varies. Reply STOP to opt out.",
    editable: false,
  },
];

export type Keyword = {
  id: string;
  keyword: string;
  description: string;
  lastSaved: string;
  connectedLists: number;
  createsContacts: boolean;
  autoResponse: string;
};

export const keywords: Keyword[] = [
  {
    id: "blackfriday",
    keyword: "BlackFriday",
    description: "Joined during our Black Friday sale.",
    lastSaved: "Sep 11th, 2024 @ 10:55 am",
    connectedLists: 0,
    createsContacts: true,
    autoResponse: "Thanks for subscribing to Transovo text alerts.",
  },
  {
    id: "socalvip",
    keyword: "SoCalVIP",
    description: "Subscribers who have opted in at our SoCal locations.",
    lastSaved: "Sep 11th, 2024 @ 10:55 am",
    connectedLists: 1,
    createsContacts: true,
    autoResponse: "Welcome to the SoCal VIP list!",
  },
  {
    id: "nycvip",
    keyword: "NYCVIP",
    description: "Subscribers who have opted in at our NYC locations.",
    lastSaved: "Sep 11th, 2024 @ 10:55 am",
    connectedLists: 1,
    createsContacts: true,
    autoResponse: "Welcome to the NYC VIP list!",
  },
  {
    id: "miamivip",
    keyword: "MiamiVIP",
    description: "Subscribers who have opted in at our Miami location",
    lastSaved: "Sep 11th, 2024 @ 10:55 am",
    connectedLists: 1,
    createsContacts: true,
    autoResponse: "Welcome to the Miami VIP list!",
  },
  {
    id: "nashvip",
    keyword: "NashVIP",
    description: "Subscribers who have shopped at our Nashville location.",
    lastSaved: "Sep 11th, 2024 @ 10:55 am",
    connectedLists: 1,
    createsContacts: true,
    autoResponse: "Welcome to the Nashville VIP list!",
  },
];

export const inboxSettingsInit = {
  inboxOn: true,
  allowStarting: true,
  allowAssignment: true,
  allowTagging: true,
  privateConversations: false,
  officeHours: true,
  autoAssignment: false,
  autoClose: false,
  unassignWhenClosed: true,
  markUnreadWhenAssigned: true,
  autoResponse: true,
  autoResponseInside: "Thanks for reaching out. We'll get back to you briefly.",
  autoResponseOutside:
    "Thanks for reaching out. Our office hours are 9 am - 5 pm M-F. Someone will get back to you during those hours.",
};

export const officeDays = [
  { day: "Sunday", enabled: false, from: "9:00 am", to: "5:00 pm", tz: "CDT" },
  { day: "Monday", enabled: true, from: "9:00 am", to: "5:00 pm", tz: "CDT" },
  { day: "Tuesday", enabled: true, from: "9:00 am", to: "5:00 pm", tz: "CDT" },
  { day: "Wednesday", enabled: true, from: "9:00 am", to: "5:00 pm", tz: "CDT" },
  { day: "Thursday", enabled: true, from: "9:00 am", to: "5:00 pm", tz: "CDT" },
  { day: "Friday", enabled: true, from: "9:00 am", to: "5:00 pm", tz: "CDT" },
  { day: "Saturday", enabled: false, from: "9:00 am", to: "5:00 pm", tz: "CDT" },
];

export const MSG_LIMIT = 918;
export const COMPLIANCE_FOOTER =
  "Msg & data rates may apply. Msg frequency varies. Reply HELP for help, STOP to cancel. Terms & Privacy: s.trnvs.io/tos";
