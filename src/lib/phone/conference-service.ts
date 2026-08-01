import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxPhoneConfigured } from "./human-call-service";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveCallerIdNumber } from "./settings";

export async function createConferenceFromCall(input: {
  workspaceId: string;
  hostUserId: string;
  humanCallId: string;
  name?: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call?.telnyxCallControlId) throw new Error("Host call not found");

  let telnyxConferenceId: string | null = null;
  if (isTelnyxPhoneConfigured()) {
    try {
      const res = await telnyxRequest<{ data: { id?: string; conference_id?: string } }>(
        "/conferences",
        {
          method: "POST",
          body: {
            name: input.name || `conf-${call.id.slice(0, 8)}`,
            call_control_id: call.telnyxCallControlId,
            beep_enabled: "always",
          },
        },
      );
      telnyxConferenceId = res.data?.id || res.data?.conference_id || null;
      if (!telnyxConferenceId) {
        throw new Error("Telnyx conference create returned no conference id");
      }
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `Conference create failed: ${err.message}`
          : "Conference create failed",
      );
    }
  } else {
    telnyxConferenceId = `mock_conf_${call.id}`;
  }

  const conference = await prisma.conferenceCall.create({
    data: {
      workspaceId: input.workspaceId,
      name: input.name || "Conference",
      telnyxConferenceId,
      hostUserId: input.hostUserId,
      hostHumanCallId: call.id,
      status: "active",
    },
  });

  await prisma.conferenceParticipant.create({
    data: {
      workspaceId: input.workspaceId,
      conferenceId: conference.id,
      humanCallId: call.id,
      telnyxCallControlId: call.telnyxCallControlId,
      displayName: "Host",
      role: "host",
      status: "joined",
    },
  });

  await prisma.humanCall.update({
    where: { id: call.id },
    data: { conferenceId: conference.id },
  });

  return conference;
}

export async function addConferenceParticipant(input: {
  workspaceId: string;
  conferenceId: string;
  to: string;
  from?: string | null;
}) {
  const prisma = getPrisma();
  const conference = await prisma.conferenceCall.findFirst({
    where: { id: input.conferenceId, workspaceId: input.workspaceId },
  });
  if (!conference) throw new Error("Conference not found");

  const to = normalizeE164(input.to);
  const from = await resolveCallerIdNumber(input.workspaceId, input.from);
  if (!from) throw new Error("No caller ID");

  const call = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from,
      to,
      direction: "outbound",
      status: "initiated",
      conferenceId: conference.id,
      mediaMode: "call_control",
    },
  });

  if (!isTelnyxPhoneConfigured()) {
    await prisma.conferenceParticipant.create({
      data: {
        workspaceId: input.workspaceId,
        conferenceId: conference.id,
        humanCallId: call.id,
        displayName: to,
        status: "joined",
      },
    });
    return { call, mode: "mock" };
  }

  const connectionId = process.env.TELNYX_CONNECTION_ID!.trim();
  const res = await telnyxRequest<{ data: { call_control_id: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId,
      from,
      to,
      client_state: Buffer.from(
        JSON.stringify({
          workspaceId: input.workspaceId,
          humanCallId: call.id,
          conferenceId: conference.id,
          kind: "conference_leg",
        }),
      ).toString("base64"),
    },
  });

  const controlId = res.data?.call_control_id;
  await prisma.humanCall.update({
    where: { id: call.id },
    data: { telnyxCallControlId: controlId, status: "ringing" },
  });

  await prisma.conferenceParticipant.create({
    data: {
      workspaceId: input.workspaceId,
      conferenceId: conference.id,
      humanCallId: call.id,
      telnyxCallControlId: controlId,
      displayName: to,
      status: "ringing",
    },
  });

  // Join is performed on call.answered in processHumanCallWebhookEvent (not optimistically).

  return { call, mode: "telnyx" };
}

export async function removeConferenceParticipant(input: {
  workspaceId: string;
  conferenceId: string;
  participantId: string;
}) {
  const prisma = getPrisma();
  const participant = await prisma.conferenceParticipant.findFirst({
    where: {
      id: input.participantId,
      conferenceId: input.conferenceId,
      workspaceId: input.workspaceId,
    },
  });
  if (!participant) throw new Error("Participant not found");

  if (participant.telnyxCallControlId && isTelnyxPhoneConfigured()) {
    await telnyxRequest(`/calls/${participant.telnyxCallControlId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }

  await prisma.conferenceParticipant.update({
    where: { id: participant.id },
    data: { status: "left", leftAt: new Date() },
  });
  return { ok: true };
}
