#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { resolveSelectedSlotIdFromOffer } from "../src/lib/voice-receptionist-wizard/resolve-slot-from-offer";

const slots = [
  {
    slot_id: "slot_d29e28ff03990a38",
    label: "9:00 AM",
    spoken_label: "9:00 AM",
    start_utc: "2026-09-17T16:00:00.000Z",
    end_utc: "2026-09-17T17:00:00.000Z",
  },
  {
    slot_id: "slot_1deae1e39459325e",
    label: "10:00 AM",
    spoken_label: "10:00 AM",
    start_utc: "2026-09-17T17:00:00.000Z",
    end_utc: "2026-09-17T18:00:00.000Z",
  },
];

assert.equal(resolveSelectedSlotIdFromOffer(slots, "perfect 10 o'clock"), "slot_1deae1e39459325e");
assert.equal(resolveSelectedSlotIdFromOffer(slots, "slot_1deae1e39459325e"), "slot_1deae1e39459325e");

console.log("test-voice-v2-resolve-slot-from-offer: ok");
