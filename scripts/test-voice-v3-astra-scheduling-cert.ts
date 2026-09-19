/**
 * Live Astra certification: set_scheduling_preference must emit correct SchedulingMeaning.
 * Requires OPENAI_API_KEY. Uses production tool schema + cross-tool instructions.
 */
import assert from "node:assert/strict";
import OpenAI from "openai";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3AstraFunctionTools } from "../src/lib/voice-v3/tools/build-openai-tools";
import {
  buildVoiceV3Prompts,
  resolveVoiceV3DefaultPromptInput,
} from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";
import { schedulingMeaningZodObject } from "../src/lib/voice-v3/time/scheduling-meaning-schema";
import type { SchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";

type Matcher = (m: SchedulingMeaning) => void;

type Scenario = {
  label: string;
  history: string;
  match: Matcher;
  forbiddenTools?: string[];
};

function expect(fields: Partial<SchedulingMeaning>): Matcher {
  return (m) => {
    for (const [key, expected] of Object.entries(fields)) {
      assert.equal(
        m[key as keyof SchedulingMeaning],
        expected,
        `field ${key}: expected ${String(expected)}, got ${String(m[key as keyof SchedulingMeaning])}`,
      );
    }
  };
}

const SCENARIOS: Scenario[] = [
  {
    label: "tuesday_afternoon",
    history: "Caller: Tuesday afternoon works for me.",
    match: expect({
      date_relation: "THIS_WEEKDAY",
      weekday: "TUESDAY",
      time_kind: "DAYPART",
      daypart: "AFTERNOON",
    }),
    forbiddenTools: ["find_availability", "update_intake"],
  },
  {
    label: "tomorrow_at_3",
    history: "Caller: Tomorrow at 3 would be great.",
    match: (m) => {
      assert.equal(m.date_relation, "TOMORROW");
      assert.equal(m.time_kind, "EXACT");
      const t = (m.exact_time ?? "").trim();
      assert.ok(
        t === "15:00" || t === "3:00" || t === "03:00 PM" || t.startsWith("15:") || t === "3:00 PM",
        `exact_time should be ~3pm local, got ${t}`,
      );
    },
    forbiddenTools: ["find_availability"],
  },
  {
    label: "next_wednesday_morning",
    history: "Caller: Next Wednesday morning if you have anything.",
    match: expect({
      date_relation: "NEXT_WEEKDAY",
      weekday: "WEDNESDAY",
      time_kind: "DAYPART",
      daypart: "MORNING",
    }),
    forbiddenTools: ["find_availability"],
  },
  {
    label: "after_3",
    history: "Caller: Any time after 3 on Friday.",
    match: (m) => {
      assert.equal(m.time_kind, "AFTER");
      assert.equal(m.weekday, "FRIDAY");
      const st = (m.start_time ?? "").trim();
      assert.ok(st.startsWith("15:") || st === "3:00" || st === "15:00", `start_time ~15:00, got ${st}`);
    },
    forbiddenTools: ["find_availability"],
  },
  {
    label: "before_noon",
    history: "Caller: Before noon tomorrow please.",
    match: (m) => {
      assert.equal(m.date_relation, "TOMORROW");
      assert.equal(m.time_kind, "BEFORE");
      const et = (m.end_time ?? "").trim();
      assert.ok(et.startsWith("12:") || et === "12:00", `end_time noon-ish, got ${et}`);
    },
    forbiddenTools: ["find_availability"],
  },
  {
    label: "between_2_and_5",
    history: "Caller: Between 2 and 5 on Tuesday.",
    match: (m) => {
      assert.equal(m.time_kind, "BETWEEN");
      assert.equal(m.weekday, "TUESDAY");
      const a = (m.start_time ?? "").trim();
      const b = (m.end_time ?? "").trim();
      assert.ok(a.startsWith("14:") || a === "2:00" || a === "14:00", `start ~14:00 got ${a}`);
      assert.ok(b.startsWith("17:") || b === "5:00" || b === "17:00", `end ~17:00 got ${b}`);
    },
    forbiddenTools: ["find_availability"],
  },
  {
    label: "explicit_date",
    history: "Caller: September 28 at 11 in the morning.",
    match: (m) => {
      assert.ok(
        m.date_relation === "EXPLICIT_DATE" || Boolean(m.explicit_date?.includes("2026-09-28") || m.explicit_date?.includes("09-28")),
        `explicit date expected, relation=${m.date_relation} explicit=${m.explicit_date}`,
      );
      assert.equal(m.time_kind, "EXACT");
      const t = (m.exact_time ?? "").trim();
      assert.ok(t.startsWith("11:") || t === "11:00", `exact_time ~11:00 got ${t}`);
    },
    forbiddenTools: ["find_availability"],
  },
  {
    label: "correction_wednesday",
    history:
      "Caller: I said Tuesday afternoon earlier but actually Wednesday morning is what I want.",
    match: expect({
      date_relation: "THIS_WEEKDAY",
      weekday: "WEDNESDAY",
      time_kind: "DAYPART",
      daypart: "MORNING",
    }),
    forbiddenTools: ["find_availability"],
  },
];

async function runScenario(client: OpenAI, astraInstructions: string, tools: OpenAI.Responses.Tool[], scenario: Scenario) {
  const response = await client.responses.create({
    model: process.env.VOICE_V3_ASTRA_MODEL?.trim() || "gpt-6-astra",
    instructions: astraInstructions,
    input: [{ role: "user", content: scenario.history }],
    tools,
    tool_choice: "auto",
    parallel_tool_calls: false,
  });

  const calls = (response.output ?? []).filter((o) => o.type === "function_call") as Array<{
    name?: string;
    arguments?: string;
  }>;

  assert.ok(calls.length >= 1, `${scenario.label}: expected at least one tool call`);
  const sched = calls.find((c) => c.name === "set_scheduling_preference");
  assert.ok(sched, `${scenario.label}: expected set_scheduling_preference, got ${calls.map((c) => c.name).join(",")}`);

  for (const forbidden of scenario.forbiddenTools ?? []) {
    assert.ok(
      !calls.some((c) => c.name === forbidden),
      `${scenario.label}: must not call ${forbidden} before preference is set`,
    );
  }

  const raw = JSON.parse(sched.arguments ?? "{}") as Record<string, unknown>;
  const parsed = schedulingMeaningZodObject.safeParse(raw);
  assert.ok(parsed.success, `${scenario.label}: invalid SchedulingMeaning ${JSON.stringify(parsed.success ? "" : parsed.error.issues)}`);

  scenario.match(parsed.data);
  console.log("ASTRA_SCHEDULING_MEANING_OK", {
    scenario: scenario.label,
    date_relation: parsed.data.date_relation,
    weekday: parsed.data.weekday,
    time_kind: parsed.data.time_kind,
    daypart: parsed.data.daypart,
    exact_time: parsed.data.exact_time,
    start_time: parsed.data.start_time,
    end_time: parsed.data.end_time,
    explicit_date: parsed.data.explicit_date,
  });
}

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("FAIL voice-v3 astra scheduling cert: OPENAI_API_KEY required");
    process.exit(1);
  }

  const client = new OpenAI();
  const tools = buildVoiceV3AstraFunctionTools(VOICE_V3_BOOKING_TEST_CONFIG).map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description ?? undefined,
    parameters: t.parameters ?? {},
    strict: t.strict ?? true,
  }));
  const { astraInstructions } = buildVoiceV3Prompts({
    ...resolveVoiceV3DefaultPromptInput(new Date("2026-09-19T12:00:00.000Z")),
    agentConfig: VOICE_V3_BOOKING_TEST_CONFIG,
  });

  for (const scenario of SCENARIOS) {
    await runScenario(client, astraInstructions, tools, scenario);
  }

  console.log("PASS voice-v3 astra scheduling cert (live)");
}

main().catch((err) => {
  console.error("FAIL voice-v3 astra scheduling cert", err);
  process.exit(1);
});
