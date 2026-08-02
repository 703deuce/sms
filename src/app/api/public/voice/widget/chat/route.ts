import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import * as ai from "@/lib/voice/telnyx/ai-client";
import { verifyWidgetSession } from "@/lib/voice/platform/widget-session";

/**
 * Public embeddable chat for AI assistants (widget).
 * Enforces widgetEnabled, domain allowlist, session token, and rate limit.
 */
const hits = new Map<string, { count: number; windowStart: number }>();

function rateOk(key: string, limit: number) {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || now - row.windowStart > 60_000) {
    hits.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      agentId?: string;
      message?: string;
      origin?: string;
      sessionToken?: string;
      captchaToken?: string;
    };
    let agentId = String(body.agentId || "");
    const message = String(body.message || "").trim();
    const sessionToken =
      body.sessionToken || request.headers.get("x-widget-session") || "";
    if (sessionToken) {
      const session = verifyWidgetSession(sessionToken);
      if (!session) {
        return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
      }
      agentId = String(session.agentId || agentId);
    }
    if (!agentId || !message) {
      return NextResponse.json({ error: "agentId and message required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: agentId },
    });
    if (!agent?.widgetEnabled || agent.emergencyDisabled) {
      return NextResponse.json({ error: "Widget unavailable" }, { status: 403 });
    }
    if (!agent.telnyxAssistantId) {
      return NextResponse.json({ error: "Agent not published" }, { status: 400 });
    }

    const cfg = await prisma.voiceWidgetConfig.findFirst({
      where: { agentId, workspaceId: agent.workspaceId, status: { in: ["active", "draft"] } },
    });
    if (!cfg) {
      return NextResponse.json({ error: "Widget not configured" }, { status: 403 });
    }
    // Outside test mode, chat requires a short-lived widget session token.
    if (!sessionToken && !cfg.testMode) {
      return NextResponse.json({ error: "Session required" }, { status: 401 });
    }

    const originHeader =
      request.headers.get("origin") ||
      request.headers.get("referer") ||
      body.origin ||
      "";
    const allowlist = Array.isArray(cfg.domainAllowlist)
      ? (cfg.domainAllowlist as string[])
      : [];
    if (allowlist.length) {
      let host = "";
      try {
        host = new URL(originHeader).hostname;
      } catch {
        host = originHeader.replace(/^https?:\/\//, "").split("/")[0] || "";
      }
      const ok = allowlist.some(
        (d) => host === d || host.endsWith(`.${d}`) || originHeader.includes(d),
      );
      if (!ok && !cfg.testMode) {
        return NextResponse.json({ error: "Origin not allowlisted" }, { status: 403 });
      }
    }

    if (!rateOk(`widget:${agentId}`, cfg.rateLimitPerMin || 30)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // CAPTCHA: when enabled outside test mode, require a captchaToken (verified by upstream later).
    if (cfg.captchaEnabled && !cfg.testMode) {
      const captchaToken = String(
        (body as { captchaToken?: string }).captchaToken ||
          request.headers.get("x-captcha-token") ||
          "",
      );
      if (!captchaToken) {
        return NextResponse.json(
          { error: "CAPTCHA required", code: "captcha_required" },
          { status: 403 },
        );
      }
    }

    if (!ai.isTelnyxAiConfigured()) {
      return NextResponse.json({
        data: {
          mode: "mock",
          reply: "Thanks for your message. (Widget mock — Telnyx not configured.)",
        },
      });
    }

    const remote = await ai.chatAssistant(agent.telnyxAssistantId, {
      messages: [{ role: "user", content: message.slice(0, 4000) }],
    });
    return NextResponse.json({ data: remote });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Widget chat failed" },
      { status: 500 },
    );
  }
}
