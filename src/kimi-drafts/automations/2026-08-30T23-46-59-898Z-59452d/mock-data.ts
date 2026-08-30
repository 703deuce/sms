export interface Workflow {
  id: string;
  name: string;
  lastSaved: string;
  description: string;
  currentContacts: number;
  clicks: number;
  unsubscribes: number;
  revenue: string;
  status: "Active" | "Inactive";
}

export const workflows: Workflow[] = [
  {
    id: "wf1",
    name: "Birthday Text",
    lastSaved: "Aug 26th, 2024 @ 3:52 pm",
    description: "Sends a birthday offer to customers on their birthday.",
    currentContacts: 0,
    clicks: 835,
    unsubscribes: 0,
    revenue: "$32,537",
    status: "Active",
  },
  {
    id: "wf2",
    name: "Abandoned Cart Recovery",
    lastSaved: "Aug 26th, 2024 @ 3:50 pm",
    description: "Sends a text one hour after abandoned cart.",
    currentContacts: 1,
    clicks: 1070,
    unsubscribes: 0,
    revenue: "$30,251",
    status: "Inactive",
  },
  {
    id: "wf3",
    name: "New Opt In Nurture",
    lastSaved: "Sep 26th, 2024 @ 10:12 am",
    description: "Three campaigns over a two week period for new subscribers",
    currentContacts: 0,
    clicks: 1021,
    unsubscribes: 0,
    revenue: "$7,529",
    status: "Active",
  },
  {
    id: "wf4",
    name: "Review Collection",
    lastSaved: "Sep 26th, 2024 @ 10:23 am",
    description: "Asks customers to leave a review after leaving the store.",
    currentContacts: 0,
    clicks: 589,
    unsubscribes: 0,
    revenue: "$0",
    status: "Active",
  },
];

export type PaletteKind = "trigger" | "action" | "condition" | "wait";

export interface PaletteItem {
  id: string;
  label: string;
  kind: PaletteKind;
  icon: string;
}

export const paletteItems: Record<PaletteKind, PaletteItem[]> = {
  trigger: [
    { id: "t-contact-created", label: "Contact Created", kind: "trigger", icon: "UserPlus" },
    { id: "t-field-changed", label: "Contact Field Changed", kind: "trigger", icon: "FileEdit" },
    { id: "t-link-clicked", label: "Link Clicked", kind: "trigger", icon: "Link2" },
    { id: "t-added-list", label: "Contact Added to List", kind: "trigger", icon: "ListPlus" },
    { id: "t-removed-list", label: "Contact Removed From List", kind: "trigger", icon: "ListMinus" },
    { id: "t-msg-received", label: "Message Received", kind: "trigger", icon: "MessageSquare" },
    { id: "t-convo-status", label: "Inbox Convo Status Changed", kind: "trigger", icon: "MessagesSquare" },
    { id: "t-convo-tagged", label: "Inbox Conversation Tagged", kind: "trigger", icon: "Tag" },
    { id: "t-convo-untagged", label: "Inbox Conversation Untagged", kind: "trigger", icon: "Tag" },
    { id: "t-convo-assigned", label: "Inbox Conversation Assigned", kind: "trigger", icon: "UserCheck" },
    { id: "t-convo-unassigned", label: "Inbox Conversation Unassigned", kind: "trigger", icon: "UserMinus" },
    { id: "t-cart-abandoned", label: "Cart Abandoned", kind: "trigger", icon: "ShoppingCart" },
  ],
  action: [
    { id: "a-send-message", label: "Send Message", kind: "action", icon: "MessageSquare" },
    { id: "a-update-field", label: "Update Contact Field", kind: "action", icon: "FileEdit" },
    { id: "a-delay", label: "Delay", kind: "action", icon: "Clock" },
    { id: "a-add-list", label: "Add Contact to List", kind: "action", icon: "ListPlus" },
    { id: "a-remove-list", label: "Remove Contact From List", kind: "action", icon: "ListMinus" },
    { id: "a-split", label: "Split Traffic", kind: "action", icon: "GitFork" },
    { id: "a-assign", label: "Assign Inbox Conversation", kind: "action", icon: "UserCheck" },
    { id: "a-unassign", label: "Unassign Inbox Conversation", kind: "action", icon: "UserMinus" },
    { id: "a-tag-convo", label: "Tag Inbox Conversation", kind: "action", icon: "Tag" },
    { id: "a-untag-convo", label: "Untag Inbox Conversation", kind: "action", icon: "Tag" },
    { id: "a-set-status", label: "Set Inbox Convo Status", kind: "action", icon: "MessagesSquare" },
    { id: "a-mark-convo", label: "Mark Inbox Conversation", kind: "action", icon: "Eye" },
  ],
  condition: [
    { id: "c-field-matches", label: "Contact Field Matches", kind: "condition", icon: "FileCheck" },
    { id: "c-on-list", label: "Contact Is On a List", kind: "condition", icon: "ListChecks" },
    { id: "c-segment", label: "Contact Matches Segment", kind: "condition", icon: "Target" },
    { id: "c-msg-clicked", label: "Message Clicked", kind: "condition", icon: "MousePointerClick" },
    { id: "c-link-clicked", label: "Link Clicked", kind: "condition", icon: "Link2" },
    { id: "c-assignee", label: "Check Inbox Convo Assignee", kind: "condition", icon: "UserCheck" },
    { id: "c-convo-tags", label: "Check Inbox Convo Tags", kind: "condition", icon: "Tags" },
    { id: "c-convo-status", label: "Check Inbox Convo Status", kind: "condition", icon: "MessagesSquare" },
    { id: "c-unread", label: "Inbox Conversation is Unread", kind: "condition", icon: "MailOpen" },
    { id: "c-optin", label: "Check Opt-in Status", kind: "condition", icon: "ShieldCheck" },
    { id: "c-cart-status", label: "Check Cart Status", kind: "condition", icon: "ShoppingCart" },
    { id: "c-cart-value", label: "Check Cart Value", kind: "condition", icon: "DollarSign" },
  ],
  wait: [
    { id: "w-field-changed", label: "Contact Field Changed", kind: "wait", icon: "FileEdit" },
    { id: "w-msg-clicked", label: "Message Clicked", kind: "wait", icon: "MousePointerClick" },
    { id: "w-link-clicked", label: "Link Clicked", kind: "wait", icon: "Link2" },
    { id: "w-msg-received", label: "Message Received", kind: "wait", icon: "MessageSquare" },
  ],
};

