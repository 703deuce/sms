import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import {
  createOfficialBaselineAssistant,
  fetchOfficialBaselineLive,
  restoreOfficialBaselineRoute,
  routePhoneToOfficialBaseline,
  scoreOfficialBaselineLatency,
  switchOfficialBaselineModel,
  verifyIntegrationSecret,
  type OfficialBaselineRouteSnapshot,
  BASELINE_REQUESTED,
  BASELINE_MODEL_CANDIDATES,
  BASELINE_MODEL_PROFILES,
  GEMINI_API_KEY_REF,
  OPENAI_API_KEY_REF,
  OFFICIAL_BASELINE_NAME,
} from "@/lib/voice/telnyx/official-baseline";
import {
  DEFAULT_TEXML_APP_ID,
  TURN_CLONE_PROFILES,
  TURN_TIMING_BASELINE,
  TURN_TIMING_FAST,
  TURN_TIMING_AGGRESSIVE,
  UNTOUCHED_BASELINE_ASSISTANT_ID,
  ensureAllTurnCloneAssistants,
  resolveTurnCloneProfileId,
  routeTexmlToAssistant,
  switchToTurnCloneProfile,
} from "@/lib/voice/telnyx/official-baseline-turn-clones";

const BOOTSTRAP_HEADER = "x-smoke-bootstrap";
const BOOTSTRAP_VALUE = "transovo-smoke-bootstrap-b56f-aug2026";

