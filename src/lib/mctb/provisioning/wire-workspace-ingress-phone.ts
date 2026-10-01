import "server-only";

import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { setActiveCallHandler } from "@/lib/call-handling/set-active-call-handler";
import { routePhoneToMctbCallHandlingIngress } from "@/lib/mctb/texml-ingress/provision";
import { getPrisma } from "@/lib/db";

/** Point an existing workspace DID at ws_1-style MCTB TeXML ingress (CFNA target). */
export async function wireMctbWorkspaceIngressPhone(
  workspaceId: string,
  phoneNumberId: string,
): Promise<{ ok: boolean; error?: string }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
    select: { id: true },
  });
  if (!phone) {
    return { ok: false, error: "phone_not_in_workspace" };
  }

  const route = await routePhoneToMctbCallHandlingIngress({
    workspaceId,
    phoneNumberId,
    mctbRole: "customer_mctb",
  });
  if (!route.verify.ok) {
    return { ok: false, error: route.verify.failReason || "mctb_texml_route_failed" };
  }

  await updateMissedCallTextConfig({
    workspaceId,
    patch: { phone_number_id: phoneNumberId },
    source: "mctb_ingress_wire",
  });

  await setActiveCallHandler({
    workspaceId,
    voiceIngressPhoneNumberId: phoneNumberId,
    handler: "mctb",
  });

  const { provisionMctbPhoneTexmlIngressModeForWorkspace } = await import(
    "@/lib/mctb/texml-ingress/texml-mode-provision"
  );
  const { warmMctbInboundRoutingProfileForWorkspace } = await import(
    "@/lib/mctb/texml-ingress/routing-profile"
  );
  await provisionMctbPhoneTexmlIngressModeForWorkspace(workspaceId, phoneNumberId).catch(() => undefined);
  await warmMctbInboundRoutingProfileForWorkspace(workspaceId).catch(() => undefined);

  return { ok: true };
}
