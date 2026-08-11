import { isRealEstateAutoDeployEnabled } from "@/lib/voice/real-estate/bootstrap";
import { runRealtorVerificationSuite } from "./verification";

declare global {
  // eslint-disable-next-line no-var
  var __transovoRealtorVerificationBootstrapped: boolean | undefined;
}

export function isRealtorVerificationEnabled(): boolean {
  const explicit = process.env.REAL_ESTATE_VERIFY?.trim();
  if (explicit === "0" || explicit === "false") return false;
  if (explicit === "1" || explicit === "true") return true;
  return isRealEstateAutoDeployEnabled();
}

/**
 * Runs the full realtor verification suite in-process on deploy boot.
 * No manual npm scripts — wired from bootstrapRealEstateFrontDesk + CI.
 */
export async function bootstrapRealtorVerification(): Promise<{ ok: boolean }> {
  if (!isRealtorVerificationEnabled()) return { ok: true };
  if (globalThis.__transovoRealtorVerificationBootstrapped) return { ok: true };
  globalThis.__transovoRealtorVerificationBootstrapped = true;

  const result = runRealtorVerificationSuite();
  if (result.ok) {
    console.log(
      JSON.stringify({
        source: "transovo-realtor-boot",
        event: "verification_pass",
        suites: result.suites.map((s) => s.name),
      }),
    );
    return { ok: true };
  }

  const failed = result.suites.filter((s) => !s.ok);
  console.error(
    JSON.stringify({
      source: "transovo-realtor-boot",
      event: "verification_fail",
      failed,
    }),
  );

  if (process.env.REAL_ESTATE_VERIFY_STRICT?.trim() === "1") {
    throw new Error(
      `Realtor verification failed: ${failed.map((f) => `${f.name}: ${f.error}`).join("; ")}`,
    );
  }

  return { ok: false };
}
