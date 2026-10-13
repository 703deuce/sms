import { AR_ROUTES } from "@/lib/appointment-reminders/routes";

export type BookingAdminLink = {
  label: string;
  href: string;
  description: string;
};

export type BookingAdminSection = {
  title: string;
  description: string;
  links: BookingAdminLink[];
};

/**
 * Scheduling administration destinations for the Opus Booking hub.
 * Routes stay on legacy paths until each surface is Opus-wrapped; no duplicate engines.
 */
export function buildBookingAdminCatalog(): BookingAdminSection[] {
  return [
    {
      title: "Bookable types",
      description: "What customers can book online or staff can schedule.",
      links: [
        {
          label: "Services",
          href: AR_ROUTES.bookingServices,
          description: "Service appointments, duration, staff, and pricing.",
        },
        {
          label: "Meetings",
          href: AR_ROUTES.bookingMeetings,
          description: "One-to-one meetings and video booking types.",
        },
        {
          label: "Classes",
          href: "/appointments/classes",
          description: "Class series, capacity, and enrollments.",
        },
        {
          label: "Workshops",
          href: "/appointments/workshops",
          description: "Workshop offerings and occurrences.",
        },
      ],
    },
    {
      title: "Booking pages & sharing",
      description: "Public link, branding, and embed options.",
      links: [
        {
          label: "Booking pages admin",
          href: "/appointments/booking",
          description: "Advanced booking page configuration.",
        },
        {
          label: "Share & embed",
          href: "/appointments/booking/share",
          description: "Widgets, direct links, and embed codes.",
        },
        {
          label: "Branding",
          href: "/appointments/booking/branding",
          description: "Colors, logos, and customer-facing copy.",
        },
      ],
    },
    {
      title: "Forms, contracts & routing",
      description: "Intake, legal, and how customers reach the right bookable type.",
      links: [
        {
          label: "Intake forms",
          href: "/appointments/booking/forms",
          description: "Questions and documents collected at booking.",
        },
        {
          label: "Contracts",
          href: "/appointments/booking/contracts",
          description: "Signed agreements tied to appointments.",
        },
        {
          label: "Routing forms",
          href: "/appointments/routing-forms",
          description: "Route visitors to the right service or staff.",
        },
        {
          label: "Meeting polls",
          href: "/appointments/meeting-polls",
          description: "Group availability and poll-based booking.",
        },
      ],
    },
    {
      title: "Team & AI booking",
      description: "Staff-specific booking and assisted scheduling.",
      links: [
        {
          label: "Team booking",
          href: "/appointments/team-booking",
          description: "Per-staff booking links and rules.",
        },
        {
          label: "Team pages",
          href: "/appointments/team-pages",
          description: "Staff landing pages for booking.",
        },
        {
          label: "AI booking admin",
          href: "/appointments/ai-booking",
          description: "Voice and AI-assisted booking configuration.",
        },
      ],
    },
    {
      title: "Commerce",
      description: "Packages, memberships, and checkout at booking time.",
      links: [
        {
          label: "Packages",
          href: "/appointments/packages",
          description: "Session packs and credit bundles.",
        },
        {
          label: "Memberships",
          href: "/appointments/memberships",
          description: "Recurring member benefits.",
        },
        {
          label: "Pricing & payments",
          href: "/appointments/pricing-payments",
          description: "Deposits, checkout, and payment rules.",
        },
        {
          label: "Point of sale",
          href: "/appointments/point-of-sale",
          description: "In-person payments and retail.",
        },
      ],
    },
    {
      title: "Availability & rules",
      description: "When booking is allowed — linked from Booking for convenience.",
      links: [
        {
          label: "Availability schedules",
          href: "/appointments/availability",
          description: "Weekly hours and overrides.",
        },
        {
          label: "Booking rules",
          href: "/appointments/restrictions",
          description: "Lead time, buffers, and limits.",
        },
      ],
    },
  ];
}
