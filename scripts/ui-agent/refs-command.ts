import { getReference, listReferences } from "@/lib/ui-agent/references-manifest";
import { createCliSignedUrl, isCliSupabaseConfigured } from "./supabase-references";

export async function runRefsCommand(args: string[]): Promise<void> {
  const showIdx = args.indexOf("--show");
  if (showIdx >= 0) {
    const name = args[showIdx + 1];
    if (!name) throw new Error("--show requires a reference name");
    const entry = getReference(name);
    if (!entry) throw new Error(`Reference not found: ${name}`);
    console.log(JSON.stringify({ name, ...entry }, null, 2));
    if (entry.storage === "supabase" && entry.bucket && isCliSupabaseConfigured()) {
      try {
        const signedUrl = await createCliSignedUrl({ bucket: entry.bucket, path: entry.path });
        console.log(`signedUrl=${signedUrl}`);
      } catch {
        // Supabase may be unavailable in CI
      }
    }
    return;
  }

  const refs = listReferences();
  if (refs.length === 0) {
    console.log("No saved UI references. Upload at /transovo/kimi or use --reference-image/--video-file.");
    return;
  }

  console.log("NAME".padEnd(28) + "TYPE".padEnd(8) + "STORAGE");
  for (const { name, entry } of refs) {
    console.log(name.padEnd(28) + entry.type.padEnd(8) + entry.storage);
  }
}
