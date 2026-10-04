#!/usr/bin/env npx tsx
/**
 * 10-turn dialogue smoke for the simple MCTB SMS agent (live LLM).
 *
 * Fixture mode (no DB):
 *   npx tsx scripts/mctb-simple-sms-agent-dialogue-smoke.ts
 *
 * Workspace knowledge from DB:
 *   WORKSPACE_ID=... npx tsx scripts/mctb-simple-sms-agent-dialogue-smoke.ts
 *
 * Requires DEEPSEEK_API_KEY or OPENAI API key (see mctb semantic LLM resolver).
 */
import Module from "node:module";

const originalLoad = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

const FIXTURE_KNOWLEDGE = `BUSINESS
Business name: Acme Plumbing & Drain

ABOUT THE BUSINESS
Family-owned plumbing company since 1998. Licensed and insured. We handle residential and light commercial jobs.

BUSINESS HOURS
Mon–Fri 8am–6pm, Sat 9am–2pm. Closed Sunday.
Website: https://acme-plumbing-example.com

SERVICES
Drain cleaning, Water heater repair, Leak detection, Emergency plumbing

SERVICE AREA / LOCATIONS
Fairfax County — We serve Fairfax, Arlington, and Alexandria, VA

Pricing: We provide quotes after describing the job — no flat rates by text.

EMERGENCY / URGENT DEFINITION (business-specific — not generic world knowledge)
Active flooding, gas smell, or no water in the whole home.

GROUNDING
Use only the business knowledge sections below as factual sources for business-specific answers and urgency/emergency classification.
Never invent services, service areas, prices, hours, policies, availability, or emergency handling contrary to the business definition.`;

const OPENER =
  "Hi, this is Acme Plumbing — sorry we missed your call. How can we help you today?";

type TurnSpec = {
  customer: string;
  expect: string;
  assert: (reply: string) => string | null;
};

