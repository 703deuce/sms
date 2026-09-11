import {
  Activity,
  ClipboardList,
  Layers,
  Ticket,
  Users,
  Workflow,
} from "lucide-react";

export const MEMBERSHIP_SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    description: "What this membership is and how it is configured.",
    icon: ClipboardList,
  },
  {
    id: "access",
    label: "Access",
    description: "Which bookings receive membership access.",
    icon: Layers,
  },
  {
    id: "pricing",
    label: "Pricing & billing",
    description: "Recurring price, interval and purchase availability.",
    icon: Ticket,
  },
  {
    id: "members",
    label: "Members",
    description: "Customers subscribed to this membership.",
    icon: Users,
  },
  {
    id: "lifecycle",
    label: "Lifecycle",
    description: "Renewal, cancellation and payment recovery.",
    icon: Workflow,
  },
  {
    id: "activity",
    label: "Activity",
    description: "Membership purchases, renewals and status changes.",
    icon: Activity,
  },
] as const;

export type MembershipSectionId = (typeof MEMBERSHIP_SECTIONS)[number]["id"];
