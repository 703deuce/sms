import { getPrisma } from "@/lib/db";
import { createTelnyxNumberReservation } from "@/lib/messaging/telnyx/number-reservation";
import type { PremiumNumberProductResult } from "./product-api";
import type { PremiumSearchMode } from "./premium-pricing";

export type ReservePremiumNumberInput = {
  workspaceId: string;
  userId: string;
  phoneNumber: string;
  searchLogId: string;
  searchMode: PremiumSearchMode;
};

export type ReservePremiumNumberResult = {
  ok: boolean;
  reservationId?: string;
  reservationStatus: string;
  expiresAt?: string;
  vanityDisplay?: string;
  displayNumber?: string;
  premiumPriceCents?: number;
  error?: string;
};

export type StoredResultRow = {
  phoneNumber: string;
  premiumPriceCents: number;
  premiumPriceBand?: string;
  vanityDisplay?: string;
  displayNumber?: string;
  businessMatchScore?: number;
  numberQualityScore?: number;
  provider?: "telnyx" | "twilio";
  providerReference?: string | null;
};

/** Immutable logged quote consumed by reservation and, through it, checkout. */
export function findCheckoutAuthoritativeQuote(
  storedResults: StoredResultRow[],
  phoneNumber: string,
): StoredResultRow | undefined {
  return storedResults.find((result) => result.phoneNumber === phoneNumber);
}

export async function reservePremiumNumber(
  input: ReservePremiumNumberInput,
): Promise<ReservePremiumNumberResult> {
  const prisma = getPrisma();
  const log = await prisma.premiumNumberSearchLog.findFirst({
    where: { id: input.searchLogId, workspaceId: input.workspaceId },
  });
  if (!log) {
    return { ok: false, reservationStatus: "failed", error: "Search session not found" };
  }

  const stored = (log.resultsJson as StoredResultRow[] | null) ?? [];
  const match = findCheckoutAuthoritativeQuote(stored, input.phoneNumber);
  if (!match) {
    return {
      ok: false,
      reservationStatus: "failed",
      error: "Number not found in search results — please search again",
    };
  }

  const existingActive = await prisma.premiumNumberReservation.findFirst({
    where: {
      workspaceId: input.workspaceId,
      phoneNumber: input.phoneNumber,
      reservationStatus: { in: ["reserved", "reserving"] },
      reservationExpiresAt: { gt: new Date() },
    },
  });
  if (existingActive) {
    return {
      ok: true,
      reservationId: existingActive.id,
      reservationStatus: existingActive.reservationStatus,
      expiresAt: existingActive.reservationExpiresAt?.toISOString(),
      vanityDisplay: existingActive.vanityDisplay,
      displayNumber: existingActive.displayNumber,
      premiumPriceCents: existingActive.premiumPriceCents,
    };
  }

  const record = await prisma.premiumNumberReservation.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      phoneNumber: input.phoneNumber,
      vanityDisplay: match.vanityDisplay,
      displayNumber: match.displayNumber,
      searchMode: input.searchMode,
      provider: match.provider ?? "telnyx",
      providerReference: match.providerReference ?? null,
      searchContextJson: {
        searchLogId: input.searchLogId,
        areaCode: log.areaCode,
        industry: log.industry,
      },
      businessMatchScore: match.businessMatchScore ?? 0,
      numberQualityScore: match.numberQualityScore ?? 0,
      premiumPriceCents: match.premiumPriceCents,
      premiumPriceBand: match.premiumPriceBand,
      reservationStatus: "reserving",
      searchLogId: input.searchLogId,
    },
  });

  await prisma.premiumNumberSearchLog.update({
    where: { id: log.id },
    data: { selectedNumber: input.phoneNumber, checkoutStarted: true },
  });

  const upstreamProvider = match.provider ?? "telnyx";

  if (upstreamProvider === "telnyx") {
    const telnyx = await createTelnyxNumberReservation({
      phoneNumber: input.phoneNumber,
      customerReference: `workspace:${input.workspaceId}:${record.id}`,
    });

    if (!telnyx.phoneStatus || telnyx.error) {
      const status = telnyx.error?.toLowerCase().includes("hold")
        ? "non_reservable"
        : "failed";
      await prisma.premiumNumberReservation.update({
        where: { id: record.id },
        data: { reservationStatus: status },
      });
      return {
        ok: false,
        reservationId: record.id,
        reservationStatus: status,
        error: telnyx.error || "Could not reserve this number",
      };
    }

    const expiresAt = telnyx.phoneStatus.expired_at
      ? new Date(telnyx.phoneStatus.expired_at)
      : new Date(Date.now() + 30 * 60 * 1000);

    await prisma.premiumNumberReservation.update({
      where: { id: record.id },
      data: {
        telnyxReservationId: telnyx.reservation?.id,
        reservationExpiresAt: expiresAt,
        reservationStatus: "reserved",
      },
    });

    return {
      ok: true,
      reservationId: record.id,
      reservationStatus: "reserved",
      expiresAt: expiresAt.toISOString(),
      vanityDisplay: match.vanityDisplay,
      displayNumber: match.displayNumber,
      premiumPriceCents: match.premiumPriceCents,
    };
  }

  // Twilio has no Telnyx-style hold API — workspace DB reservation only.
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.premiumNumberReservation.update({
    where: { id: record.id },
    data: {
      reservationExpiresAt: expiresAt,
      reservationStatus: "reserved",
    },
  });

  return {
    ok: true,
    reservationId: record.id,
    reservationStatus: "reserved",
    expiresAt: expiresAt.toISOString(),
    vanityDisplay: match.vanityDisplay,
    displayNumber: match.displayNumber,
    premiumPriceCents: match.premiumPriceCents,
  };
}

