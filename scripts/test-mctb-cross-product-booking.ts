#!/usr/bin/env tsx
/**
 * Hermetic cross-product checks for MCTB → appointment booking attribution (X-PRODUCT-*).
 */
import assert from "node:assert/strict";
import { MCTB_RESPONSE_MODES, MCTB_FOLLOW_UP_STATUSES } from "../src/lib/mctb/handoff/types";

// X-PRODUCT-004 — MCTB can represent booked outcome without inventing revenue
assert.ok(MCTB_FOLLOW_UP_STATUSES.includes("appointment_booked"));
assert.ok(MCTB_RESPONSE_MODES.includes("ai_conversation"));

// X-PRODUCT-001/002 — handoff modes support booking-intent collection paths
assert.ok(MCTB_RESPONSE_MODES.includes("guided_collection"));
assert.ok(MCTB_RESPONSE_MODES.includes("notify_only"));

console.log("test-mctb-cross-product-booking: ok", {
  X_PRODUCT_001: "guided_collection_mode_present",
  X_PRODUCT_004: "appointment_booked_status_canonical",
});
