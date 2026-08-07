import { CalendlySchedulingProvider } from "./calendly-scheduling-provider";
import { InternalSchedulingProvider } from "./internal-scheduling-provider";
import type { SchedulingProvider } from "./scheduling-types";

export async function getSchedulingProvider(workspaceId: string): Promise<SchedulingProvider> {
  const { getConnectedCalendly } = await import("@/lib/voice/calendar/calendly-voice");
  const calendly = await getConnectedCalendly(workspaceId);
  if (calendly) return new CalendlySchedulingProvider(workspaceId);
  return new InternalSchedulingProvider(workspaceId);
}

export type { SchedulingProvider, SchedulingSlot } from "./scheduling-types";
