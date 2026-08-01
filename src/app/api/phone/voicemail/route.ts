import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { ensureUserVoicemailBox, listVoicemailMessages } from "@/lib/phone/voicemail-service";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const boxId = url.searchParams.get("boxId") || undefined;
    const boxes = await getPrisma().voicemailBox.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
    });
    const messages = await listVoicemailMessages(auth.workspaceId, boxId);
    return NextResponse.json({ data: { boxes, messages } });
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
      name?: string;
      greetingText?: string;
      greetingUrl?: string;
      emailNotify?: string;
      boxId?: string;
      messageId?: string;
    };

    if (body.action === "ensure_personal") {
      const box = await ensureUserVoicemailBox(
        auth.workspaceId,
        auth.session.userId,
        body.name,
      );
      return NextResponse.json({ data: box });
    }

    if (body.action === "create_box") {
      const box = await getPrisma().voicemailBox.create({
        data: {
          workspaceId: auth.workspaceId,
          name: body.name || "Voicemail",
          greetingText: body.greetingText,
          greetingUrl: body.greetingUrl,
          emailNotify: body.emailNotify,
          ownerUserId: auth.session.userId,
        },
      });
      return NextResponse.json({ data: box }, { status: 201 });
    }

    if (body.action === "mark_read" && body.messageId) {
      await getPrisma().voicemailMessage.updateMany({
        where: { id: body.messageId, workspaceId: auth.workspaceId },
        data: { isRead: true },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "delete_message" && body.messageId) {
      await getPrisma().voicemailMessage.deleteMany({
        where: { id: body.messageId, workspaceId: auth.workspaceId },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update_box" && body.boxId) {
      const patch: Record<string, unknown> = {
        greetingText: body.greetingText,
        greetingUrl: body.greetingUrl,
        emailNotify: body.emailNotify,
        name: body.name,
      };
      if (typeof (body as { transcriptionEnabled?: boolean }).transcriptionEnabled === "boolean") {
        patch.transcriptionEnabled = (body as { transcriptionEnabled?: boolean }).transcriptionEnabled;
      }
      const box = await getPrisma().voicemailBox.update({
        where: { id: body.boxId },
        data: patch,
      });
      return NextResponse.json({ data: box });
    }

    if (body.action === "retranscribe" && body.messageId) {
      const msg = await getPrisma().voicemailMessage.findFirst({
        where: { id: body.messageId, workspaceId: auth.workspaceId },
      });
      if (!msg?.recordingUrl) {
        return NextResponse.json({ error: "Message has no recording yet" }, { status: 400 });
      }
      const { attachVoicemailRecordingAndTranscribe } = await import(
        "@/lib/phone/voicemail-service"
      );
      // Clear prior transcript so attach re-runs Whisper.
      await getPrisma().voicemailMessage.update({
        where: { id: msg.id },
        data: { transcriptText: null },
      });
      const updated = await attachVoicemailRecordingAndTranscribe({
        workspaceId: auth.workspaceId,
        messageId: msg.id,
        humanCallId: msg.humanCallId,
        recordingUrl: msg.recordingUrl,
        durationSeconds: msg.durationSeconds,
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
