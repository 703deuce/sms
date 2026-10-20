import type { SlotSelectionMeaning } from "../intake/slot-selection-schema";
import type { AvailabilityOfferSet } from "./offer-set";
import type { PresentedOffer } from "./selected-slot";
import type { AvailabilitySlot } from "./slot-generator";

export type SlotSelectionResolution =
  | {
      status: "RESOLVED";
      offerSetId: string;
      slotId: string;
      slot: AvailabilitySlot;
    }
  | {
      status: "AMBIGUOUS";
      candidateSlotIds: string[];
    }
  | {
      status: "NOT_IN_OFFER_SET";
    }
  | {
      status: "NO_CURRENT_OFFER_SET";
    };

function slotById(offerSet: AvailabilityOfferSet, slotId: string): AvailabilitySlot | undefined {
  return offerSet.slots.find((s) => s.slotId === slotId);
}

const SPOKEN_HOUR_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function minuteCandidatesForHour(h: number, minute: number): number[] | null {
  if (h < 0 || h > 12 || minute < 0 || minute > 59) return null;
  if (h > 12) return [h * 60 + minute];
  const amHour = h === 12 ? 0 : h;
  const pmHour = h === 12 ? 12 : h + 12;
  const am = amHour * 60 + minute;
  const pm = pmHour * 60 + minute;
  if (am === pm) return [am];
  return [am, pm];
}

/** Possible local minute-of-day interpretations for a spoken time (may be 1–2 for bare 12h clock). */
function spokenTimeToMinuteCandidates(spoken: string): number[] | null {
  const trimmed = spoken.trim().toLowerCase();
  if (!trimmed) return null;

  const wordHour = SPOKEN_HOUR_WORDS[trimmed];
  if (wordHour !== undefined) {
    return minuteCandidatesForHour(wordHour, 0);
  }

  const hm24 = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (hm24) {
    const h = Number(hm24[1]);
    const m = Number(hm24[2]);
    if (m < 0 || m > 59 || h < 0 || h > 23) return null;
    if (h > 12) return [h * 60 + m];
    return minuteCandidatesForHour(h, m);
  }

  const hm12 = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(trimmed);
  if (hm12) {
    let h = Number(hm12[1]);
    const m = hm12[2] ? Number(hm12[2]) : 0;
    const ap = hm12[3];
    if (h === 12) h = ap === "am" ? 0 : 12;
    else if (ap === "pm") h += 12;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return [h * 60 + m];
  }

  if (/^\d{1,2}$/.test(trimmed)) {
    const n = Number(trimmed);
    if (n >= 1 && n <= 12) return null;
  }

  return null;
}

