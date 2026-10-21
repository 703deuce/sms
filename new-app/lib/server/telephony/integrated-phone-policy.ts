import "server-only";

import { getPrisma } from "@/lib/server/db";

export async function upsertDefaultAnsweringPolicy(workspaceId: string, phoneNumberId: string) {
  const prisma = getPrisma();
  await prisma.phoneNumberAnsweringPolicy.upsert({
    where: { phoneNumberId },
    create: {
      workspaceId,
      phoneNumberId,
      answeringMode: "browser",
      paused: false,
      scheduleJson: {
        noAnswerFallback: { type: "voicemail" },
      },
    },
    update: {},
  });
}
