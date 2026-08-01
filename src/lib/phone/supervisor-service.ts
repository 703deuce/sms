/**
 * Supervisor listen / whisper / barge via Telnyx conference supervisor_role.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { isTelnyxPhoneConfigured } from "./human-call-service";
import { createConferenceFromCall } from "./conference-service";
import { resolveCallerIdNumber } from "./settings";

function encodeClientState(data: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

/** Ensure the customer call is in a conference so a supervisor can join. */
async function ensureConferenceForCall(input: {
  workspaceId: string;
  hostUserId: string;
  humanCallId: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call?.telnyxCallControlId) throw new Error("Call not active");
  if (call.conferenceId) {
    const existing = await prisma.conferenceCall.findFirst({
      where: { id: call.conferenceId, workspaceId: input.workspaceId },
    });
    if (existing?.telnyxConferenceId) return { call, conference: existing };
  }
  const conference = await createConferenceFromCall({
    workspaceId: input.workspaceId,
    hostUserId: input.hostUserId,
    humanCallId: call.id,
    name: `Monitor ${call.to}`,
  });
  const refreshed = await prisma.humanCall.findUnique({ where: { id: call.id } });
  return { call: refreshed || call, conference };
}

/**
 * Dial the supervisor onto the live call as monitor (listen), whisper, or barge.
 * Rings the supervisor's cellular / Call my phone number into the conference.
 */
export async function startSupervisorSession(input: {
  workspaceId: string;
  supervisorUserId: string;
  humanCallId: string;
  role: "monitor" | "whisper" | "barge";
  supervisorPhone: string;
}) {
  if (!isTelnyxPhoneConfigured()) {
    throw new Error("Telnyx not configured for supervisor listen");
  }
  const prisma = getPrisma();
  const { call, conference } = await ensureConferenceForCall({
    workspaceId: input.workspaceId,
    hostUserId: input.supervisorUserId,
    humanCallId: input.humanCallId,
  });
  if (!conference.telnyxConferenceId || conference.telnyxConferenceId.startsWith("mock_")) {
    throw new Error("Conference not available");
  }

  const phone = normalizeE164(input.supervisorPhone);
  const from = await resolveCallerIdNumber(
    input.workspaceId,
    call.callerIdNumber,
    input.supervisorUserId,
  );
  if (!from) throw new Error("No caller ID for supervisor dial");

  const connectionId = process.env.TELNYX_CONNECTION_ID!.trim();
  const dial = await telnyxRequest<{ data: { call_control_id: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId,
      from,
      to: phone,
      client_state: encodeClientState({
        workspaceId: input.workspaceId,
        humanCallId: call.id,
        conferenceId: conference.id,
        kind: "supervisor_leg",
        supervisorRole: input.role,
        userId: input.supervisorUserId,
      }),
    },
  });
  const controlId = dial.data?.call_control_id;
  if (!controlId) throw new Error("Supervisor dial failed");

  await prisma.conferenceParticipant.create({
    data: {
      workspaceId: input.workspaceId,
      conferenceId: conference.id,
      telnyxCallControlId: controlId,
      displayName: `Supervisor (${input.role})`,
      role: "supervisor",
      status: "ringing",
    },
  });

  await prisma.humanCall.update({
    where: { id: call.id },
    data: {
      notes: `${call.notes || ""}\n[supervisor:${input.role}:${controlId}]`.trim(),
      conferenceId: conference.id,
    },
  });

  return { conference, supervisorControlId: controlId, role: input.role };
}

/** Join supervisor leg into conference when they answer (webhook). */
export async function joinSupervisorOnAnswer(input: {
  workspaceId: string;
  humanCallId: string;
  supervisorControlId: string;
  role: "monitor" | "whisper" | "barge";
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call?.conferenceId) return { ok: false };
  const conference = await prisma.conferenceCall.findUnique({
    where: { id: call.conferenceId },
  });
  if (!conference?.telnyxConferenceId) return { ok: false };

  const joinBody: Record<string, unknown> = {
    call_control_id: input.supervisorControlId,
    supervisor_role: input.role,
    mute: input.role === "monitor",
    start_conference_on_enter: true,
  };
  if (input.role === "whisper" && call.telnyxCallControlId) {
    const whisperTo = [call.telnyxCallControlId];
    if (call.telnyxCallLegId) whisperTo.push(call.telnyxCallLegId);
    joinBody.whisper_call_control_ids = whisperTo;
  }

  try {
    await telnyxRequest(`/conferences/${conference.telnyxConferenceId}/actions/join`, {
      method: "POST",
      body: joinBody,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Supervisor conference join failed";
    await prisma.conferenceParticipant.updateMany({
      where: {
        conferenceId: conference.id,
        telnyxCallControlId: input.supervisorControlId,
      },
      data: { status: "failed" },
    });
    await prisma.humanCall.update({
      where: { id: call.id },
      data: {
        notes: `${call.notes || ""}\n[supervisor_join_failed:${message.slice(0, 120)}]`.trim(),
      },
    });
    console.warn("[supervisor] join failed", err);
    throw new Error(message);
  }

  await prisma.conferenceParticipant.updateMany({
    where: {
      conferenceId: conference.id,
      telnyxCallControlId: input.supervisorControlId,
    },
    data: { status: "joined" },
  });

  return { ok: true };
}

/** Upgrade monitor → whisper or barge on an active supervisor leg. */
export async function updateSupervisorRole(input: {
  workspaceId: string;
  humanCallId: string;
  supervisorControlId: string;
  role: "monitor" | "whisper" | "barge";
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call?.conferenceId) throw new Error("No conference for this call");
  const conference = await prisma.conferenceCall.findUnique({
    where: { id: call.conferenceId },
  });
  if (!conference?.telnyxConferenceId) throw new Error("Conference missing");

  const body: Record<string, unknown> = {
    call_control_id: input.supervisorControlId,
    supervisor_role: input.role,
  };
  if (input.role === "whisper" && call.telnyxCallControlId) {
    const whisperTo = [call.telnyxCallControlId];
    if (call.telnyxCallLegId) whisperTo.push(call.telnyxCallLegId);
    body.whisper_call_control_ids = whisperTo;
  }

  await telnyxRequest(`/conferences/${conference.telnyxConferenceId}/actions/update`, {
    method: "POST",
    body,
  });

  return { ok: true, role: input.role };
}