function localStartMinutes(slot: AvailabilitySlot, timezone: string): number | null {
  const d = new Date(slot.startUtc);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function resolveOrdinal(
  ordinal: number,
  presentedSlotIds: string[],
  offerSet: AvailabilityOfferSet,
): SlotSelectionResolution {
  if (ordinal < 1 || presentedSlotIds.length === 0) {
    return { status: "AMBIGUOUS", candidateSlotIds: [] };
  }
  if (ordinal > presentedSlotIds.length) {
    return { status: "NOT_IN_OFFER_SET" };
  }
  const slotId = presentedSlotIds[ordinal - 1]!;
  const slot = slotById(offerSet, slotId);
  if (!slot) return { status: "NOT_IN_OFFER_SET" };
  return {
    status: "RESOLVED",
    offerSetId: offerSet.offerSetId,
    slotId,
    slot,
  };
}

function resolveExactTime(
  spokenTime: string,
  offerSet: AvailabilityOfferSet,
  timezone: string,
  candidateSlotIds: string[],
): SlotSelectionResolution {
  const minuteCandidates = spokenTimeToMinuteCandidates(spokenTime);
  if (minuteCandidates === null) {
    const asOrdinal = Number(spokenTime.trim());
    if (Number.isInteger(asOrdinal) && asOrdinal >= 1 && asOrdinal <= 9 && candidateSlotIds.length > 1) {
      return { status: "AMBIGUOUS", candidateSlotIds: [...candidateSlotIds] };
    }
    return { status: "AMBIGUOUS", candidateSlotIds: [] };
  }

  const matches: string[] = [];
  for (const slotId of candidateSlotIds) {
    const slot = slotById(offerSet, slotId);
    if (!slot) continue;
    const mins = localStartMinutes(slot, timezone);
    if (mins !== null && minuteCandidates.includes(mins)) matches.push(slotId);
  }

  if (matches.length === 1) {
    const slot = slotById(offerSet, matches[0]!)!;
    return {
      status: "RESOLVED",
      offerSetId: offerSet.offerSetId,
      slotId: matches[0]!,
      slot,
    };
  }
  if (matches.length > 1) {
    return { status: "AMBIGUOUS", candidateSlotIds: matches };
  }
  return { status: "NOT_IN_OFFER_SET" };
}

function resolveEarliestLatest(
  kind: "EARLIEST" | "LATEST",
  offerSet: AvailabilityOfferSet,
  presentedSlotIds: string[],
): SlotSelectionResolution {
  const slots = presentedSlotIds
    .map((id) => slotById(offerSet, id))
    .filter((s): s is AvailabilitySlot => Boolean(s));
  if (slots.length === 0) return { status: "NO_CURRENT_OFFER_SET" };
  slots.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
  const slot = kind === "EARLIEST" ? slots[0]! : slots[slots.length - 1]!;
  return {
    status: "RESOLVED",
    offerSetId: offerSet.offerSetId,
    slotId: slot.slotId,
    slot,
  };
}

export function resolveSlotSelection(input: {
  meaning: SlotSelectionMeaning;
  offerSet: AvailabilityOfferSet | null;
  presented: PresentedOffer | null;
  schedulingGeneration: number;
  timezone: string;
}): SlotSelectionResolution {
  const { meaning, offerSet, presented, schedulingGeneration, timezone } = input;

  if (meaning.selection_type === "NONE") {
    return { status: "AMBIGUOUS", candidateSlotIds: [] };
  }

  if (
    !offerSet ||
    offerSet.schedulingGeneration !== schedulingGeneration ||
    (presented && presented.schedulingGeneration !== schedulingGeneration)
  ) {
    return { status: "NO_CURRENT_OFFER_SET" };
  }

  const presentedSlotIds =
    presented && presented.offerSetId === offerSet.offerSetId
      ? [...presented.presentedSlotIds]
      : offerSet.slots.map((s) => s.slotId);

  if (presentedSlotIds.length === 0) {
    return { status: "NO_CURRENT_OFFER_SET" };
  }

  switch (meaning.selection_type) {
    case "ACCEPT_SINGLE_OFFER":
      if (presentedSlotIds.length !== 1) {
        return { status: "AMBIGUOUS", candidateSlotIds: presentedSlotIds };
      }
      return resolveOrdinal(1, presentedSlotIds, offerSet);

    case "ORDINAL":
      if (meaning.ordinal === null) {
        return { status: "AMBIGUOUS", candidateSlotIds: presentedSlotIds };
      }
      return resolveOrdinal(meaning.ordinal, presentedSlotIds, offerSet);

    case "EARLIEST":
      return resolveEarliestLatest("EARLIEST", offerSet, presentedSlotIds);

    case "LATEST":
      return resolveEarliestLatest("LATEST", offerSet, presentedSlotIds);

    case "EXACT_TIME":
      if (!meaning.spoken_time?.trim()) {
        return { status: "AMBIGUOUS", candidateSlotIds: presentedSlotIds };
      }
      return resolveExactTime(meaning.spoken_time, offerSet, timezone, presentedSlotIds);

    default:
      return { status: "AMBIGUOUS", candidateSlotIds: [] };
  }
}
