/**
 * Browser certification — non-secret configuration (source-controlled).
 *
 * Update previewBaseUrl once for your Coolify preview/staging deployment.
 * Secrets (cert password, API keys) stay in environment variables only.
 */
export const BROWSER_CERT_CONFIG = {
  /** Coolify preview/staging base URL — browser cert never runs against localhost */
  previewBaseUrl: "https://staging.transovo.app",

  /** Dedicated certification account (non-secret) */
  certEmail: "appt-mctb-browser@transovo.test",

  navTimeoutMs: 30_000,
  actionTimeoutMs: 20_000,
  flowTimeoutMs: 90_000,
  disposablePauseMs: 4_000,
  serverHealthMaxWaitMs: 120_000,
  consecutiveServerFailureLimit: 2,
  consecutiveBrowserCrashLimit: 2,
} as const;
