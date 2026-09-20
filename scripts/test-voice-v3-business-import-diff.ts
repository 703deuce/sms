/**
 * Deterministic diff/merge tests for Voice V3 business auto-setup.
 * Run: npx tsx scripts/test-voice-v3-business-import-diff.ts
 */
import assert from "node:assert/strict";
import { diffCandidatesAgainstWizard, summarizeReview } from "../src/lib/voice-v3/business-import/diff";
import { applySelectedCandidates } from "../src/lib/voice-v3/business-import/apply";
import { snapshotWizardFacts } from "../src/lib/voice-v3/business-import/wizard-snapshot";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";

function baseWizard(overrides: Partial<AppointmentReceptionistWizardState> = {}) {
  return { ...createDefaultWizardState(), ...overrides };
}

// Empty wizard — new facts default selected
{
  const snap = snapshotWizardFacts(baseWizard());
  const review = diffCandidatesAgainstWizard(
    {
      business: { name: "Anthony's Plumbing", phone: "+15715551212" },
      services: [{ name: "Drain Cleaning", provenance: { sourceType: "WEBSITE", confidence: "high" } }],
    },
    snap,
  );
  assert.ok(review.some((c) => c.fieldPath === "businessName" && c.selectedByDefault));
  assert.ok(review.some((c) => c.fieldPath === "appointmentTypes"));
}

// Existing hours — changed, not auto-selected
{
  const w = baseWizard({
    businessName: "Anthony's Plumbing",
    knowledgeItems: [
      ...createDefaultWizardState().knowledgeItems.map((k) =>
        k.id === "hours"
          ? { ...k, summary: "Mon 8 AM – 5 PM", status: "owner_approved" as const, statusLabel: "Configured" }
          : k,
      ),
    ],
  });
  const snap = snapshotWizardFacts(w);
  const review = diffCandidatesAgainstWizard({ hoursProse: "Mon 9 AM – 6 PM" }, snap);
  const hours = review.find((c) => c.fieldPath === "knowledgeItems.hours");
  assert.equal(hours?.classification, "CHANGED");
  assert.equal(hours?.selectedByDefault, false);
}

// Exact duplicate service — hidden
{
  const w = baseWizard({
    appointmentTypes: [
      {
        id: "1",
        name: "Water Heater Repair",
        durationMin: 60,
        calendar: "",
        status: "ready",
        requiredFields: [],
        bookingPermission: "book_directly",
        enabled: true,
      },
    ],
  });
  const snap = snapshotWizardFacts(w);
  const review = diffCandidatesAgainstWizard(
    {
      services: [{ name: "Water Heater Repair", provenance: { sourceType: "WEBSITE", confidence: "high" } }],
    },
    snap,
  );
  assert.equal(review.length, 0);
}

// Semantic duplicate
{
  const w = baseWizard({
    appointmentTypes: [
      {
        id: "1",
        name: "Water Heater Repair",
        durationMin: 60,
        calendar: "",
        status: "ready",
        requiredFields: [],
        bookingPermission: "book_directly",
        enabled: true,
      },
    ],
  });
  const snap = snapshotWizardFacts(w);
  const review = diffCandidatesAgainstWizard(
    {
      services: [{ name: "Water Heater Services", provenance: { sourceType: "WEBSITE", confidence: "high" } }],
    },
    snap,
  );
  // Normalized names collapse to the same service — no new row surfaced.
  assert.equal(review.length, 0);
}

// Apply adds service without removing existing
{
  const w = baseWizard({
    appointmentTypes: [
      {
        id: "1",
        name: "Drain Cleaning",
        durationMin: 60,
        calendar: "",
        status: "ready",
        requiredFields: [],
        bookingPermission: "book_directly",
        enabled: true,
      },
    ],
  });
  const snap = snapshotWizardFacts(w);
  const review = diffCandidatesAgainstWizard(
    {
      services: [{ name: "Hydro Jetting", provenance: { sourceType: "WEBSITE", confidence: "high" } }],
    },
    snap,
  );
  const selected = review.map((c) => ({ ...c, userSelected: true as const }));
  const next = applySelectedCandidates(w, selected);
  assert.equal(next.appointmentTypes.length, 2);
}

// Unchanged refresh
{
  const w = baseWizard({ businessName: "Acme", websiteUrl: "https://acme.com" });
  const snap = snapshotWizardFacts(w);
  const review = diffCandidatesAgainstWizard({ business: { name: "Acme" } }, snap);
  const summary = summarizeReview(review);
  assert.equal(summary.upToDate, true);
}

console.log("test-voice-v3-business-import-diff: PASS");
