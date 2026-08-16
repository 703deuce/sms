import type { PhoneNumber } from "@prisma/client";
import { resolvePhoneNumberProvider } from "./normalize";
import type { NumberUpstreamProvider } from "./types";

export class ProviderMismatchError extends Error {
  readonly expected: NumberUpstreamProvider;
  readonly actual: NumberUpstreamProvider;
  readonly phoneNumberId?: string;
  readonly e164?: string;

  constructor(
    expected: NumberUpstreamProvider,
    actual: NumberUpstreamProvider,
    meta?: { phoneNumberId?: string; e164?: string },
  ) {
    super(
      `Provider mismatch: expected ${expected} but number is on ${actual} (${meta?.e164 ?? meta?.phoneNumberId ?? "unknown"})`,
    );
    this.name = "ProviderMismatchError";
    this.expected = expected;
    this.actual = actual;
    this.phoneNumberId = meta?.phoneNumberId;
    this.e164 = meta?.e164;
  }
}

export function assertPhoneNumberProvider(
  row: Pick<PhoneNumber, "provider" | "twilioSid" | "providerNumberId" | "e164" | "id">,
  expected: NumberUpstreamProvider,
): void {
  const actual = resolvePhoneNumberProvider(row);
  if (actual !== expected) {
    throw new ProviderMismatchError(expected, actual, {
      phoneNumberId: row.id,
      e164: row.e164,
    });
  }
}

export function isPhoneNumberProvider(
  row: Pick<PhoneNumber, "provider" | "twilioSid" | "providerNumberId">,
  expected: NumberUpstreamProvider,
): boolean {
  return resolvePhoneNumberProvider(row) === expected;
}
