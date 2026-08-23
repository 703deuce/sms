import { NextResponse } from "next/server";
import { EntitlementError } from "@/lib/auth/entitlements";
import { OrganizationEnqueueError } from "@/lib/auth/org-status";
import { PlanLimitError } from "@/lib/plans";
import { logger } from "@/lib/observability/logger";

/** Structured 402/403 for plan limits and entitlements — never leak provider/DB internals. */
export function httpEntitlementError(err: unknown): NextResponse | null {
  if (err instanceof PlanLimitError) {
    return NextResponse.json(
      { error: err.message, limitKey: err.limitKey },
      { status: 402 }
    );
  }
  if (err instanceof EntitlementError) {
    return NextResponse.json(
      { error: err.message, entitlement: err.entitlement },
      { status: 403 }
    );
  }
  return null;
}

/** Map auth/access exceptions to safe HTTP responses (no stack/provider leakage). */
export function httpErrorFromException(
  err: unknown,
  fallbackMessage = "Request could not be completed",
  logContext?: Record<string, unknown>
): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  const stack =
    err instanceof Error ? err.stack?.split("\n").slice(0, 8).join("\n") : undefined;
  const pgCode =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : undefined;
  logger.error("api_http_error", {
    fallbackMessage,
    error: message,
    pgCode: pgCode || undefined,
    stack,
    ...logContext,
  });

  const entitlement = httpEntitlementError(err);
  if (entitlement) return entitlement;

  if (err instanceof OrganizationEnqueueError) {
    if (err.code === "org_lookup_failed") {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 403 }
    );
  }

  const code =
    pgCode ||
    (err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "");
  const lower = message.toLowerCase();

  if (code === "reauth_required" || lower.includes("reauthentication required")) {
    return NextResponse.json(
      { error: "Reauthentication required", code: "reauth_required" },
      { status: 401 }
    );
  }

  if (code === "mfa_required" || lower.includes("mfa required")) {
    return NextResponse.json(
      { error: "MFA required", code: "mfa_required" },
      { status: 401 }
    );
  }

  if (
    lower.includes("authentication required") ||
    lower.includes("not authenticated") ||
    lower.includes("unauthorized")
  ) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (lower.includes("admin access required")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (
    lower.includes("access denied") ||
    lower.includes("not found or access denied") ||
    lower.includes("forbidden")
  ) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Keep true resource-misses as 404, but never map org/queue gate failures
  // ("Organization not found") — those were breaking every module Run button.
  if (
    lower.includes("not found") &&
    !lower.includes("organization") &&
    !lower.includes("could not verify organization")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (lower.includes("too many") || lower.includes("rate limit")) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (
    code === "PGRST204" ||
    lower.includes("schema cache") ||
    (lower.includes("column") && lower.includes("does not exist")) ||
    lower.includes("violates check constraint") ||
    lower.includes("violates not-null constraint") ||
    lower.includes("null value in column") ||
    (lower.includes("does not exist") &&
      (lower.includes("function") || lower.includes("relation"))) ||
    lower.includes("invalid input syntax for type")
  ) {
    return NextResponse.json(
      {
        error:
          "Database schema is behind the application. Apply pending Supabase migrations and reload the PostgREST schema.",
        code: "schema_drift",
        detail: message.slice(0, 240),
      },
      { status: 503 }
    );
  }

  if (err instanceof Error && message && message.length < 240) {
    const userFacing =
      lower.includes("required") ||
      lower.includes("invalid") ||
      lower.includes("enable at least") ||
      lower.includes("upgrade required") ||
      lower.includes("plan limit") ||
      lower.includes("slug") ||
      /^[a-z_]+: /.test(message);
    if (userFacing) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
