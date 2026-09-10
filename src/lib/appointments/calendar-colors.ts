import type { CalendarColorConfig } from "@/lib/appointments/service-booking/types";

const DEFAULT_STAFF = "#6366f1";
const DEFAULT_SERVICE = "#a78bfa";

const FALLBACK_TYPE_COLORS: Record<string, string> = {
  consultation: "#a78bfa",
  call: "#93c5fd",
  followup: "#fcd34d",
  onboarding: "#6ee7b7",
  canceled: "#f9a8d4",
  meeting: "#93c5fd",
  service: "#a78bfa",
  class: "#34d399",
  event: "#fbbf24",
};

export function resolveStaffCalendarColor(
  config: CalendarColorConfig | undefined,
  staffId?: string | null,
): string {
  if (staffId && config?.staffColors?.[staffId]) return config.staffColors[staffId];
  return config?.defaultStaffColor || DEFAULT_STAFF;
}

export function resolveServiceCalendarColor(
  config: CalendarColorConfig | undefined,
  input: { typeId?: string | null; serviceName?: string | null; typeCalendarColor?: string | null },
): string {
  if (input.typeCalendarColor) return input.typeCalendarColor;
  if (input.typeId && config?.serviceColors?.[input.typeId]) return config.serviceColors[input.typeId];
  if (input.serviceName && config?.serviceColors?.[input.serviceName]) {
    return config.serviceColors[input.serviceName];
  }
  return config?.defaultServiceColor || DEFAULT_SERVICE;
}

export function fallbackTypeColorKey(kind?: string | null, serviceName?: string | null): string {
  if (kind === "CLASS") return "class";
  if (kind === "MEETING") return "meeting";
  const name = (serviceName || "").toLowerCase();
  if (name.includes("onboard")) return "onboarding";
  if (name.includes("follow")) return "followup";
  if (name.includes("call") || name.includes("demo")) return "call";
  if (name.includes("class") || name.includes("yoga") || name.includes("workshop")) return "class";
  return "consultation";
}

export function fallbackTypeDot(kind?: string | null, serviceName?: string | null): string {
  return FALLBACK_TYPE_COLORS[fallbackTypeColorKey(kind, serviceName)] || DEFAULT_SERVICE;
}