export function serializeResultsForLog(
  results: PremiumNumberProductResult[],
): StoredResultRow[] {
  return results.map((r) => ({
    phoneNumber: r.phoneNumber,
    premiumPriceCents: r.premiumPriceCents,
    premiumPriceBand: r.premiumPriceBand,
    vanityDisplay: r.vanityDisplay,
    displayNumber: r.displayNumber,
    businessMatchScore: r.businessMatchScore,
    numberQualityScore: r.numberQualityScore,
    provider: r.provider,
    providerReference: r.providerReference,
  }));
}

export async function getPremiumReservation(
  workspaceId: string,
  reservationId: string,
) {
  const prisma = getPrisma();
  const row = await prisma.premiumNumberReservation.findFirst({
    where: { id: reservationId, workspaceId },
  });
  if (!row) return null;

  const expired =
    row.reservationExpiresAt && row.reservationExpiresAt < new Date() &&
    row.reservationStatus === "reserved";

  if (expired) {
    await prisma.premiumNumberReservation.update({
      where: { id: row.id },
      data: { reservationStatus: "reservation_expired" },
    });
    return { ...row, reservationStatus: "reservation_expired" };
  }

  return row;
}

const GUEST_RESERVATION_COOKIE = "transovo_guest_reservation";

export type ClaimGuestPremiumReservationInput = {
  reservationId: string;
  targetWorkspaceId: string;
  targetUserId: string;
  guestCookieReservationId?: string | null;
};

export type ClaimGuestPremiumReservationResult =
  | {
      ok: true;
      reservationId: string;
      phoneNumber: string;
      vanityDisplay?: string | null;
      displayNumber?: string | null;
      premiumPriceCents: number;
      expiresAt?: string;
    }
  | { ok: false; error: string; status: "not_found" | "forbidden" | "expired" | "invalid" };

/** Move a public-landing reservation onto the signed-in user's personal workspace. */
export async function claimGuestPremiumReservation(
  input: ClaimGuestPremiumReservationInput,
): Promise<ClaimGuestPremiumReservationResult> {
  const prisma = getPrisma();
  const reservationId = input.reservationId.trim();
  if (!reservationId) {
    return { ok: false, error: "Reservation id required", status: "invalid" };
  }

  const row = await prisma.premiumNumberReservation.findUnique({
    where: { id: reservationId },
  });
  if (!row) {
    return { ok: false, error: "Reservation not found", status: "not_found" };
  }

  const { getPublicLandingSearchContext } = await import("./public-landing-context");
  const publicCtx = await getPublicLandingSearchContext();
  const onPublicWorkspace = row.workspaceId === publicCtx.workspaceId;
  const alreadyOwned =
    row.workspaceId === input.targetWorkspaceId && row.userId === input.targetUserId;

  if (alreadyOwned) {
    // Idempotent resume after OAuth redirect.
  } else if (!onPublicWorkspace) {
    return { ok: false, error: "Reservation is not available to claim", status: "forbidden" };
  } else {
    const cookieMatch =
      !input.guestCookieReservationId || input.guestCookieReservationId === reservationId;
    if (!cookieMatch) {
      return { ok: false, error: "Reservation cookie mismatch", status: "forbidden" };
    }
  }

  if (
    row.reservationExpiresAt &&
    row.reservationExpiresAt < new Date() &&
    row.reservationStatus === "reserved"
  ) {
    await prisma.premiumNumberReservation.update({
      where: { id: row.id },
      data: { reservationStatus: "reservation_expired" },
    });
    return { ok: false, error: "Reservation expired — search again", status: "expired" };
  }

  if (row.reservationStatus !== "reserved" && row.reservationStatus !== "reserving") {
    return {
      ok: false,
      error: `Reservation is ${row.reservationStatus}`,
      status: "invalid",
    };
  }

  if (!alreadyOwned) {
    await prisma.premiumNumberReservation.update({
      where: { id: row.id },
      data: {
        workspaceId: input.targetWorkspaceId,
        userId: input.targetUserId,
      },
    });
  }

  return {
    ok: true,
    reservationId: row.id,
    phoneNumber: row.phoneNumber,
    vanityDisplay: row.vanityDisplay,
    displayNumber: row.displayNumber,
    premiumPriceCents: row.premiumPriceCents,
    expiresAt: row.reservationExpiresAt?.toISOString(),
  };
}

export { GUEST_RESERVATION_COOKIE };