export const paletteDescriptions: Record<PaletteKind, string> = {
  trigger:
    "Triggers insert contacts into your workflows. They are what kick things off. Drag any trigger below onto the canvas to add it to your workflow.",
  action:
    "Actions do work within your workflows. They perform various tasks as contacts move through your workflow. Drag any action below onto the canvas to add it to your workflow.",
  condition:
    "Conditions are used to check statuses before proceeding. Drag any condition below onto the canvas to add it to your workflow.",
  wait:
    "Wait are used to wait for things to happen with your contacts. Drag any wait below onto the canvas to add it to your workflow.",
};

export const contactFields = [
  "First Name",
  "Last Name",
  "Mobile Number",
  "Email",
  "Birthdate",
  "Address",
  "City",
  "State / Province",
];

export const conditionOperators = [
  "Is",
  "Is Not",
  "Contains",
  "Does Not Contain",
  "Is Greater Than",
  "Is Less Than",
  "Has Any Value",
  "Has No Value",
];

export const teammates = [
  "Matt Baglia",
  "John Doe",
  "Sophia Grant",
  "Chris Jones",
  "Brandon Kellogg",
  "Laura Smith",
];

export const creationSources = ["Keyword", "Inbox", "Website Popup", "Import", "Manual Creation", "API"];

export const waitLookFor = [
  "A First Name",
  "A Last Name",
  "An Email",
  "A Postal Code",
  "A Date",
  "A Number",
  "A Yes or No",
  "Specific Words",
  "The Entire Message",
];

export const waitUnits = ["Seconds", "Minutes", "Hours", "Days"];

export interface EdgeDef {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: "yes" | "no" | "neutral";
}

export const exampleEdges: EdgeDef[] = [
  { id: "e1", from: "n1", to: "n2", label: "", kind: "neutral" },
  { id: "e2", from: "n2", to: "n3", label: "Yes", kind: "yes" },
  { id: "e3", from: "n3", to: "n4", label: "Message Sent", kind: "neutral" },
  { id: "e4", from: "n4", to: "n5", label: "Email Found", kind: "yes" },
  { id: "e5", from: "n4", to: "n6", label: "Email Not Found", kind: "no" },
];
