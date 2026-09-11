import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import type { MeetingSectionId } from "@/components/appointments/meetings/meeting-section-types";
import { methodDef, methodIsConfigured } from "@/lib/appointments/meetings/meeting-methods";

export type SetupStep = {
  id: string;
  label: string;
  done: boolean;
  /** Section that resolves this step, so the checklist can jump straight to it. */
  section: MeetingSectionId;
  /** Shown when incomplete — explains the real consequence, not just "missing". */
  blocker?: string;
};

/**
 * Strategies that read from an explicit staff pool cannot be booked while that
 * pool is empty, so an empty pool is a genuine setup blocker rather than a
 * cosmetic warning.
 */
const POOL_STRATEGIES: Record<string, "staffIds" | "collectiveStaffIds" | undefined> = {
  specific_staff: "staffIds",
  customer_chooses: "staffIds",
  round_robin: "staffIds",
  maximize_availability: "staffIds",
  collective: "collectiveStaffIds",
};

export function meetingSetupSteps(form: AppointmentTypeFormState): SetupStep[] {
  const poolKey = POOL_STRATEGIES[form.staffAssignment];
  const hostsReady = poolKey ? form[poolKey].length > 0 : true;
  const method = methodDef(form.location);
  const methodReady = methodIsConfigured(form.location, form);

  return [
    {
      id: "name",
      label: "Name and duration",
      done: form.name.trim().length > 0 && form.durationMinutes >= 5,
      section: "overview",
      blocker: "Customers see the name on your booking page.",
    },
    {
      id: "hosts",
      label: "Host strategy",
      done: hostsReady,
      section: "hosts-method",
      blocker: "No host is selected, so no slots can be offered.",
    },
    {
      id: "method",
      label: "Meeting method",
      done: methodReady,
      section: "hosts-method",
      blocker: method
        ? `${method.label} still needs its ${method.kind === "link" ? "join link" : "location"}.`
        : "Customers will not know how to join.",
    },
    {
      id: "availability",
      label: "Availability",
      done: form.maximumBookingDaysAhead > 0,
      section: "availability",
      blocker: "Set how far ahead customers can book.",
    },
    {
      id: "live",
      label: "Live for customers",
      done: form.enabled && form.visibility !== "secret",
      section: "advanced",
      blocker: form.enabled
        ? "Visibility is secret, so this meeting is hidden."
        : "This meeting is inactive and cannot be booked.",
    },
  ];
}

export function setupCompletion(steps: SetupStep[]): { done: number; total: number; pct: number } {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100) };
}

export function sectionsNeedingAttention(steps: SetupStep[]): Set<MeetingSectionId> {
  return new Set(steps.filter((s) => !s.done).map((s) => s.section));
}
