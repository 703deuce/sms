import "server-only";

export type MicrosoftTokenFailureKind =
  | "invalid_grant"
  | "interaction_required"
  | "consent_required"
  | "invalid_client"
  | "transient"
  | "misconfigured"
  | "unknown";

export type MicrosoftTokenRefreshResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken?: string;
      expiresIn: number;
      scope?: string;
    }
  | {
      ok: false;
      kind: MicrosoftTokenFailureKind;
      httpStatus: number;
      error?: string;
      errorDescription?: string;
      needsReconnect: boolean;
    };

export function classifyMicrosoftOAuthError(input: {
  httpStatus: number;
  error?: string;
  errorDescription?: string;
}): MicrosoftTokenFailureKind {
  const code = String(input.error || "").toLowerCase();
  const desc = String(input.errorDescription || "").toLowerCase();
  const combined = `${code} ${desc}`;

  if (input.httpStatus === 401 && /invalid_client|unauthorized_client/.test(combined)) {
    return "invalid_client";
  }
  if (/invalid_grant|revoked|expired.*refresh|refresh token/i.test(combined)) {
    return "invalid_grant";
  }
  if (/interaction_required|login_required|consent_required|admin_consent/i.test(combined)) {
    return "interaction_required";
  }
  if (/consent_required|insufficient_privileges|access_denied/.test(combined)) {
    return "consent_required";
  }
  if (input.httpStatus >= 500 || input.httpStatus === 429 || input.httpStatus === 408) {
    return "transient";
  }
  if (input.httpStatus === 0) {
    return "transient";
  }
  return "unknown";
}

export function microsoftTokenFailureNeedsReconnect(kind: MicrosoftTokenFailureKind): boolean {
  return (
    kind === "invalid_grant" ||
    kind === "interaction_required" ||
    kind === "consent_required" ||
    kind === "invalid_client"
  );
}

export function parseMicrosoftTokenErrorBody(body: string): {
  error?: string;
  errorDescription?: string;
} {
  try {
    const json = JSON.parse(body) as { error?: string; error_description?: string };
    return {
      error: json.error,
      errorDescription: json.error_description,
    };
  } catch {
    return { errorDescription: body.slice(0, 300) };
  }
}
