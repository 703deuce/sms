import {
  Activity,
  ClipboardList,
  Layers,
  Package,
  Ticket,
  Users,
} from "lucide-react";

export const PACKAGE_SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    description: "What this package is and how it is configured.",
    icon: ClipboardList,
  },
  {
    id: "eligible",
    label: "Eligible bookings",
    description: "Which services, classes and workshops can redeem it.",
    icon: Layers,
  },
  {
    id: "pricing",
    label: "Pricing & validity",
    description: "Credits, price, expiration and purchase availability.",
    icon: Ticket,
  },
  {
    id: "customers",
    label: "Customer packages",
    description: "Who owns it and how many credits remain.",
    icon: Users,
  },
  {
    id: "activity",
    label: "Activity",
    description: "Purchases, redemptions and adjustments.",
    icon: Activity,
  },
] as const;

export type PackageSectionId = (typeof PACKAGE_SECTIONS)[number]["id"];
