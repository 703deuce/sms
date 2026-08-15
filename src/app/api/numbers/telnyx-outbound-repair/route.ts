import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  diagnoseTelnyxOutboundVoice,
  ensureTelnyxOutboundVoiceReady,
  testTelnyxOutboundDial,
} from "@/lib/phone/telnyx-outbound-voice";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const BOOTSTRAP_HEADER = "x-smoke-bootstrap";
const BOOTSTRAP_VALUE = "transovo-smoke-bootstrap-b56f-aug2026";

/**
 * Diagnose / repair Telnyx Outbound Voice Profile attachment for AI transfers.
 *
 * Auth: session cookie, or smoke bootstrap header.
 * Body: {
 *   e164?: "+1...",
 *   repair?: boolean,
 *   testOutbound?: boolean,
 *   to?: "+1...",          // required when testOutbound
 *   workspaceId?: string,
 *   connectionId?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      e164?: string;
      repair?: boolean;
      testOutbound?: boolean;
      to?: string;
      workspaceId?: string;
      connectionId?: string;
    };

    let workspaceId = "";
    if (request.headers.get(BOOTSTRAP_HEADER) === BOOTSTRAP_VALUE) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Bootstrap repair disabled in production" }, { status: 403 });
      }
      workspaceId = String(body.workspaceId || "").trim();
      if (!workspaceId) {
        return NextResponse.json({ error: "workspaceId required for bootstrap repair" }, { status: 400 });
      }
    } else {
      const auth = await requireSession();
      if ("error" in auth) return auth.error;
      workspaceId = auth.workspaceId;
    }

    const e164 = body.e164 ? normalizeE164(String(body.e164)) : "";
    let callerId = e164;
    if (!callerId) {
      const row = await getPrisma().phoneNumber.findFirst({
        where: { workspaceId, status: "Active", releasedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { e164: true },
      });
      callerId = row?.e164 || "";
    }

    if (body.testOutbound) {
      const to = body.to ? normalizeE164(String(body.to)) : "";
      if (!to) {
        return NextResponse.json(
          { error: "to (E.164) required when testOutbound is true" },
          { status: 400 },
        );
      }
      if (!callerId) {
        return NextResponse.json(
          { error: "e164 source caller ID required for outbound test" },
          { status: 400 },
        );
      }
      const test = await testTelnyxOutboundDial({
        fromE164: callerId,
        toE164: to,
        connectionId: body.connectionId,
        workspaceId,
      });
      return NextResponse.json({ data: { test } });
    }

    const outbound = body.repair
      ? await ensureTelnyxOutboundVoiceReady({
          connectionId: body.connectionId,
          callerIdE164: callerId || null,
        })
      : await diagnoseTelnyxOutboundVoice({
          connectionId: body.connectionId,
          callerIdE164: callerId || null,
        });

    return NextResponse.json({
      data: {
        outbound,
        callerIdE164: callerId || null,
        workspaceId,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
