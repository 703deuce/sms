export interface Keyword {
  id: string;
  name: string;
  description: string;
  lastSaved: string;
  connectedLists: number;
  status: "Active" | "Inactive";
}

export const keywords: Keyword[] = [
  {
    id: "k1",
    name: "BlackFriday",
    description: "Joined during our Black Friday sale.",
    lastSaved: "Last saved on Oct 10th, 2024 @ 2:30 pm",
    connectedLists: 1,
    status: "Active",
  },
  {
    id: "k2",
    name: "SoCalVIP",
    description: "Subscribers who have opted in at our SoCal locations.",
    lastSaved: "Last saved on Oct 10th, 2024 @ 2:30 pm",
    connectedLists: 1,
    status: "Active",
  },
  {
    id: "k3",
    name: "NYCVIP",
    description: "Subscribers who have opted in at our NYC locations.",
    lastSaved: "Last saved on Oct 10th, 2024 @ 2:30 pm",
    connectedLists: 1,
    status: "Active",
  },
  {
    id: "k4",
    name: "MiamiVIP",
    description: "Subscribers who have opted in at our Miami location",
    lastSaved: "Last saved on Oct 10th, 2024 @ 2:30 pm",
    connectedLists: 1,
    status: "Active",
  },
  {
    id: "k5",
    name: "NashVIP",
    description: "Subscribers who have shopped at our Nashville location.",
    lastSaved: "Last saved on Oct 10th, 2024 @ 2:30 pm",
    connectedLists: 1,
    status: "Active",
  },
];

export const contactLists = [
  "Distribution Center",
  "General List",
  "Las Vegas Store",
  "Marketing Team",
  "Miami Store",
];

export const complianceFooter =
  "Msg & data rates may apply. Msg frequency varies. Reply HELP for help, STOP to cancel. Terms & Privacy: s.trnvo.io/ba9cb22bd80b.";
