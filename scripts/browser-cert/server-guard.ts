/**
 * Preview/staging server health for browser certification.
 * Hard rule: never start local next dev — cert hits BROWSER_CERT_BASE_URL only.
 */
import { spawnSync } from "node:child_process";

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

  /** Lightweight health: /api/health then /. */
  ping(): boolean {
    for (const path of ["/api/health", "/"]) {
      const r = spawnSync(
        "curl",
        [
          "-s",
          "-o",
          "/dev/null",
          "-w",
          "%{http_code}",
          "--max-time",
          "10",
          `${this.baseUrl}${path}`,
        ],
        { encoding: "utf8" },
      );
      const code = r.stdout?.trim();
      if (code && code !== "000" && Number(code) < 500) return true;
    }
    return false;
  }

  assertHealthy(label = "batch") {
    if (this.aborted) {
      throw new TestEnvironmentUnavailableError("Certification already stopped — test environment unavailable");
    }
    if (!this.ping()) {
      throw new TestEnvironmentUnavailableError(
        `Deployed application unreachable before ${label} (${this.baseUrl}). Aborting batch — not recording product FAILs.`,
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
  const raw = process.env.BROWSER_CERT_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "BROWSER_CERT_BASE_URL is required. Browser certification must run against a deployed preview/staging URL — local next dev is not allowed.",
    );
  }
  const baseUrl = raw.replace(/\/$/, "");
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl)) {
    throw new Error(
      `BROWSER_CERT_BASE_URL must not be localhost (${baseUrl}). Use a Coolify preview/staging deployment.`,
    );
  }
  return baseUrl;
}

export function readGitCommitSha(): string {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" });
  return r.stdout?.trim() || "unknown";
}

export function verifyDeployProvenance(): {
  gitCommitSha: string;
  deployCommitSha: string;
  provenanceOk: boolean;
} {
  const gitCommitSha = readGitCommitSha();
  const deployCommitSha =
    process.env.BROWSER_CERT_DEPLOY_SHA?.trim() ||
    process.env.COOLIFY_DEPLOY_SHA?.trim() ||
    "";

  if (!deployCommitSha) {
    throw new Error(
      "BROWSER_CERT_DEPLOY_SHA is required. Set it to the exact Git commit SHA deployed at BROWSER_CERT_BASE_URL.",
    );
  }

  const normalize = (s: string) => s.trim().toLowerCase();
  const provenanceOk =
    normalize(gitCommitSha) === normalize(deployCommitSha) ||
    normalize(gitCommitSha).startsWith(normalize(deployCommitSha)) ||
    normalize(deployCommitSha).startsWith(normalize(gitCommitSha));

  if (!provenanceOk) {
    throw new Error(
      `Deploy provenance mismatch: certifying git ${gitCommitSha} but BROWSER_CERT_DEPLOY_SHA=${deployCommitSha}. ` +
        "Do not certify one commit against a deployment from another.",
    );
  }

  return { gitCommitSha, deployCommitSha, provenanceOk: true };
}

export function waitForDeployedApp(baseUrl: string, maxMs = 120_000): boolean {
  const guard = new ServerGuard({ baseUrl, consecutiveFailureLimit: 2 });
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (guard.ping()) return true;
    spawnSync("sleep", ["3"]);
  }
  return false;
}
