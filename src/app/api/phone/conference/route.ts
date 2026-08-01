import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  addConferenceParticipant,
  createConferenceFromCall,
  endConference,
  removeConferenceParticipant,
} from "@/lib/phone/conference-service";
import { getPrisma } from "@/lib/db";
import { requireSoftphonePermission } from "@/lib/phone/softphone-permissions";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const conf = await getPrisma().conferenceCall.findFirst({
        where: { id, workspaceId: auth.workspaceId },
        include: { participants: true },
      });
      return NextResponse.json({ data: conf });
    }
    const rows = await getPrisma().conferenceCall.findMany({
      where: { workspaceId: auth.workspaceId, status: "active" },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: string;
      humanCallId?: string;
      conferenceId?: string;
      to?: string;
      participantId?: string;
      name?: string;
    };

    if (body.action === "create") {
      await requireSoftphonePermission(auth.workspaceId, auth.session.userId, "conference");
      if (!body.humanCallId) {
        return NextResponse.json({ error: "humanCallId required" }, { status: 400 });
      }
      const conf = await createConferenceFromCall({
        workspaceId: auth.workspaceId,
        hostUserId: auth.session.userId,
        humanCallId: body.humanCallId,
        name: body.name,
      });
      return NextResponse.json({ data: conf }, { status: 201 });
    }

    if (body.action === "add") {
      await requireSoftphonePermission(auth.workspaceId, auth.session.userId, "conference");
      if (!body.conferenceId || !body.to) {
        return NextResponse.json({ error: "conferenceId and to required" }, { status: 400 });
      }
      const result = await addConferenceParticipant({
        workspaceId: auth.workspaceId,
        conferenceId: body.conferenceId,
        to: body.to,
      });
      return NextResponse.json({ data: result });
    }

    if (body.action === "remove") {
      await requireSoftphonePermission(auth.workspaceId, auth.session.userId, "conference");
      if (!body.conferenceId || !body.participantId) {
        return NextResponse.json({ error: "conferenceId and participantId required" }, { status: 400 });
      }
      return NextResponse.json({
        data: await removeConferenceParticipant({
          workspaceId: auth.workspaceId,
          conferenceId: body.conferenceId,
          participantId: body.participantId,
        }),
      });
    }

    if (body.action === "end") {
      await requireSoftphonePermission(auth.workspaceId, auth.session.userId, "conference");
      if (!body.conferenceId) {
        return NextResponse.json({ error: "conferenceId required" }, { status: 400 });
      }
      return NextResponse.json({
        data: await endConference({
          workspaceId: auth.workspaceId,
          conferenceId: body.conferenceId,
        }),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
