import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { requireMassTextingWorkspace } from "@/lib/mass-texting/access";
import { getPrisma } from "@/lib/db";
import { resolveSharedPlatformOutboundSender } from "@/lib/messaging/platform-outbound-sender";
import { TRANSOVO_PLATFORM_SENDER_COMPOSE_ID } from "@/lib/messaging/platform-compose-sender";
import { formatPhone } from "@/lib/utils";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);

    const prisma = getPrisma();
    const workspaceRows = await prisma.phoneNumber.findMany({
      where: { workspaceId: auth.workspaceId, status: "Active" },
      orderBy: { createdAt: "asc" },
      select: { id: true, e164: true },
    });

    const platform = await resolveSharedPlatformOutboundSender();
    const platformOption = platform?.fromE164
      ? {
          id: TRANSOVO_PLATFORM_SENDER_COMPOSE_ID,
          number: platform.fromE164,
          display: formatPhone(platform.fromE164),
          senderMode: "PLATFORM" as const,
          label: "Transovo platform number (shared)",
        }
      : null;

    const workspace = workspaceRows
      .filter((row) => row.e164)
      .map((row) => ({
        id: row.id,
        number: row.e164!,
        display: formatPhone(row.e164!),
        senderMode: "WORKSPACE" as const,
        label: formatPhone(row.e164!),
      }));

    return NextResponse.json({
      data: {
        platform: platformOption,
        workspace,
        /** Preferred default for new campaigns — platform when configured. */
        defaultId: platformOption?.id ?? workspace[0]?.id ?? null,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
