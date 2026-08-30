import "server-only";

import { readSmartRoutingAudioBytes } from "@/lib/smart-routing/media-service";

/** True when smart-routing-audio can serve bytes for this asset (DB row + file or TTS regen). */
export async function isConsentAudioAssetReachable(assetId: string): Promise<boolean> {
  const id = assetId.trim();
  if (!id) return false;
  const result = await readSmartRoutingAudioBytes(id);
  return result !== null && result.bytes.length > 0;
}
