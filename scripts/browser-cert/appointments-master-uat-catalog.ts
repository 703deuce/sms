/**
 * Master Appointments browser UAT catalog — real user journeys by section.
 */
import type { Page } from "playwright";
import { SECTION_A_JOURNEYS } from "./journeys/section-a-availability";
import { SECTION_B_JOURNEYS } from "./journeys/section-b-booking-types";
import { SECTIONS_C_THROUGH_L } from "./journeys/sections-c-through-l";
import { SECTIONS_M_THROUGH_AK } from "./journeys/sections-m-through-ak";

export type MasterUatStatus =
  | "BROWSER_PASS"
  | "LIVE_PASS"
  | "FAIL"
  | "PROVIDER_BLOCKED"
  | "NOT_APPLICABLE"
  | "NOT_RUN";

export type MasterUatFlow = {
  id: string;
  section: string;
  title: string;
  static?: { status: MasterUatStatus; detail: string };
  run?: (page: Page) => Promise<void>;
};

/** All journey implementations keyed by section letter. */
export const MASTER_UAT_SECTIONS: Record<string, MasterUatFlow[]> = {
  A: SECTION_A_JOURNEYS,
  B: SECTION_B_JOURNEYS,
  C: SECTIONS_C_THROUGH_L.filter((f) => f.section === "C"),
  D: SECTIONS_C_THROUGH_L.filter((f) => f.section === "D"),
  E: SECTIONS_C_THROUGH_L.filter((f) => f.section === "E"),
  F: SECTIONS_C_THROUGH_L.filter((f) => f.section === "F"),
  G: SECTIONS_C_THROUGH_L.filter((f) => f.section === "G"),
  H: SECTIONS_C_THROUGH_L.filter((f) => f.section === "H"),
  I: SECTIONS_C_THROUGH_L.filter((f) => f.section === "I"),
  J: SECTIONS_C_THROUGH_L.filter((f) => f.section === "J"),
  K: SECTIONS_C_THROUGH_L.filter((f) => f.section === "K"),
  L: SECTIONS_C_THROUGH_L.filter((f) => f.section === "L"),
  M: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "M"),
  N: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "N"),
  O: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "O"),
  P: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "P"),
  Q: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "Q"),
  R: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "R"),
  S: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "S"),
  T: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "T"),
  U: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "U"),
  V: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "V"),
  W: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "W"),
  X: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "X"),
  Y: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "Y"),
  Z: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "Z"),
  AA: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "AA"),
  AB: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "AB"),
  AC: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "AC"),
  AD: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "AD"),
  AE: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "AE"),
  AF: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "AF"),
  AG: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "AG"),
  AH: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "AH"),
  AI: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "AI"),
  AJ: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "AJ"),
  AK: SECTIONS_M_THROUGH_AK.filter((f) => f.section === "AK"),
};

/** Canonical section run order for --all batches. */
export const MASTER_UAT_SECTION_ORDER = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "AA",
  "AB",
  "AC",
  "AD",
  "AE",
  "AF",
  "AG",
  "AH",
  "AI",
  "AJ",
  "AK",
] as const;

export const IMPLEMENTED_SECTION_IDS = MASTER_UAT_SECTION_ORDER.filter(
  (id) => (MASTER_UAT_SECTIONS[id]?.length ?? 0) > 0,
);

export const APPOINTMENTS_MASTER_UAT_FLOWS: MasterUatFlow[] = MASTER_UAT_SECTION_ORDER.flatMap(
  (id) => MASTER_UAT_SECTIONS[id] ?? [],
);

const TOTAL_PLANNED_TESTS = 229;

export function resolveMasterUatFlows(opts: {
  section?: string | null;
  testId?: string | null;
  limit?: number;
  skipCompletedIds?: Set<string>;
}): MasterUatFlow[] {
  let flows: MasterUatFlow[];

  if (opts.section?.toUpperCase() === "ALL") {
    flows = APPOINTMENTS_MASTER_UAT_FLOWS;
  } else if (opts.section) {
    const key = opts.section.toUpperCase();
    flows = MASTER_UAT_SECTIONS[key] || [];
    if (!flows.length) {
      throw new Error(
        `Section ${key} journeys not implemented yet. Implemented: ${IMPLEMENTED_SECTION_IDS.join(", ")}`,
      );
    }
  } else {
    flows = APPOINTMENTS_MASTER_UAT_FLOWS;
  }

  if (opts.testId) flows = flows.filter((f) => f.id === opts.testId);
  if (opts.skipCompletedIds?.size) {
    flows = flows.filter((f) => !opts.skipCompletedIds!.has(f.id));
  }
  if (opts.limit && opts.limit > 0) flows = flows.slice(0, opts.limit);
  return flows;
}

export function plannedTestCount(): number {
  return TOTAL_PLANNED_TESTS;
}

export function catalogTestCount(): number {
  return APPOINTMENTS_MASTER_UAT_FLOWS.length;
}
