/**
 * Ensures the private Supabase bucket for Visualizer uploads exists.
 * Safe to run on every deploy (idempotent).
 */
import { ensureVisualizerBucket } from "@/lib/visualizer/storage";

async function main() {
  const bucket = await ensureVisualizerBucket();
  console.log(`[visualizer] Supabase bucket ready: ${bucket}`);
}

main().catch((err) => {
  console.error("[visualizer] Bucket ensure failed:", err);
  process.exit(1);
});
