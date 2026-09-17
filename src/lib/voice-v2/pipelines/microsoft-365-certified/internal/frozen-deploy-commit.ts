/**
 * Git commit SHA baked into the running deployment (Coolify, Vercel, etc.).
 * Used by /api/health for browser-cert provenance checks.
 */
export function resolveDeployedCommitSha(): string | null {
  const candidates = [
    process.env.SOURCE_COMMIT, // Coolify
    process.env.COOLIFY_GIT_COMMIT,
    process.env.GIT_COMMIT,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.COMMIT_SHA,
    process.env.RAILWAY_GIT_COMMIT_SHA,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}
