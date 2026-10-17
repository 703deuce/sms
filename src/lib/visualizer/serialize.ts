import "server-only";

import { getVisualizerSignedUrl } from "@/lib/visualizer/storage";

export async function signedAssetUrl(asset: {
  bucket: string;
  storagePath: string;
}): Promise<string> {
  return getVisualizerSignedUrl(asset.bucket, asset.storagePath, 7200);
}
