import { createHash, randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { BRAND_NAME } from "@/lib/brand";

export type InviteRole =
  | "OWNER"
  | "ADMINISTRATOR"
  | "MANAGER"
  | "CAMPAIGN_CREATOR"
  | "INBOX_AGENT"
  | "ANALYST"
  | "READ_ONLY";

const INVITE_TTL_DAYS = 14;

export function appUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

/** Hash the raw invite token before storage (never store the raw token). */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteUrl(token: string): string {
  return `${appUrl()}/invite/${token}`;
}

export type PendingInvite = {
  id: string;
  email: string;
  role: string;
  invitedByName: string | null;
  expiresAt: string;
  createdAt: string;
};

export async function loadPendingInvites(workspaceId: string): Promise<PendingInvite[]> {
  const prisma = getPrisma();
  const rows = await prisma.workspaceInvite.findMany({
    where: { workspaceId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
    include: { invitedBy: { select: { name: true } } },
  });
  const now = Date.now();
  return (rows as Array<{
    id: string;
    email: string;
    role: string;
    expiresAt: Date;
    createdAt: Date;
    invitedBy: { name: string } | null;
  }>)
    .filter((r) => new Date(r.expiresAt).getTime() > now)
    .map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      invitedByName: r.invitedBy?.name ?? null,
      expiresAt: new Date(r.expiresAt).toISOString(),
      createdAt: new Date(r.createdAt).toISOString(),
    }));
}

export async function createWorkspaceInvite(input: {
  workspaceId: string;
  email: string;
  role: InviteRole;
  invitedById?: string | null;
  workspaceName?: string;
}) {
  const prisma = getPrisma();
  const email = input.email.trim().toLowerCase();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Replace any existing (unique on workspaceId+email) invite so re-inviting
  // rotates the token instead of failing.
  const existing = await prisma.workspaceInvite.findUnique({
    where: { workspaceId_email: { workspaceId: input.workspaceId, email } },
  });

  let invite;
  if (existing) {
    invite = await prisma.workspaceInvite.update({
      where: { id: existing.id },
      data: {
        role: input.role,
        tokenHash,
        invitedById: input.invitedById ?? null,
        expiresAt,
        acceptedAt: null,
      },
    });
  } else {
    invite = await prisma.workspaceInvite.create({
      data: {
        workspaceId: input.workspaceId,
        email,
        role: input.role,
        tokenHash,
        invitedById: input.invitedById ?? null,
        expiresAt,
      },
    });
  }

  const url = inviteUrl(token);
  const workspaceName = input.workspaceName || BRAND_NAME;
  const subject = `You're invited to ${workspaceName} on ${BRAND_NAME}`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto">
      <h2 style="margin:0 0 12px">Join ${workspaceName}</h2>
      <p>You've been invited to collaborate on ${workspaceName} in ${BRAND_NAME}.</p>
      <p style="margin:24px 0">
        <a href="${url}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Accept invitation</a>
      </p>
      <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br>${url}</p>
      <p style="color:#94a3b8;font-size:12px">This invitation expires in ${INVITE_TTL_DAYS} days.</p>
    </div>`;

  const result = await sendTransactionalEmail({
    to: email,
    subject,
    htmlContent: html,
    textContent: `You're invited to ${workspaceName}. Accept: ${url}`,
  });

  if (result.provider === "stub" || result.status === "failed") {
    // No email provider configured (or send failed) — surface the link for dev.
    console.log(`[team/invite] Invite for ${email}: ${url}`);
  }

  return { invite, token, url, emailStatus: result.status, emailProvider: result.provider };
}

export async function getInviteByToken(token: string) {
  const prisma = getPrisma();
  const tokenHash = hashInviteToken(token);
  const invite = await prisma.workspaceInvite.findUnique({ where: { tokenHash } });
  if (!invite) return { status: "not_found" as const };
  if (invite.acceptedAt) return { status: "accepted" as const, invite };
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return { status: "expired" as const, invite };
  }
  const workspace = await prisma.workspace.findUnique({
    where: { id: invite.workspaceId },
    select: { id: true, name: true, displayName: true },
  });
  return { status: "valid" as const, invite, workspace };
}

export async function cancelInvite(workspaceId: string, inviteId: string) {
  const prisma = getPrisma();
  const invite = await prisma.workspaceInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.workspaceId !== workspaceId) {
    return { ok: false as const, error: "Not found" };
  }
  await prisma.workspaceInvite.delete({ where: { id: inviteId } });
  return { ok: true as const };
}
