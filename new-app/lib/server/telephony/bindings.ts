import "server-only";

import type { NumberProduct } from "@/lib/numbers";
import { getPrisma } from "@/lib/server/db";
import { readTelephonyProvision } from "@/lib/server/telephony/telephony-record";

export type NumberProductBinding = {
  product: NumberProduct;
  detail: string;
};

export async function detectNumberProductBindings(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<NumberProductBinding[]> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true, settingsJson: true },
  });
  if (!phone) return [];

  const bindings: NumberProductBinding[] = [];
  const telephony = readTelephonyProvision(phone.settingsJson);

  if (telephony.routingMode === "livekit_sip" && telephony.state === "active") {
    bindings.push({ product: "receptionist", detail: "AI Receptionist (Voice V3 LiveKit ingress)" });
  }
  if (telephony.routingMode === "mctb_texml" && telephony.state === "active") {
    bindings.push({ product: "mctb", detail: "Missed Call Text Back (TeXML ingress)" });
  }
  if (telephony.routingMode === "telnyx_call_control" && telephony.state === "active") {
    bindings.push({ product: "phone", detail: "Phone call handling (Telnyx Call Control)" });
  }

  const agentLinks = await prisma.voiceAgentPhoneNumber.findMany({
    where: { workspaceId: input.workspaceId, phoneNumberId: phone.id, inboundEnabled: true },
    include: { agent: { select: { name: true } } },
  });
  for (const link of agentLinks) {
    if (!bindings.some((b) => b.product === "receptionist")) {
      bindings.push({
        product: "receptionist",
        detail: `AI Receptionist · ${link.agent?.name || "Agent"}`,
      });
    }
  }

  const routing = await prisma.workspaceCallRouting.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const policy =
    routing?.policyJson && typeof routing.policyJson === "object"
      ? (routing.policyJson as Record<string, unknown>)
      : {};
  if (policy.numberId === phone.id) {
    if (!bindings.some((b) => b.product === "phone")) {
      bindings.push({ product: "phone", detail: "Phone workspace routing policy" });
    }
    if (policy.receptionistAgentId && !bindings.some((b) => b.product === "receptionist")) {
      bindings.push({ product: "receptionist", detail: "AI Receptionist coverage on this line" });
    }
    if (policy.mctbEnabled && !bindings.some((b) => b.product === "mctb")) {
      bindings.push({ product: "mctb", detail: "MCTB enabled on workspace routing" });
    }
  }

  return bindings;
}
