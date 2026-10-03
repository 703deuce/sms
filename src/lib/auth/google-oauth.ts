import { getIntegrationAppUrl } from "@/lib/integrations/framework/app-url";
import { createHmac, randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { getPrisma } from "@/lib/db";
import { getUserProductAccess, grantProductEntitlement } from "@/lib/products/entitlements";
import { resolveAuthenticatedWorkspace } from "@/lib/auth/resolve-session-workspace";
import { updateProductIntent } from "@/lib/products/session";
import type { ProductKey } from "@/lib/products/types";
import type { WorkspaceType } from "@/lib/workspace/types";
import { createWorkspaceForUser } from "@/lib/workspace/create-workspace";

const GOOGLE_AUTH_SCOPES = ["openid", "email", "profile"].join(" ");

function appUrl() {
  return getIntegrationAppUrl();
}

function secret() {
  return process.env.INTEGRATION_SECRET_KEY?.trim() || "transovo-dev-oauth";
}

function googleClientId() {
  return (
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() ||
    ""
  );
}

function googleClientSecret() {
  return (
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() ||
    ""
  );
}

export function googleAuthRedirectUri() {
  return `${appUrl()}/api/auth/google/callback`;
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(googleClientId() && googleClientSecret());
}

export type GoogleAuthState = {
  nonce: string;
  nextPath: string;
  reservationId?: string;
};

function encodeStatePayload(input: GoogleAuthState): string {
  const reservation = input.reservationId?.trim() || "";
  return `${input.nonce}:${encodeURIComponent(input.nextPath)}:${encodeURIComponent(reservation)}`;
}

function decodeStatePayload(payload: string): GoogleAuthState | null {
  const parts = payload.split(":");
  if (parts.length < 2) return null;
  const [nonce, encodedNext, encodedReservation] = parts;
  if (!nonce || !encodedNext) return null;
  try {
    return {
      nonce,
      nextPath: decodeURIComponent(encodedNext),
      reservationId: encodedReservation ? decodeURIComponent(encodedReservation) : undefined,
    };
  } catch {
    return null;
  }
}

export function makeGoogleAuthState(input: { nextPath?: string; reservationId?: string }): string {
  const nonce = randomBytes(16).toString("hex");
  const nextPath = sanitizeNextPath(input.nextPath);
  const payload = encodeStatePayload({
    nonce,
    nextPath,
    reservationId: input.reservationId,
  });
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

export function parseGoogleAuthState(state: string): GoogleAuthState | null {
  const lastColon = state.lastIndexOf(":");
  if (lastColon <= 0) return null;
  const payload = state.slice(0, lastColon);
  const sig = state.slice(lastColon + 1);
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  if (sig !== expected) return null;
  return decodeStatePayload(payload);
}

export function sanitizeNextPath(nextPath?: string | null): string {
  const raw = (nextPath || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return "/app";
  }
  return raw;
}

export function getGoogleAuthStartUrl(input: { nextPath?: string; reservationId?: string }) {
  const clientId = googleClientId();
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleAuthRedirectUri(),
    response_type: "code",
    scope: GOOGLE_AUTH_SCOPES,
    access_type: "online",
    prompt: "select_account",
    state: makeGoogleAuthState(input),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
};

export async function exchangeGoogleAuthCode(code: string): Promise<GoogleProfile> {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleAuthRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokens.access_token) {
    throw new Error(tokens.error_description || tokens.error || "Google token exchange failed");
  }

  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await profileRes.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  };
  if (!profileRes.ok || !profile.sub || !profile.email) {
    throw new Error("Could not load Google profile");
  }

  return {
    sub: profile.sub,
    email: profile.email.trim().toLowerCase(),
    name: (profile.name || profile.email.split("@")[0] || "Transovo user").trim(),
    picture: profile.picture,
    emailVerified: profile.email_verified !== false,
  };
}

export type GoogleAuthUserResult = {
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
  workspaceType: WorkspaceType;
  created: boolean;
};

export async function findOrCreateUserFromGoogle(profile: GoogleProfile): Promise<GoogleAuthUserResult> {
  const prisma = getPrisma();
  const email = profile.email.trim().toLowerCase();

  let user = await prisma.user.findUnique({ where: { email } });
  let created = false;

  if (!user) {
    const passwordHash = await hash(`google-oauth:${profile.sub}:${randomBytes(8).toString("hex")}`, 10);
    user = await prisma.user.create({
      data: {
        email,
        name: profile.name,
        passwordHash,
        isPlatformAdmin: false,
      },
    });
    created = true;
  } else if (user.name !== profile.name && profile.name) {
    await prisma.user.update({ where: { id: user.id }, data: { name: profile.name } });
  }

  const resolveExistingUserWorkspace = async (): Promise<GoogleAuthUserResult> => {
    const access = await getUserProductAccess(user.id);
    const preferred: ProductKey =
      access.hasNumbers && !access.hasVoice
        ? "numbers"
        : access.hasVoice
          ? "voice"
          : access.hasNumbers
            ? "numbers"
            : "voice";
    const resolved = await resolveAuthenticatedWorkspace(user.id, preferred);
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      workspaceId: resolved.workspaceId,
      workspaceType: resolved.workspaceType,
      created,
    };
  };

  // Returning Google login: same email must never spawn another workspace.
  if (!created) {
    return resolveExistingUserWorkspace();
  }

  const membershipCount = await prisma.membership.count({ where: { userId: user.id } });
  if (membershipCount > 0) {
    return resolveExistingUserWorkspace();
  }

  // First-time Google signup: one user row, one initial workspace.
  const workspace = await createWorkspaceForUser(user.id, "Personal", "PERSONAL");
  await grantProductEntitlement(workspace.id, "numbers");
  await updateProductIntent(user.id, "numbers");

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    workspaceId: workspace.id,
    workspaceType: "PERSONAL",
    created: true,
  };
}
