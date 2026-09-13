import "server-only";

import { getPrisma } from "@/lib/db";

export async function emitInboundHandlingTrace(input: {
  workspaceId: string;
  phoneNumberId: string;
  event: string;
  callId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  console.log(
    JSON.stringify({
      source: "mctb-inbound-handling",
      event: input.event,
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      callId: input.callId || null,
      ...input.detail,
    }),
  );

  await getPrisma()
    .auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        event: `mctb.inbound.${input.event.toLowerCase()}`,
        detail: JSON.stringify({
          phoneNumberId: input.phoneNumberId,
          callId: input.callId || null,
          ...(input.detail || {}),
        }),
      },
    })
    .catch(() => undefined);
}
