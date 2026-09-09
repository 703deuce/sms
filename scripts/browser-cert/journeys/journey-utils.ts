import type { Page } from "playwright";
import type { MasterUatFlow, MasterUatStatus } from "../appointments-master-uat-catalog";

export function journey(
  id: string,
  section: string,
  title: string,
  run: (page: Page) => Promise<void>,
): MasterUatFlow {
  return { id, section, title, run };
}

export function staticJourney(
  id: string,
  section: string,
  title: string,
  status: MasterUatStatus,
  detail: string,
): MasterUatFlow {
  return { id, section, title, static: { status, detail } };
}

export function providerBlocked(id: string, section: string, title: string, surface: string): MasterUatFlow {
  return staticJourney(
    id,
    section,
    title,
    "PROVIDER_BLOCKED",
    `${surface} — live provider credentials not available in UAT environment`,
  );
}

export function notApplicable(id: string, section: string, title: string, reason: string): MasterUatFlow {
  return staticJourney(id, section, title, "NOT_APPLICABLE", reason);
}
