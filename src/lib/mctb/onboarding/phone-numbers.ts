import { resolveWorkspaceTryItPhone } from "./workspace-phone";

export {
  getMctbProductionForwardTestE164,
  getMctbDefaultBusinessLineE164,
  getProductionMctbForwardTargetE164,
} from "@/lib/mctb/production-forward-target";

/** Workspace-owned MCTB DID for Try It / onboarding direct-call test. */
export async function getMctbDemoIngressE164(workspaceId: string): Promise<string | null> {
  const phone = await resolveWorkspaceTryItPhone(workspaceId);
  return phone?.e164 || null;
}

export function isPlatformDemoIngressE164(_e164: string): boolean {
  return false;
}
