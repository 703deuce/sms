/**
 * Single deployment entry for Amy — wraps the proven wizard activate path.
 * Wizard UI, conversational setup, Settings, and version activation must all
 * eventually call this (or the same POST action) rather than inventing a second path.
 */

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

/**
 * Persist/deploy via the existing appointment-receptionist API.
 * This keeps VoiceAgent + Telnyx + routing + calendar tools on one path.
 */
export async function persistOrDeployAppointmentAgent(input: {
  action: "create_draft" | "save_draft" | "activate";
  state: AppointmentReceptionistWizardState;
}): Promise<{
  ok: boolean;
  agentId?: string;
  setupId?: string;
  telnyxAssistantId?: string | null;
  published?: boolean;
  error?: string;
  warnings?: string[];
  data?: unknown;
}> {
  const res = await fetch("/api/solutions/appointment-receptionist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: input.action,
      state: input.state,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: String(json.error || `Deploy failed (${res.status})`),
      data: json.data,
    };
  }
  return {
    ok: true,
    agentId: json.data?.agentId,
    setupId: json.data?.setupId,
    telnyxAssistantId: json.data?.telnyxAssistantId ?? null,
    published: Boolean(json.data?.published),
    warnings: Array.isArray(json.data?.warnings) ? json.data.warnings : [],
    data: json.data,
  };
}

/** Server-side note: activate branch in appointment-receptionist/route.ts IS deployAppointmentAgent. */
export const DEPLOY_APPOINTMENT_AGENT_SOURCE =
  "POST /api/solutions/appointment-receptionist action=activate";
