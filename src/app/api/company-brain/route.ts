/**
 * Workspace-level Company Brain API — shared facts before any agent is hired.
 */

import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  loadBusinessBrain,
  saveBusinessBrainPartial,
} from "@/lib/agents/appointment-booking/business-brain";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const brain = await loadBusinessBrain(auth.workspaceId);
    return NextResponse.json({ data: brain });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      brain?: Record<string, unknown>;
      facts?: Array<{
        label: string;
        summary: string;
        status?: string;
        source?: string;
      }>;
      websiteUrl?: string;
    };

    const action = String(body.action || "save").trim();

    if (action === "save") {
      const brain = await saveBusinessBrainPartial(
        auth.workspaceId,
        (body.brain || {}) as Parameters<typeof saveBusinessBrainPartial>[1],
      );
      await getPrisma().auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          userId: auth.session.userId,
          event: "company_brain.saved",
          detail: "Shared business brain updated",
        },
      });
      return NextResponse.json({ data: brain });
    }

    if (action === "upsert_facts") {
      const current = await loadBusinessBrain(auth.workspaceId);
      const incoming = Array.isArray(body.facts) ? body.facts : [];
      const byLabel = new Map(
        current.knowledgeFacts.map((f) => [f.label.toLowerCase(), f]),
      );
      for (const fact of incoming) {
        const label = String(fact.label || "").trim();
        const summary = String(fact.summary || "").trim();
        if (!label || !summary) continue;
        byLabel.set(label.toLowerCase(), {
          label,
          summary,
          status: fact.status || "extracted",
        });
      }
      const brain = await saveBusinessBrainPartial(auth.workspaceId, {
        knowledgeFacts: [...byLabel.values()],
        ...(body.websiteUrl
          ? { website: String(body.websiteUrl) }
          : {}),
      });
      return NextResponse.json({ data: brain });
    }

    if (action === "approve_facts") {
      const current = await loadBusinessBrain(auth.workspaceId);
      const labels = new Set(
        (Array.isArray(body.facts) ? body.facts : []).map((f) =>
          String(f.label || "").toLowerCase(),
        ),
      );
      const approveAll = labels.size === 0;
      const knowledgeFacts = current.knowledgeFacts.map((f) => {
        if (
          approveAll ||
          labels.has(f.label.toLowerCase()) ||
          ["extracted", "pending_review", "pending"].includes(
            String(f.status || "").toLowerCase(),
          )
        ) {
          if (
            approveAll &&
            !["extracted", "pending_review", "pending", "owner_approved", "complete"].includes(
              String(f.status || "").toLowerCase(),
            )
          ) {
            return f;
          }
          return { ...f, status: "owner_approved" };
        }
        return f;
      });
      const brain = await saveBusinessBrainPartial(auth.workspaceId, {
        knowledgeFacts,
      });
      await getPrisma().auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          userId: auth.session.userId,
          event: "company_brain.facts_approved",
          detail: `count=${knowledgeFacts.filter((f) => f.status === "owner_approved").length}`,
        },
      });
      return NextResponse.json({ data: brain });
    }

    if (action === "extract_from_text") {
      const text = String(
        (body.brain as { conversationText?: string } | undefined)?.conversationText ||
          body.websiteUrl ||
          "",
      ).trim();
      if (!text) throw new Error("Provide business description text");
      const facts = extractFactsFromConversation(text);
      const current = await loadBusinessBrain(auth.workspaceId);
      const byLabel = new Map(
        current.knowledgeFacts.map((f) => [f.label.toLowerCase(), f]),
      );
      for (const f of facts) {
        byLabel.set(f.label.toLowerCase(), f);
      }
      const patch: Record<string, unknown> = {
        knowledgeFacts: [...byLabel.values()],
      };
      const nameFact = facts.find((f) => f.label === "Business name");
      if (nameFact) patch.businessName = nameFact.summary;
      const brain = await saveBusinessBrainPartial(
        auth.workspaceId,
        patch as Parameters<typeof saveBusinessBrainPartial>[1],
      );
      return NextResponse.json({ data: { brain, extracted: facts } });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    return jsonError(err, 400);
  }
}

function extractFactsFromConversation(text: string): Array<{
  label: string;
  summary: string;
  status: string;
}> {
  const facts: Array<{ label: string; summary: string; status: string }> = [];
  const lower = text.toLowerCase();

  const biz =
    text.match(
      /(?:we(?:'re| are)|i(?:'m| am)|company is)\s+(?:a |an )?([^.]+?)(?:\s+in\s+|\.|$)/i,
    ) || text.match(/plumbing|hvac|dental|salon|clinic|law|real estate/i);
  if (biz) {
    facts.push({
      label: "Business description",
      summary: String(biz[0] || biz[1] || text).slice(0, 200),
      status: "extracted",
    });
  }

  const loc = text.match(
    /(?:in|serving|located in)\s+([A-Z][a-zA-Z\s]+?)(?:\.|,| from| we|$)/,
  );
  if (loc) {
    facts.push({
      label: "Main location",
      summary: loc[1].trim(),
      status: "extracted",
    });
  }

  const hours = text.match(
    /(?:open|hours?)[^.]*?(monday|mon)[^.]*?(\d{1,2})\s*(?:am|pm)?[^.]*?(\d{1,2})\s*(?:am|pm)?[^.]*?(friday|fri)?[^.!]{0,40}/i,
  );
  if (hours || /monday through friday|mon(?:day)?[-–]fri/i.test(lower)) {
    facts.push({
      label: "Business hours",
      summary: hours
        ? hours[0].trim()
        : "Monday through Friday (details in conversation)",
      status: "extracted",
    });
  }

  const services: string[] = [];
  for (const s of [
    "drain cleaning",
    "water heater",
    "emergency plumbing",
    "hvac",
    "consultation",
  ]) {
    if (lower.includes(s)) services.push(s);
  }
  if (services.length || /\bwe do\b|\bwe offer\b/i.test(text)) {
    const fromDo = text.match(
      /(?:we do|we offer|services?(?: include)?)\s+([^.]+)/i,
    );
    facts.push({
      label: "Services",
      summary: fromDo?.[1]?.trim() || services.join(", ") || "See conversation",
      status: "extracted",
    });
  }

  if (!facts.length) {
    facts.push({
      label: "Owner notes",
      summary: text.slice(0, 400),
      status: "extracted",
    });
  }

  return facts.map((f) => ({ ...f, status: "extracted" }));
}
