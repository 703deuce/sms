import {
  Activity,
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  Layers,
  MapPin,
  Settings2,
  Users,
} from "lucide-react";

export const AVAILABILITY_SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    description: "Scheduling coverage, health and live preview.",
    icon: ClipboardList,
  },
  {
    id: "weekly-hours",
    label: "Weekly hours",
    description: "Default business schedule and timezone.",
    icon: CalendarRange,
  },
  {
    id: "staff",
    label: "Staff assignments",
    description: "Who works when, where and on which services.",
    icon: Users,
  },
  {
    id: "services",
    label: "Service availability",
    description: "Eligible staff, locations and timing rules per service.",
    icon: Layers,
  },
  {
    id: "locations",
    label: "Locations & resources",
    description: "Place and room/equipment constraints.",
    icon: MapPin,
  },
  {
    id: "overrides",
    label: "Overrides",
    description: "Date-specific exceptions and closures.",
    icon: CalendarClock,
  },
  {
    id: "booking-rules",
    label: "Booking rules",
    description: "Notice, horizon, buffers and start times.",
    icon: Settings2,
  },
  {
    id: "calendars",
    label: "Calendar conflicts",
    description: "How connected calendars block availability.",
    icon: Activity,
  },
] as const;

export type AvailabilitySectionId = (typeof AVAILABILITY_SECTIONS)[number]["id"];
