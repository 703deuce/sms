import "server-only";

import type { AgentConfig } from "@/lib/agent";
import { getBusinessHours } from "@/lib/server/phone/routing";

type DayHours = { open?: string; close?: string; closed?: boolean };

function formatBusinessHoursDisplay(
  hours: unknown,
  timezone: string,
): string | undefined {
  if (!hours || typeof hours !== "object") return undefined;
  const map = hours as Record<string, DayHours>;
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const labels: Record<string, string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };
  const lines: string[] = [];
  for (const key of order) {
    const day = map[key] || map[key.slice(0, 3)];
    if (!day) continue;
    if (day.closed) {
      lines.push(`${labels[key]}: Closed`);
      continue;
    }
    if (day.open && day.close) {
      lines.push(`${labels[key]}: ${day.open} – ${day.close}`);
    }
  }
  if (!lines.length) return undefined;
  return `${lines.join("\n")}\n(Timezone: ${timezone})`;
}

export type ReceptionistBusinessFacts = {
  companyDescription?: string;
  location?: string;
  serviceArea?: string;
  hoursDisplay?: string;
  servicesSummary?: string;
  pricingSummary?: string;
  paymentMethods?: string;
  policiesSummary?: string;
};

export async function resolveReceptionistBusinessFacts(
  workspaceId: string,
  editor: AgentConfig,
): Promise<ReceptionistBusinessFacts> {
  const { timezone, hours } = await getBusinessHours(workspaceId);
  const tz = timezone || "America/Chicago";
  const enabledTypes = editor.appointments.types.filter((t) => t.enabled);
  const servicesSummary = enabledTypes.map((t) => t.name).filter(Boolean).join(", ");
  const kp = editor.knowledgeProfile;

  const policyParts = [
    kp?.policies?.trim(),
    editor.appointments.cancelPolicy?.trim(),
    editor.instructions?.trim(),
  ].filter(Boolean);

  const hoursFromProfile = kp?.businessOverview?.trim();
  const structuredHours = formatBusinessHoursDisplay(hours, tz);
  const hoursDisplay =
    hoursFromProfile && structuredHours
      ? `${hoursFromProfile}\n\n${structuredHours}`
      : hoursFromProfile || structuredHours;

  return {
    companyDescription:
      kp?.businessOverview?.trim() || editor.identity.role?.trim() || undefined,
    hoursDisplay,
    servicesSummary: servicesSummary || undefined,
    pricingSummary: kp?.pricing?.trim() || undefined,
    paymentMethods: kp?.paymentMethods?.trim() || undefined,
    policiesSummary: policyParts.length ? policyParts.join("\n\n") : undefined,
  };
}

export async function resolveReceptionistBusinessTimezone(workspaceId: string): Promise<string> {
  const { timezone } = await getBusinessHours(workspaceId);
  return timezone?.trim() || "America/New_York";
}
