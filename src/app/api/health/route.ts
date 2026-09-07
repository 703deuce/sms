import { NextResponse } from "next/server";
import { resolveDeployedCommitSha } from "@/lib/deploy-commit";
import { voiceRuntimeInternalSecret } from "@/lib/voice/python-runtime-bridge/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const secretConfigured = Boolean(voiceRuntimeInternalSecret());
  const commitSha = resolveDeployedCommitSha();
  return NextResponse.json({
    ok: true,
    service: "transovo-web",
    timestamp: new Date().toISOString(),
    commitSha,
    internalVoiceApi: {
      route: "/api/internal/voice-runtime",
      secretConfigured,
    },
  });
}
