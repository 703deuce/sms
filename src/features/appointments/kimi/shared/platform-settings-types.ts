import type {
  AppointmentLocation,
  BookableStaffMember,
  BookingQuestion,
  RoutingRule,
} from "@/lib/appointments/types";

export type PlatformSettingsSnapshot = {
  staff: BookableStaffMember[];
  locations: AppointmentLocation[];
  routingRules: RoutingRule[];
  externalCalendarBlocking?: {
    enabled?: boolean;
    connectionIds?: string[];
    calendarIds?: string[];
  };
  bookingLimits?: {
    maxBookingsPerDay?: number;
    maxBookingsPerWeek?: number;
  };
};

export type BookingQuestionForm = BookingQuestion & { id: string };

export const QUESTION_TYPE_OPTIONS = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Radio choice" },
  { value: "checkbox", label: "Checkbox" },
  { value: "multiselect", label: "Multiple choice" },
  { value: "date", label: "Date" },
] as const;

export const STAFF_ASSIGNMENT_OPTIONS = [
  { value: "any_eligible", label: "Any eligible staff", description: "Assign any available team member" },
  { value: "customer_chooses", label: "Customer chooses staff", description: "Let customers pick their provider" },
  { value: "round_robin", label: "Round robin", description: "Rotate fairly among eligible staff" },
  { value: "maximize_availability", label: "Maximize availability", description: "Offer any slot with an eligible member" },
  { value: "specific_staff", label: "Specific staff only", description: "Limit to selected staff members" },
  { value: "collective", label: "Collective (all required)", description: "All selected staff must be available" },
] as const;

export function newBookingQuestion(): BookingQuestionForm {
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: "",
    type: "text",
    required: false,
    active: true,
    displayOrder: 0,
  };
}

export function newStaffMember(): BookableStaffMember {
  return {
    id: `staff_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    active: true,
    appointmentTypeIds: [],
    locationIds: [],
  };
}

export function newLocation(): AppointmentLocation {
  return {
    id: `loc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    active: true,
    kind: "office",
  };
}

export function newRoutingRule(): RoutingRule {
  return {
    id: `route_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    conditions: [{ field: "", operator: "equals", value: "" }],
    logic: "and",
    destination: {},
  };
}
