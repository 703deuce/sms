import { NextResponse } from "next/server";
import { resolveDeployedCommitSha } from "@/lib/deploy-commit";
import { voiceRuntimeInternalSecret } from "@/lib/voice/python-runtime-bridge/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readSmsWorkerCommitSha(): Promise<string | null> {
  const url = process.env.MCTB_SMS_WORKER_HEALTH_URL?.trim();
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { commitSha?: string };
    return body.commitSha?.trim() || null;
  } catch {
    return null;
  }
}

export async function GET() {
  const secretConfigured = Boolean(voiceRuntimeInternalSecret());
  const commitSha = resolveDeployedCommitSha();
  const smsWorkerCommitSha = await readSmsWorkerCommitSha();
  const deploymentParity =
    smsWorkerCommitSha && commitSha ? smsWorkerCommitSha === commitSha : null;
  return NextResponse.json({
    ok: true,
    service: "transovo-web",
    timestamp: new Date().toISOString(),
    commitSha,
    deployment: {
      smsWorkerCommitSha,
      webWorkerCommitParity: deploymentParity,
    },
    internalVoiceApi: {
      route: "/api/internal/voice-runtime",
      secretConfigured,
    },
  });
}
