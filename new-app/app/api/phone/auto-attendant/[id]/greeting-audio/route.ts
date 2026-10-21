import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { saveAutoAttendantMenu } from "@/lib/server/phone/routing/store";
import { toPublicAssetUrl } from "@/lib/server/public-url";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg"]);

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("file required");
    if (file.size > MAX_BYTES) throw new Error("Audio must be 8MB or smaller");
    const type = file.type || "application/octet-stream";
    if (!ALLOWED.has(type) && !/\.(mp3|wav|ogg)$/i.test(file.name)) {
      throw new Error("Use MP3, WAV, or OGG audio");
    }
    const dir = path.join(process.cwd(), "public", "cf-greeting", workspaceId);
    await mkdir(dir, { recursive: true });
    const safeName = `${id}-${Date.now()}.${file.name.split(".").pop() || "mp3"}`;
    const diskPath = path.join(dir, safeName);
    await writeFile(diskPath, Buffer.from(await file.arrayBuffer()));
    const relativeUrl = `/cf-greeting/${workspaceId}/${safeName}`;
    const publicUrl = toPublicAssetUrl(relativeUrl);
    const menu = await saveAutoAttendantMenu(workspaceId, id, {
      greetingMode: "audio",
      greetingAudioUrl: publicUrl,
      greetingText: null,
    });
    return NextResponse.json({ data: { url: publicUrl, menu } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
