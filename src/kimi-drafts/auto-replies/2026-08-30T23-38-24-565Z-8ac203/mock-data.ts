export interface AutoReplyMessage {
  id: string;
  title: string;
  description: string;
  body: string;
  editable: boolean;
  locked?: boolean;
}

export const optInMessages: AutoReplyMessage[] = [
  {
    id: "opt-in",
    title: "Opt-In Message",
    description:
      "This is the message people will receive after they've successfully subscribed. You'll have the opportunity to override this message with each opt-in method you set up.",
    body: "Thanks for subscribing to Transovo Tutorials text alerts.",
    editable: true,
  },
  {
    id: "double-opt-in",
    title: "Double Opt-In Message",
    description:
      "This is the message people will receive asking them to reply YES after starting an opt-in process that requires double opt-in. You'll have the opportunity to override this message with each opt-in method you set up.",
    body: "To complete your subscription to Transovo Tutorials text alerts, reply YES.",
    editable: true,
  },
  {
    id: "opt-in-exists",
    title: "Opt-In Exists Message",
    description:
      "This is the message people will receive when attempting to subscribe but already exist as a subscribed contact.",
    body: "You're already subscribed to Transovo Tutorials text alerts.",
    editable: true,
  },
  {
    id: "re-opt-in",
    title: "Re-Opt-In Message",
    description:
      "This is the message people will receive when subscribing after having previously subscribed.",
    body: "You've resubscribed to Transovo Tutorials text alerts.",
    editable: true,
  },
];

export const complianceMessages: AutoReplyMessage[] = [
  {
    id: "pre-opt-in",
    title: "Pre Opt-In Compliance Statement",
    description:
      "This verbiage must be present wherever a contact can subscribe, before they opt in.",
    body: "By subscribing, you agree to receive recurring automated marketing text messages from Transovo Tutorials. Consent is not a condition of purchase.",
    editable: false,
    locked: true,
  },
  {
    id: "opt-in-compliance",
    title: "Opt-In Compliance Statement",
    description:
      "When a contact opts in, specific verbiage must be appended to the initial confirmation message they receive. This is what yours looks like.",
    body: "Msg & data rates may apply. Msg frequency varies. Reply HELP for help, STOP to cancel. Terms & Privacy: s.trnsv.io/tc2bd00b.",
    editable: false,
    locked: true,
  },
  {
    id: "opt-out",
    title: "Opt-Out Message",
    description:
      "When someone texts stop, unsubscribe, remove, cancel, end, quit, or opt out to your number they'll receive the following message:",
    body: "Transovo Tutorials: You are unsubscribed from messaging. No more messages will be sent.\n\nHelp at info@transovo.com. Reply START to resubscribe.\nReport spam at spam@transovo.co.",
    editable: false,
    locked: true,
  },
  {
    id: "help",
    title: "Help Message",
    description:
      "When someone texts help to your number they'll receive the following message:",
    body: "Transovo Tutorials: Help at info@transovo.com. Msg & data rates may apply. Msg freq varies. Reply STOP to opt out.",
    editable: false,
    locked: true,
  },
];

export const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const navLinks = [
  "Home",
  "Audience",
  "Campaigns",
  "Inbox",
  "Workflows",
  "Analytics",
  "Tools",
];
