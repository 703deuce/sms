import { verifyRealEstateFrontdesk } from "./verify-frontdesk";
import { verifyRealtorProduct } from "./verify-product";
import { verifyRealtorEdgeCases } from "./verify-edge-cases";

export type RealtorVerificationResult = {
  ok: boolean;
  suites: Array<{ name: string; ok: boolean; error?: string }>;
};

/** In-process realtor verification — no shell scripts required. */
export function runRealtorVerificationSuite(): RealtorVerificationResult {
  const suites: RealtorVerificationResult["suites"] = [
    { name: "frontdesk", ok: false },
    { name: "product", ok: false },
    { name: "edge_cases", ok: false },
  ];

  try {
    verifyRealEstateFrontdesk();
    suites[0]!.ok = true;
  } catch (err) {
    suites[0]!.error = err instanceof Error ? err.message : String(err);
    return { ok: false, suites };
  }

  try {
    verifyRealtorProduct();
    suites[1]!.ok = true;
  } catch (err) {
    suites[1]!.error = err instanceof Error ? err.message : String(err);
    return { ok: false, suites };
  }

  try {
    verifyRealtorEdgeCases();
    suites[2]!.ok = true;
  } catch (err) {
    suites[2]!.error = err instanceof Error ? err.message : String(err);
    return { ok: false, suites };
  }

  return { ok: true, suites };
}

export { verifyRealEstateFrontdesk, verifyRealtorProduct, verifyRealtorEdgeCases };
