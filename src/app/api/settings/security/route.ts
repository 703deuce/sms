import { compare, hash } from "bcryptjs";
import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  buildOtpAuthUrl,
  consumeBackupCode,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateTotpSecret,
  verifyTotp,
} from "@/lib/auth/totp";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const user = await getPrisma().user.findUnique({ where: { id: auth.session.userId } });
    return NextResponse.json({
      data: {
        totpEnabled: Boolean(user?.totpEnabled),
        backupCodesRemaining: Array.isArray(user?.totpBackupCodes)
          ? user.totpBackupCodes.length
          : 0,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      action?: string;
      code?: string;
      password?: string;
    };
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: auth.session.userId } });
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    switch (body.action) {
      case "setup_2fa": {
        // Generate + persist a pending (not-yet-enabled) secret so the code the
        // user enters next can be verified against it.
        const secret = generateTotpSecret();
        await prisma.user.update({
          where: { id: user.id },
          data: { totpSecretEnc: encryptSecret(secret), totpEnabled: false },
        });
        const otpauthUrl = buildOtpAuthUrl(secret, user.email);
        const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
        return NextResponse.json({ data: { otpauthUrl, qrDataUrl, secret } });
      }

      case "enable_2fa": {
        const secret = decryptSecret(user.totpSecretEnc);
        if (!secret) {
          return NextResponse.json(
            { error: "Start 2FA setup before enabling" },
            { status: 400 },
          );
        }
        if (!body.code || !verifyTotp(body.code, secret)) {
          return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
        }
        const { codes, hashes } = generateBackupCodes();
        await prisma.user.update({
          where: { id: user.id },
          data: { totpEnabled: true, totpBackupCodes: hashes },
        });
        await prisma.auditLog.create({
          data: {
            workspaceId: auth.workspaceId,
            userId: user.id,
            event: "2fa_enabled",
            detail: "Two-factor authentication enabled",
          },
        });
        return NextResponse.json({ data: { enabled: true, backupCodes: codes } });
      }

      case "disable_2fa": {
        if (!user.passwordHash || !body.password || !(await compare(body.password, user.passwordHash))) {
          return NextResponse.json({ error: "Password is incorrect" }, { status: 401 });
        }
        const secret = decryptSecret(user.totpSecretEnc);
        const codeOk = secret ? verifyTotp(body.code || "", secret) : false;
        const backupCodes = Array.isArray(user.totpBackupCodes) ? user.totpBackupCodes : [];
        const backupOk = consumeBackupCode(body.code || "", backupCodes) !== null;
        if (user.totpEnabled && !codeOk && !backupOk) {
          return NextResponse.json(
            { error: "Invalid authentication code" },
            { status: 400 },
          );
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { totpEnabled: false, totpSecretEnc: null, totpBackupCodes: [] },
        });
        await prisma.auditLog.create({
          data: {
            workspaceId: auth.workspaceId,
            userId: user.id,
            event: "2fa_disabled",
            detail: "Two-factor authentication disabled",
          },
        });
        return NextResponse.json({ data: { enabled: false } });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json({ error: "currentPassword and newPassword required" }, { status: 400 });
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: auth.session.userId } });
    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Password not set for this account" }, { status: 400 });
    }

    const ok = await compare(body.currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const passwordHash = await hash(body.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: auth.workspaceId,
        userId: user.id,
        event: "password_changed",
        detail: "User changed password",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
