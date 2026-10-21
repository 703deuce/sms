import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { saveMctbConsentPrompt } from "@/lib/server/mctb/consent-prompt-store";
import { toPublicAssetUrl } from "@/lib/server/public-url";
import { MCTB_UI_ENABLED } from "@/lib/products/mctb-ui";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"]);

export async function POST(request: Request) {
  if (!MCTB_UI_ENABLED) {
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("file required");
    if (file.size > MAX_BYTES) throw new Error("Audio must be 8MB or smaller");
    const type = file.type || "application/octet-stream";
    if (!ALLOWED.has(type) && !/\.(mp3|wav|ogg)$/i.test(file.name)) {
      throw new Error("Use MP3, WAV, or OGG audio");
    }
    const dir = path.join(process.cwd(), "public", "mctb-consent", workspaceId);
    await mkdir(dir, { recursive: true });
    const safeName = `upload-${Date.now()}.${file.name.split(".").pop() || "mp3"}`;
    const diskPath = path.join(dir, safeName);
    await writeFile(diskPath, Buffer.from(await file.arrayBuffer()));
    const relativeUrl = `/mctb-consent/${workspaceId}/${safeName}`;
    const publicUrl = toPublicAssetUrl(relativeUrl);
    const prompt = await saveMctbConsentPrompt(workspaceId, {
      source: "upload",
      audioUrl: publicUrl,
    });
    return NextResponse.json({ data: { url: publicUrl, prompt } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
