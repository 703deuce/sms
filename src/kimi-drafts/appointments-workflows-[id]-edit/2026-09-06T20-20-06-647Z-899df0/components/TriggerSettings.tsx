"use client";

import { TRIGGER_OPTIONS } from "../mock-data";

export function triggerLabel(value: string): string {
  return TRIGGER_OPTIONS.find((t) => t.value === value)?.label || value;
}

export function TriggerBadge({ trigger }: { trigger: string }) {
  return <span className="chip chip-primary">{triggerLabel(trigger)}</span>;
}
