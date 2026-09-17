import "server-only";

import { resolveDeployedCommitSha } from "./frozen-deploy-commit";

/** Who is allowed to persist OAuth token / refresh diagnostics on calendar connections. */
export type OAuthMutationSource =
  | "production_web"
  | "certification"
  | "diagnostic"
  | "manual_admin"
  | "test";

const NON_MUTATING_SOURCES = new Set<OAuthMutationSource>(["certification", "diagnostic"]);

export function resolveOAuthMutationSource(
  explicit?: OAuthMutationSource,
): OAuthMutationSource {
  const fromEnv = process.env.TRANSOVO_OAUTH_MUTATION_SOURCE?.trim() as OAuthMutationSource;
  if (explicit) return explicit;
  if (fromEnv) return fromEnv;
  return "production_web";
}

/** False for certification/diagnostic hosts and when CERTIFICATION_READ_ONLY=1. */
export function oauthTokenMutationAllowed(input?: {
  mutationSource?: OAuthMutationSource;
  readOnly?: boolean;
}): boolean {
  if (input?.readOnly === true) return false;
  if (process.env.CERTIFICATION_READ_ONLY === "1") return false;
  const source = resolveOAuthMutationSource(input?.mutationSource);
  return !NON_MUTATING_SOURCES.has(source);
}

export function oauthMutationProvenance(): { source: OAuthMutationSource; buildSha: string | null } {
  return {
    source: resolveOAuthMutationSource(),
    buildSha: resolveDeployedCommitSha(),
  };
}
