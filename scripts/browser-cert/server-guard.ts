/**
 * Preview/staging server health for browser certification.
 * Hard rule: never start local next dev — cert hits previewBaseUrl from config only.
 */
import { spawnSync } from "node:child_process";
import { BROWSER_CERT_CONFIG } from "./browser-cert.config";

export class TestEnvironmentUnavailableError extends Error {
  readonly status = "BLOCKED — TEST ENVIRONMENT UNAVAILABLE" as const;

  constructor(message: string) {
    super(message);
    this.name = "TestEnvironmentUnavailableError";
  }
}

export function isServerConnectionError(note: string): boolean {
  return /ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ECONNREFUSED|ECONNRESET|Server unreachable/i.test(
    note,
  );
}

export type ServerGuardOptions = {
  baseUrl: string;
  consecutiveFailureLimit: number;
};

export type PreviewHealth = {
  ok: boolean;
  commitSha: string | null;
  httpStatus: number;
};

export class ServerGuard {
  private consecutiveFailures = 0;
  private readonly baseUrl: string;
  private readonly consecutiveFailureLimit: number;
  private aborted = false;

  constructor(opts: ServerGuardOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.consecutiveFailureLimit = Math.max(1, opts.consecutiveFailureLimit);
  }

  wasAborted() {
    return this.aborted;
  }

  ping(): boolean {
    return fetchPreviewHealth(this.baseUrl).ok;
  }

  assertHealthy(label = "batch") {
    if (this.aborted) {
      throw new TestEnvironmentUnavailableError("Certification already stopped — test environment unavailable");
    }
    if (!this.ping()) {
      throw new TestEnvironmentUnavailableError(
        `Deployed application unreachable before ${label} (${this.baseUrl}). Aborting — not recording product FAILs.`,
      );
    }
  }

  recordNavigationSuccess() {
    this.consecutiveFailures = 0;
  }

  recordConnectionFailure(note: string): void {
    if (!isServerConnectionError(note)) {
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.consecutiveFailureLimit) {
      this.aborted = true;
      throw new TestEnvironmentUnavailableError(
        `${this.consecutiveFailureLimit} consecutive server-unreachable errors (${note.slice(0, 160)}). ` +
          "Stopping browser certification — classify remaining work as BLOCKED — TEST ENVIRONMENT UNAVAILABLE.",
      );
    }
  }
}

let activeGuard: ServerGuard | null = null;

export function setServerGuard(guard: ServerGuard | null) {
  activeGuard = guard;
}

export function getServerGuard(): ServerGuard | null {
  return activeGuard;
}

export function resolveCertBaseUrl(): string {
  const fromEnv = process.env.BROWSER_CERT_PREVIEW_URL?.trim();
  const baseUrl = (fromEnv || BROWSER_CERT_CONFIG.previewBaseUrl).replace(/\/$/, "");
  const allowLocal =
    process.env.BROWSER_CERT_ALLOW_LOCALHOST?.trim() === "1" ||
    process.env.BROWSER_CERT_ALLOW_LOCALHOST?.trim()?.toLowerCase() === "true";
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl) && !allowLocal) {
    throw new Error(
      `browser-cert.config.ts previewBaseUrl must not be localhost (${baseUrl}). Set BROWSER_CERT_ALLOW_LOCALHOST=1 for local UAT.`,
    );
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error(`browser-cert.config.ts previewBaseUrl is invalid: ${baseUrl}`);
  }
  return baseUrl;
}

export function readGitCommitSha(): string {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" });
  return r.stdout?.trim() || "unknown";
}

function commitsMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.trim().toLowerCase();
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

/** GET /api/health on preview — expects commitSha from deployed build. */
export function fetchPreviewHealth(baseUrl: string): PreviewHealth {
  const root = baseUrl.replace(/\/$/, "");
  const r = spawnSync("curl", ["-s", "-w", "\n%{http_code}", "--max-time", "15", `${root}/api/health`], {
    encoding: "utf8",
  });
  const raw = r.stdout?.trim() || "";
  const lines = raw.split("\n");
  const httpStatus = Number(lines.at(-1) || "0");
  const bodyText = lines.slice(0, -1).join("\n");
  if (!bodyText || httpStatus >= 500 || httpStatus === 0) {
    return { ok: false, commitSha: null, httpStatus };
  }
  try {
    const body = JSON.parse(bodyText) as {
      ok?: boolean;
      commitSha?: string;
      gitCommitSha?: string;
      deploySha?: string;
    };
    const commitSha =
      body.commitSha?.trim() ||
      body.gitCommitSha?.trim() ||
      body.deploySha?.trim() ||
      null;
    const ok = body.ok === true && httpStatus < 500;
    return { ok, commitSha, httpStatus };
  } catch {
    return { ok: false, commitSha: null, httpStatus };
  }
}

export function verifyDeployProvenance(baseUrl?: string): {
  gitCommitSha: string;
  deployCommitSha: string;
  provenanceOk: boolean;
} {
  const previewUrl = baseUrl || resolveCertBaseUrl();
  const gitCommitSha = readGitCommitSha();
  const health = fetchPreviewHealth(previewUrl);

  if (!health.ok) {
    throw new Error(
      `Preview health check failed at ${previewUrl}/api/health (HTTP ${health.httpStatus}). Is the staging deployment up?`,
    );
  }

  if (!health.commitSha) {
    console.warn(
      "WARN: Preview /api/health did not return commitSha — deploy SHA provenance skipped. " +
        "Deploy a build with SOURCE_COMMIT (and updated /api/health) to enable automatic SHA matching.",
    );
    return { gitCommitSha, deployCommitSha: "unknown", provenanceOk: false };
  }

  const deployCommitSha = health.commitSha;
  if (!commitsMatch(gitCommitSha, deployCommitSha)) {
    throw new Error(
      `Deploy provenance mismatch: local git HEAD is ${gitCommitSha} but preview reports ${deployCommitSha}. ` +
        "Deploy the current commit to staging before running browser certification.",
    );
  }

  return { gitCommitSha, deployCommitSha, provenanceOk: true };
}

export function waitForDeployedApp(baseUrl: string, maxMs = BROWSER_CERT_CONFIG.serverHealthMaxWaitMs): boolean {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const health = fetchPreviewHealth(baseUrl);
    if (health.ok) return true;
    spawnSync("sleep", ["3"]);
  }
  return false;
}
