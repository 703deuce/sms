import { getPlatformDemoNumberE164 } from "./demo";
import { MCTB_PLATFORM_DEMO_E164 } from "./constants";

export {
  getMctbProductionForwardTestE164,
  getMctbDefaultBusinessLineE164,
  getProductionMctbForwardTargetE164,
} from "@/lib/mctb/production-forward-target";

/** Platform demo DID — Try It / trial direct-call only (env: MCTB_PLATFORM_DEMO_E164). */
export function getMctbDemoIngressE164(): string {
  return getPlatformDemoNumberE164();
}

export function isPlatformDemoIngressE164(e164: string): boolean {
  try {
    const normalized = e164.replace(/\D/g, "");
    const demo = getMctbDemoIngressE164().replace(/\D/g, "");
    return normalized === demo || e164 === MCTB_PLATFORM_DEMO_E164;
  } catch {
    return false;
  }
}
