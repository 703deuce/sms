export interface OptInMessage {
  id: string;
  title: string;
  description: string;
  body: string;
  editable: boolean;
}

export const optInMessages: OptInMessage[] = [
  {
    id: "optin",
    title: "Opt-in Message",
    description:
      "This is the message people will receive after they've successfully subscribed. You'll have the opportunity to override this message with each opt-in method you set up.",
    body: "Thanks for subscribing to Transovo text alerts.",
    editable: true,
  },
  {
    id: "double",
    title: "Double Opt-In Message",
    description:
      "This is the message people will receive asking them to reply YES after starting an opt-in process that requires double opt-in. You'll have the opportunity to override this message with each opt-in method you set up.",
    body: "To complete your subscription to Transovo text alerts, reply YES.",
    editable: true,
  },
  {
    id: "exists",
    title: "Opt-in Exists Message",
    description:
      "This is the message people will receive when attempting to subscribe but already exist as a subscribed contact.",
    body: "You're already subscribed to Transovo text alerts.",
    editable: true,
  },
  {
    id: "reoptin",
    title: "Re-Opt-In Message",
    description:
      "This is the message people will receive when subscribing after having previously subscribed.",
    body: "You've resubscribed to Transovo text alerts.",
    editable: true,
  },
];

export const complianceMessages: OptInMessage[] = [
  {
    id: "pre",
    title: "Pre Opt-in Compliance Statement",
    description:
      "This verbiage must appear wherever contacts can subscribe: web forms, popups, keywords and point-of-sale signage.",
    body: "By subscribing, you agree to receive recurring automated marketing messages from Transovo at the number provided. Consent is not a condition of purchase.",
    editable: false,
  },
  {
    id: "optinComp",
    title: "Opt-in Compliance Statement",
    description:
      "When a contact opts in, specific verbiage must be appended to the initial confirmation message they receive. This is what yours looks like.",
    body: "Msg & data rates may apply. Msg frequency varies. Reply HELP for help, STOP to cancel. Terms & Privacy: s.trnsv.io/ba/8cb22bd60b.",
    editable: false,
  },
  {
    id: "optout",
    title: "Opt-Out Message",
    description:
      "When someone texts stop, unsubscribe, remove, cancel, end, quit, or opt out to your number they'll receive the following message:",
    body: "Transovo: You are unsubscribed from messaging. No more messages will be sent.\n\nHelp at info@transovo.com. Reply START to resubscribe.\nReport spam at spam@stmobile.co.",
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

export interface Keyword {
  id: string;
  keyword: string;
  lastSaved: string;
  description: string;
  connectedLists: number;
  createsContacts: boolean;
  autoResponse: string;
}

export const keywords: Keyword[] = [
  {
    id: "bf",
    keyword: "BlackFriday",
    lastSaved: "Sep 11th, 2024 @ 10:55 am",
    description: "Joined during our Black Friday sale.",
    connectedLists: 0,
    createsContacts: true,
    autoResponse: "Thanks for subscribing to Transovo text alerts.",
  },
  {
    id: "socal",
    keyword: "SoCalVIP",
    lastSaved: "Sep 11th, 2024 @ 10:55 am",
    description: "Subscribers who have opted in at our SoCal locations.",
    connectedLists: 1,
    createsContacts: true,
    autoResponse: "Thanks for subscribing to Transovo text alerts.",
  },
  {
    id: "nyc",
    keyword: "NYCVIP",
    lastSaved: "Sep 11th, 2024 @ 10:55 am",
    description: "Subscribers who have opted in at our NYC locations.",
    connectedLists: 1,
    createsContacts: true,
    autoResponse: "Thanks for subscribing to Transovo text alerts.",
  },
  {
    id: "mia",
    keyword: "MiamiVIP",
    lastSaved: "Sep 11th, 2024 @ 10:55 am",
    description: "Subscribers who have opted in at our Miami location.",
    connectedLists: 1,
    createsContacts: true,
    autoResponse: "Thanks for subscribing to Transovo text alerts.",
  },
  {
    id: "nash",
    keyword: "NashVIP",
    lastSaved: "Sep 11th, 2024 @ 10:55 am",
    description: "Subscribers who have shopped at our Nashville location.",
    connectedLists: 1,
    createsContacts: true,
    autoResponse: "Thanks for subscribing to Transovo text alerts.",
  },
];

export const inboxDefaults = {
  autoResponseEnabled: false,
  autoResponseMessage: "Thanks for reaching out! Please call us at 1.800.688.6290 for support.",
  officeHoursEnabled: false,
  insideMessage: "Thanks for reaching out. We'll get back to you briefly.",
  outsideMessage:
    "Thanks for reaching out. Our office hours are 9 am - 5 pm M-F. Someone will get back to you during those hours!",
};

export const complianceFooter =
  "Msg & data rates may apply. Msg frequency varies. Reply HELP for help, STOP to cancel. Terms & Privacy: s.trnsv.io/ba/8cb22bd60b.";