const TURNS: TurnSpec[] = [
  {
    customer: "What do you guys do?",
    expect: "Answers from services/about — not intake for name",
    assert: (r) => {
      const low = r.toLowerCase();
      if (/\bwhat('s| is) your name\b/.test(low)) return "asked for name before answering";
      if (!/(plumb|drain|water|leak|repair|service)/.test(low)) {
        return "reply did not mention services/plumbing";
      }
      return null;
    },
  },
  {
    customer: "What are your hours?",
    expect: "Mentions hours or Mon–Fri schedule",
    assert: (r) => {
      const low = r.toLowerCase();
      if (/(mon|fri|8|6|hour|open|close)/.test(low)) return null;
      return "did not reflect business hours";
    },
  },
  {
    customer: "Do you guys work in Fairfax?",
    expect: "Service area — Fairfax / Northern VA",
    assert: (r) => {
      const low = r.toLowerCase();
      if (/(fairfax|arlington|alexandria|northern virginia|service area)/.test(low)) return null;
      return "did not address service area";
    },
  },
  {
    customer: "How much for a drain cleaning?",
    expect: "No invented flat price; quote or team follow-up",
    assert: (r) => {
      const low = r.toLowerCase();
      if (/\$\d+/.test(low) && !/(quote|estimate|follow up|team)/.test(low)) {
        return "invented dollar amount without quote disclaimer";
      }
      return null;
    },
  },
  {
    customer: "My kitchen sink is backing up pretty bad",
    expect: "Empathetic + helpful (not rigid form)",
    assert: (r) => {
      const low = r.toLowerCase();
      if (/\bwhat('s| is) your (name|address)\b/.test(low) && !/(sorry|help|drain|plumb|team)/.test(low)) {
        return "jumped to intake without acknowledging issue";
      }
      if (r.length < 20) return "reply too short to be helpful";
      return null;
    },
  },
  {
    customer: "Can someone come tomorrow afternoon?",
    expect: "Booking/scheduling help (link or team follow-up)",
    assert: (r) => {
      const low = r.toLowerCase();
      if (/(book|schedule|appointment|tomorrow|team|follow)/.test(low)) return null;
      return "did not address scheduling request";
    },
  },
  {
    customer: "Actually what was the website again?",
    expect: "Website from knowledge",
    assert: (r) => {
      if (r.includes("acme-plumbing-example.com")) return null;
      const low = r.toLowerCase();
      if (/website/.test(low) && /follow up/.test(low)) return null;
      return "did not share website from knowledge";
    },
  },
  {
    customer: "Are you open on Sunday?",
    expect: "Closed Sunday per hours",
    assert: (r) => {
      const low = r.toLowerCase();
      if (/(closed|sunday|not open)/.test(low)) return null;
      return "did not clarify Sunday hours";
    },
  },
  {
    customer: "Ok thanks that helps",
    expect: "Warm close / team follow-up",
    assert: (r) => {
      const low = r.toLowerCase();
      if (/(welcome|glad|anytime|here to help|follow up|reach out)/.test(low)) return null;
      if (r.length >= 15) return null;
      return "weak closing reply";
    },
  },
  {
    customer: "What's your name again? I mean the company",
    expect: "Business name",
    assert: (r) => {
      if (/acme/i.test(r)) return null;
      return "did not identify business name";
    },
  },
];

async function loadKnowledgeBlock(): Promise<string> {
  const workspaceId = process.env.WORKSPACE_ID?.trim();
  if (!workspaceId) return FIXTURE_KNOWLEDGE;

  const { loadMctbLeadRecoveryKnowledgeBundle } = await import(
    "../src/lib/mctb/lead-recovery/knowledge-prompt"
  );
  const bundle = await loadMctbLeadRecoveryKnowledgeBundle(workspaceId, {
    includeCollectPrompts: false,
  });
  if (bundle.runtime_prompt_block.trim().length < 80) {
    throw new Error(
      `Workspace ${workspaceId} knowledge block too short — add About/Services in AI Recovery settings`,
    );
  }
  return bundle.runtime_prompt_block;
}

async function main() {
  const { hydrateProdLlmEnvFromCoolify } = await import("./cloud-agent/hydrate-prod-llm-env");
  const { providers } = await import("../src/lib/ai/llm-providers");
  const { resolveMctbSemanticLlmProvider } = await import("../src/lib/mctb/semantic-llm");
  const { runMctbSimpleSmsAgentTurn } = await import(
    "../src/lib/mctb/ai-recovery/simple-sms-agent"
  );
  type MctbConversationTurn = import("../src/lib/mctb/conversation-thread").MctbConversationTurn;

  if (!providers().length) {
    hydrateProdLlmEnvFromCoolify();
  }

  if (process.env.OPENAI_API_KEY?.trim() && !process.env.OPENAI_MODEL?.trim()) {
    process.env.OPENAI_MODEL =
      process.env.MCTB_SMOKE_OPENAI_MODEL?.trim() || "gpt-4o-mini";
  }
  if (
    process.env.OPENAI_API_KEY?.trim() &&
    process.env.DEEPSEEK_API_KEY?.trim() &&
    !process.env.MCTB_SEMANTIC_LLM_PROVIDER?.trim()
  ) {
    process.env.MCTB_SEMANTIC_LLM_PROVIDER =
      process.env.MCTB_SMOKE_LLM_PROVIDER?.trim() || "openai";
  }

  const provider = resolveMctbSemanticLlmProvider();
  if (!providers().length) {
    throw new Error(
      "No LLM API key in this shell. Set DEEPSEEK_API_KEY or OPENAI_API_KEY, or run from Cloud Agent with Coolify SSH (auto-hydrate from production web).",
    );
  }

  const knowledge = await loadKnowledgeBlock();
  const bookingEnabled = process.env.SMOKE_BOOKING === "1";
  const bookingUrl = bookingEnabled ? "https://book.example.com/acme" : null;

  let thread: MctbConversationTurn[] = [{ role: "business", text: OPENER }];

  const failures: string[] = [];
  console.log(`\n=== MCTB simple SMS agent dialogue smoke (${TURNS.length} turns) ===`);
  console.log(`LLM provider: ${provider}`);
  console.log(`Knowledge chars: ${knowledge.length}`);
  console.log(`Booking in prompt: ${bookingEnabled}\n`);

  for (let i = 0; i < TURNS.length; i++) {
    const spec = TURNS[i];
    const turnNum = i + 1;
    process.stdout.write(`Turn ${turnNum} customer: ${spec.customer}\n`);

    const result = await runMctbSimpleSmsAgentTurn({
      customerMessage: spec.customer,
      thread,
      businessKnowledgeBlock: knowledge,
      timezone: "America/New_York",
      booking: bookingEnabled && bookingUrl
        ? { enabled: true, url: bookingUrl }
        : { enabled: false },
    });

    if (!result.handled || !result.reply?.trim()) {
      failures.push(`Turn ${turnNum}: agent returned no reply`);
      console.log("  FAIL: no reply\n");
      break;
    }

    if (turnNum === 1 && result.llmInvoked === false) {
      console.error(
        "\nLLM did not return a reply (provider error or empty model output).",
      );
      console.error(
        "Check DEEPSEEK_API_KEY / OPENAI_API_KEY (or hydrate from prod) and re-run:\n  npx tsx scripts/mctb-simple-sms-agent-dialogue-smoke.ts\n",
      );
      process.exit(2);
    }

    const err = spec.assert(result.reply);
    const status = err ? "FAIL" : "PASS";
    console.log(`  ${status} business: ${result.reply}`);
    console.log(`  expect: ${spec.expect}`);
    if (err) {
      failures.push(`Turn ${turnNum}: ${err}`);
      console.log(`  reason: ${err}`);
    }
    if (result.llmProvider) {
      console.log(`  llm: ${result.llmProvider}/${result.llmModel ?? "?"}`);
    }

    thread = [
      ...thread,
      { role: "customer", text: spec.customer },
      { role: "business", text: result.reply },
    ];
    console.log("");
  }

  console.log("=== Summary ===");
  if (failures.length) {
    console.log(`FAILED (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log(`All ${TURNS.length} turns passed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
