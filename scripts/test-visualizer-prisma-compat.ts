/**
 * Ensures Supabase prisma-compat exposes Visualizer models (upload/project create).
 */
import { getSupabaseDb } from "../src/lib/supabase/prisma-compat";

function main() {
  const db = getSupabaseDb();
  const required = [
    "visualizerProject",
    "visualizerAsset",
    "visualizerMaterial",
    "visualizerDesign",
    "visualizerGenerationJob",
  ] as const;
  for (const key of required) {
    const model = db[key];
    if (!model || typeof model.create !== "function") {
      throw new Error(`prisma-compat missing ${key}.create`);
    }
  }
  console.log("test-visualizer-prisma-compat: PASS");
}

main();
