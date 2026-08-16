import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { ensureUserVoicemailBox, ensureNumberVoicemailBox, listVoicemailMessages } from "@/lib/phone/voicemail-service";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const boxId = url.searchParams.get("boxId") || undefined;
    const phoneNumberId = url.searchParams.get("phoneNumberId") || undefined;
    const boxes = await getPrisma().voicemailBox.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(phoneNumberId ? { phoneNumberId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    const resolvedBoxId = boxId ?? boxes[0]?.id;
    const messages = await listVoicemailMessages(auth.workspaceId, resolvedBoxId);
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

    if (body.action === "ensure_number_box" && (body as { phoneNumberId?: string }).phoneNumberId) {
      const phoneNumberId = (body as { phoneNumberId: string }).phoneNumberId;
      const box = await ensureNumberVoicemailBox(
        auth.workspaceId,
        phoneNumberId,
        auth.session.userId,
      );
      return NextResponse.json({ data: box });
    }

    if (body.action === "ensure_personal") {
      const box = await ensureUserVoicemailBox(
        auth.workspaceId,
        auth.session.userId,
        body.name,
        body.greetingText,
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
        secondaryEmailNotify: (body as { secondaryEmailNotify?: string }).secondaryEmailNotify,
        name: body.name,
      };
      if (typeof (body as { transcriptionEnabled?: boolean }).transcriptionEnabled === "boolean") {
        patch.transcriptionEnabled = (body as { transcriptionEnabled?: boolean }).transcriptionEnabled;
      }
      const box = await getPrisma().voicemailBox.updateMany({
        where: { id: body.boxId, workspaceId: auth.workspaceId },
        data: patch,
      });
      if (!box.count) {
        return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
      }
      const updated = await getPrisma().voicemailBox.findFirst({
        where: { id: body.boxId, workspaceId: auth.workspaceId },
      });
      return NextResponse.json({ data: updated });
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
      const pn = msg.humanCallId
        ? await getPrisma().humanCall.findFirst({
            where: { id: msg.humanCallId, workspaceId: auth.workspaceId },
            select: { to: true },
          })
        : null;
      const phoneRow = pn?.to
        ? await getPrisma().phoneNumber.findFirst({
            where: { workspaceId: auth.workspaceId, e164: pn.to },
            select: { provider: true, twilioSid: true, providerNumberId: true },
          })
        : null;
      const { resolvePhoneNumberProvider } = await import("@/lib/numbers/providers/normalize");
      const upstream = phoneRow ? resolvePhoneNumberProvider(phoneRow) : "telnyx";

      if (upstream === "twilio") {
        return NextResponse.json(
          { error: "Twilio numbers use carrier transcription; retranscribe is not available." },
          { status: 400 },
        );
      }

      const updated = await attachVoicemailRecordingAndTranscribe({
        workspaceId: auth.workspaceId,
        messageId: msg.id,
        humanCallId: msg.humanCallId,
        recordingUrl: msg.recordingUrl,
        durationSeconds: msg.durationSeconds,
        upstreamProvider: "telnyx",
      });
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
