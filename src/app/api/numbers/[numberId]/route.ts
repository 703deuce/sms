import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapPhoneNumber } from "@/lib/mappers";
import { validateForwardingDestination } from "@/lib/numbers/forwarding-validation";
import { applyPersonalCallSettingsToRow } from "@/lib/numbers/state-service";
import { releaseWorkspaceNumber } from "@/lib/numbers/release-service";
import {
  personalCallSettingsNeedsForwardingSubscription,
  requirePaidServiceSubscription,
} from "@/lib/payments/marketplace-service-gate";

const assignmentsInclude = {
  assignments: { include: { user: { select: { id: true, name: true } } } },
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const row = await getPrisma().phoneNumber.findFirst({
      where: { id: numberId, workspaceId: auth.workspaceId },
      include: assignmentsInclude,
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: mapPhoneNumber(row) });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const body = (await request.json()) as {
      friendlyName?: string;
      status?: string;
      voiceForwardTo?: string | null;
      webhookUrl?: string | null;
      settingsJson?: Record<string, unknown> | null;
      assignedUserIds?: string[];
      personalCallSettings?: {
        forwardingEnabled?: boolean;
        forwardDestination?: string | null;
        forwardRingSeconds?: number;
        forwardUnansweredAction?: "voicemail" | "end";
        voicemailEnabled?: boolean;
        directVoicemail?: boolean;
        vaultIncomingMode?: "parked_message" | "voicemail";
        parkedMessageText?: string;
      };
    };
    const prisma = getPrisma();
    const existing = await prisma.phoneNumber.findFirst({
      where: { id: numberId, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.status === "Released") {
      return NextResponse.json(
        { error: "Use DELETE to release a number — direct status patch is not allowed" },
        { status: 400 },
      );
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { type: true },
    });

    const data: Record<string, unknown> = {
      friendlyName: body.friendlyName ?? undefined,
    };

    if (body.personalCallSettings && workspace?.type === "PERSONAL") {
      if (personalCallSettingsNeedsForwardingSubscription(body.personalCallSettings)) {
        const blocked = await requirePaidServiceSubscription(
          auth.workspaceId,
          numberId,
          "forwarding_200",
        );
        if (blocked) return blocked;
      }
      const applied = applyPersonalCallSettingsToRow(existing, body.personalCallSettings);
      data.voiceForwardTo = applied.voiceForwardTo;
      data.settingsJson = applied.settingsJson;
    } else if (body.voiceForwardTo !== undefined) {
      const nextForward = body.voiceForwardTo?.trim() || null;
      if (nextForward) {
        const blocked = await requirePaidServiceSubscription(
          auth.workspaceId,
          numberId,
          "forwarding_200",
        );
        if (blocked) return blocked;
        const validated = validateForwardingDestination({
          destination: nextForward,
          numberE164: existing.e164,
        });
        if (!validated.ok) {
          return NextResponse.json({ error: validated.error }, { status: 400 });
        }
        const applied = applyPersonalCallSettingsToRow(existing, {
          incomingCallHandling: "forward",
          forwardingEnabled: true,
          forwardDestination: validated.e164,
          forwardUnansweredAction: "voicemail",
          voicemailEnabled: true,
        });
        data.voiceForwardTo = applied.voiceForwardTo;
        data.settingsJson = applied.settingsJson;
        const { ensureNumberVoicemailBox } = await import("@/lib/phone/voicemail-service");
        await ensureNumberVoicemailBox(auth.workspaceId, numberId);
      } else {
        const applied = applyPersonalCallSettingsToRow(existing, {
          forwardingEnabled: false,
          forwardDestination: null,
        });
        data.voiceForwardTo = applied.voiceForwardTo;
        data.settingsJson = applied.settingsJson;
      }
    }
    if (body.webhookUrl !== undefined) {
      data.webhookUrl = body.webhookUrl?.trim() || null;
    }
    // settingsJson is server-managed via state transitions — do not accept raw client patches.

    await prisma.phoneNumber.update({ where: { id: numberId }, data });

    // Reconcile per-number user assignments when provided.
    if (Array.isArray(body.assignedUserIds)) {
      const validMembers = await prisma.membership.findMany({
        where: { workspaceId: auth.workspaceId, userId: { in: body.assignedUserIds } },
        select: { userId: true },
      });
      const validIds = new Set(
        (validMembers as Array<{ userId: string }>).map((m) => m.userId),
      );
      const desired = [...new Set(body.assignedUserIds.filter((id) => validIds.has(id)))];

      await prisma.phoneNumberAssignment.deleteMany({ where: { phoneNumberId: numberId } });
      for (const userId of desired) {
        await prisma.phoneNumberAssignment.create({
          data: { phoneNumberId: numberId, userId },
        });
      }
    }

    const updated = await prisma.phoneNumber.findFirst({
      where: { id: numberId },
      include: assignmentsInclude,
    });
    return NextResponse.json({ data: mapPhoneNumber(updated!) });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const result = await releaseWorkspaceNumber(auth.workspaceId, numberId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