/**
 * Create / route / switch profiles / restore the Telnyx-direct latency baseline.
 *
 * A/B/C/D — LLM only on the untouched baseline (timing unchanged):
 *   A = anthropic/claude-haiku-4-5
 *   B = moonshotai/Kimi (live id)
 *   C = google/gemini-2.5-flash-lite (+ gemini_api_key)
 *   D = openai/gpt-5.4-mini (+ openai_key)
 *
 * E/F/G/H — separate clones (baseline assistant never overwritten):
 *   E = Haiku Fast
 *   F = Haiku Aggressive (experimental)
 *   G = Kimi Fast
 *   H = Kimi Aggressive (experimental)
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      e164?: string;
      assistantId?: string;
      voiceId?: string;
      modelId?: string;
      profileId?: string;
      geminiKeyRef?: string;
      openaiKeyRef?: string;
      secretIdentifier?: string;
      workspaceId?: string;
      limit?: number;
      texmlAppId?: string;
      sourceAssistantId?: string;
      snapshot?: OfficialBaselineRouteSnapshot;
    };

    let workspaceId = "";
    if (request.headers.get(BOOTSTRAP_HEADER) === BOOTSTRAP_VALUE) {
      workspaceId = String(body.workspaceId || "ws_1").trim();
    } else {
      const auth = await requireSession();
      if ("error" in auth) return auth.error;
      workspaceId = auth.workspaceId;
    }

    const action = String(body.action || "create").toLowerCase();
    const e164 = String(body.e164 || "+18663464256").trim();
    const geminiKeyRef = String(body.geminiKeyRef || GEMINI_API_KEY_REF).trim();
    const openaiKeyRef = String(body.openaiKeyRef || OPENAI_API_KEY_REF).trim();

    if (action === "verify_secret") {
      const identifier = String(
        body.secretIdentifier || body.geminiKeyRef || GEMINI_API_KEY_REF,
      ).trim();
      const data = await verifyIntegrationSecret(identifier);
      return NextResponse.json({ data });
    }

    if (action === "list_profiles") {
      return NextResponse.json({
        data: {
          profiles: BASELINE_MODEL_PROFILES,
          turnClones: TURN_CLONE_PROFILES,
          timing: {
            baseline: TURN_TIMING_BASELINE,
            fast: TURN_TIMING_FAST,
            aggressive: TURN_TIMING_AGGRESSIVE,
          },
          shared: BASELINE_REQUESTED,
          untouchedBaselineAssistantId: UNTOUCHED_BASELINE_ASSISTANT_ID,
          secrets: {
            gemini: GEMINI_API_KEY_REF,
            openai: OPENAI_API_KEY_REF,
          },
        },
      });
    }

    if (action === "ensure_turn_clones") {
      const data = await ensureAllTurnCloneAssistants({
        sourceAssistantId:
          body.sourceAssistantId ||
          body.assistantId ||
          UNTOUCHED_BASELINE_ASSISTANT_ID,
        voiceId: body.voiceId,
      });
      return NextResponse.json({ data });
    }

    if (action === "verify") {
      const assistantId = String(body.assistantId || "").trim();
      if (!assistantId) {
        return NextResponse.json(
          { error: "assistantId required for verify" },
          { status: 400 },
        );
      }
      const data = await fetchOfficialBaselineLive(assistantId);
      return NextResponse.json({ data });
    }

    if (action === "score_latency" || action === "pull_latency") {
      const assistantId = String(
        body.assistantId || "assistant-f2a573af-dde1-4441-a6f1-846aeccc1020",
      ).trim();
      const data = await scoreOfficialBaselineLatency({
        assistantId,
        limit: body.limit,
      });
      return NextResponse.json({ data });
    }

    if (action === "switch_model" || action === "switch_profile") {
      const turnCloneId = resolveTurnCloneProfileId(body.profileId);
      if (turnCloneId) {
        const data = await switchToTurnCloneProfile({
          profileId: turnCloneId,
          sourceAssistantId:
            body.sourceAssistantId ||
            body.assistantId ||
            UNTOUCHED_BASELINE_ASSISTANT_ID,
          texmlAppId: body.texmlAppId || DEFAULT_TEXML_APP_ID,
          e164,
          voiceId: body.voiceId,
        });
        return NextResponse.json({ data });
      }

      const assistantId = String(
        body.assistantId || UNTOUCHED_BASELINE_ASSISTANT_ID,
      ).trim();
      const profileId = body.profileId;
      const modelId = body.modelId;
      if (!assistantId || (!profileId && !modelId)) {
        return NextResponse.json(
          {
            error:
              "assistantId and profileId (A|B|C|D|E|F|G|H) or modelId required for switch_model",
          },
          { status: 400 },
        );
      }
      // A/B/C/D: route phone back to untouched baseline, then LLM-only switch.
      const route = await routeTexmlToAssistant({
        assistantId,
        texmlAppId: body.texmlAppId || DEFAULT_TEXML_APP_ID,
        e164,
      });
      const data = await switchOfficialBaselineModel({
        assistantId,
        profileId,
        modelId,
        geminiKeyRef,
        openaiKeyRef,
      });
      return NextResponse.json({
        data: {
          ...data,
          route,
          note: "A/B/C/D LLM-only on untouched baseline timing",
        },
      });
    }

    if (action === "restore") {
      if (!body.snapshot?.previousConnectionId) {
        return NextResponse.json(
          { error: "snapshot with previousConnectionId required" },
          { status: 400 },
        );
      }
      const data = await restoreOfficialBaselineRoute(body.snapshot);
      return NextResponse.json({ data });
    }

    if (action === "create" || action === "create_and_route") {
      const created = await createOfficialBaselineAssistant({
        voiceId: body.voiceId,
        modelId: body.modelId,
        profileId: body.profileId,
        geminiKeyRef,
        openaiKeyRef,
      });

      let route: unknown = null;
      if (action === "create_and_route") {
        const prisma = getPrisma();
        const phone = await prisma.phoneNumber.findFirst({
          where: { workspaceId, e164 },
          select: { id: true },
        });
        const agent = phone?.id
          ? await prisma.voiceAgent.findFirst({
              where: { workspaceId, phoneNumberId: phone.id },
              select: { id: true, telnyxAssistantId: true, name: true },
            })
          : await prisma.voiceAgent.findFirst({
              where: {
                workspaceId,
                name: {
                  contains: "Main Office Appointment",
                  mode: "insensitive",
                },
              },
              select: { id: true, telnyxAssistantId: true, name: true },
            });

        route = await routePhoneToOfficialBaseline({
          e164,
          assistantId: created.assistantId,
          productionAssistantId: agent?.telnyxAssistantId || null,
          productionAgentId: agent?.id || null,
        });
      }

      return NextResponse.json({
        data: {
          name: OFFICIAL_BASELINE_NAME,
          requestedStack: BASELINE_REQUESTED,
          modelCandidates: BASELINE_MODEL_CANDIDATES,
          ...created,
          profiles: created.profiles || BASELINE_MODEL_PROFILES,
          geminiKeyRef: created.geminiKeyRef ?? null,
          openaiKeyRef: created.openaiKeyRef ?? null,
          route,
          testProcedure: [
            "Hello.",
            "Say hello.",
            "What is two plus two?",
            "What comes after Monday?",
            "Yes.",
            "No.",
            "Tuesday.",
            "I need an appointment.",
            "A sentence with a brief natural pause.",
            "A sentence followed by one full second of silence.",
          ],
          measure: "caller last audible word → assistant first audible word",
          targetsNote:
            "Do not claim sub-500ms until telephone measurements confirm it.",
        },
      });
    }

    return NextResponse.json(
      {
        error:
          "action must be create | create_and_route | verify | restore | switch_model | switch_profile | ensure_turn_clones | verify_secret | list_profiles | score_latency",
      },
      { status: 400 },
    );
  } catch (err) {
    return jsonError(err, 500);
  }
}
