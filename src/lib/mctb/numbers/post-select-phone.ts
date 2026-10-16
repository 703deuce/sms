"use client";

import type { VoiceProductSwitchConflict } from "@/lib/phone/voice-product-switch-types";

export type MctbSelectPhoneResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; needSwitch: true; conflict: VoiceProductSwitchConflict };

export async function postMctbSelectPhone(
  phoneNumberId: string,
  opts?: { confirmVoiceProductSwitch?: boolean },
): Promise<MctbSelectPhoneResult> {
  const res = await fetch("/api/mctb/numbers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "select",
      phoneNumberId,
      confirmVoiceProductSwitch: opts?.confirmVoiceProductSwitch === true,
    }),
  });
  const json = (await res.json()) as {
    error?: string;
    voiceProductSwitch?: VoiceProductSwitchConflict;
  };
  if (res.status === 409 && json.voiceProductSwitch) {
    return { ok: false, needSwitch: true, conflict: json.voiceProductSwitch };
  }
  if (!res.ok) {
    return { ok: false, error: json.error || "Could not select number" };
  }
  return { ok: true };
}
