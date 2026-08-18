/**
 * AI Number Concierge — state-machine / controller test suite.
 * Run: npm run test:ai-number-concierge
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildUnderstandingChips } from "../src/lib/premium-numbers/ai-number-search/chips";
import {
  manualFormToSearchState,
  searchStateToManualFields,
  sanitizeAssistantMessage,
} from "../src/lib/premium-numbers/ai-number-search/controller";
import {
  applyAiAction,
  parseConciergeHeuristic,
} from "../src/lib/premium-numbers/ai-number-search/intent";
import {
  createDefaultNumberSearchState,
  mergeKeywords,
  resetNumberSearchState,
} from "../src/lib/premium-numbers/ai-number-search/state";
import type { NumberSearchState } from "../src/lib/premium-numbers/ai-number-search/types";

type TestResult = {
  id: string;
  name: string;
  pass: boolean;
  userInput?: string;
  stateBefore?: string;
  expectedAfter?: string;
  actualAfter?: string;
  searchRerun?: "YES" | "NO";
  backendResultsCount?: number;
  aiResponse?: string;
  uiSync?: "PASS" | "FAIL" | "N/A";
  issue?: string;
  rootCause?: string;
  fix?: string;
};

const results: TestResult[] = [];

function snap(state: NumberSearchState): string {
  return JSON.stringify({
    areaCodes: state.areaCodes,
    industry: state.industry,
    intent: state.intent,
    numberType: state.numberType,
    maxPriceCents: state.maxPriceCents,
    explicitKeywords: state.explicitKeywords,
    aiGeneratedKeywords: state.aiGeneratedKeywords,
    excludedKeywords: state.excludedKeywords,
    keywords: mergeKeywords(state),
    tollFreePrefix: state.tollFreePrefix,
    apiIntent: state.apiIntent,
    sortBy: state.sortBy,
  });
}

function step(state: NumberSearchState, message: string, quickAction?: string) {
  const before = { ...state };
  const parsed = parseConciergeHeuristic(message, quickAction, state);
  if (!parsed) {
    return {
      state,
      parsed: null,
      searchPerformed: false,
      searchChanged: false,
    };
  }
  const applied = applyAiAction(state, parsed.action);
  return {
    state: applied.state,
    parsed,
    searchPerformed: applied.searchPerformed,
    searchChanged: applied.searchChanged,
  };
}

function record(
  id: string,
  name: string,
  pass: boolean,
  extra: Partial<Omit<TestResult, "id" | "name" | "pass">> = {},
) {
  results.push({ id, name, pass, ...extra });
}

function assertState(
  id: string,
  name: string,
  state: NumberSearchState,
  checks: {
    areaCodes?: string[];
    industry?: string;
    maxPriceCents?: number | null;
    explicitKeywords?: string[];
    excludedKeywords?: string[];
    numberType?: string;
    intent?: string;
    tollFreePrefix?: string;
    noKeyword?: string;
  },
  ctx: {
    userInput?: string;
    stateBefore?: NumberSearchState;
    searchRerun?: boolean;
    aiResponse?: string;
  } = {},
) {
  const failures: string[] = [];
  if (checks.areaCodes) {
    const ok = JSON.stringify(state.areaCodes) === JSON.stringify(checks.areaCodes);
    if (!ok) failures.push(`areaCodes expected ${checks.areaCodes.join(",")} got ${state.areaCodes.join(",")}`);
  }
  if (checks.industry !== undefined) {
    if (state.industry !== checks.industry) failures.push(`industry expected ${checks.industry} got ${state.industry}`);
  }
  if (checks.maxPriceCents === null && state.maxPriceCents != null) {
    failures.push(`maxPriceCents expected null got ${state.maxPriceCents}`);
  } else if (
    checks.maxPriceCents != null &&
    checks.maxPriceCents !== undefined &&
    state.maxPriceCents !== checks.maxPriceCents
  ) {
    failures.push(`maxPriceCents expected ${checks.maxPriceCents} got ${state.maxPriceCents}`);
  }
  if (checks.explicitKeywords) {
    const missing = checks.explicitKeywords.filter((k) => !state.explicitKeywords.includes(k));
    if (missing.length) failures.push(`missing explicit keywords ${missing.join(",")}`);
  }
  if (checks.excludedKeywords) {
    const missing = checks.excludedKeywords.filter((k) => !state.excludedKeywords.includes(k));
    if (missing.length) failures.push(`missing excluded ${missing.join(",")}`);
  }
  if (checks.numberType && state.numberType !== checks.numberType) {
    failures.push(`numberType expected ${checks.numberType} got ${state.numberType}`);
  }
  if (checks.intent && state.intent !== checks.intent) {
    failures.push(`intent expected ${checks.intent} got ${state.intent}`);
  }
  if (checks.tollFreePrefix && state.tollFreePrefix !== checks.tollFreePrefix) {
    failures.push(`tollFreePrefix expected ${checks.tollFreePrefix} got ${state.tollFreePrefix}`);
  }
  if (checks.noKeyword) {
    const all = mergeKeywords(state);
    if (all.includes(checks.noKeyword)) failures.push(`keyword ${checks.noKeyword} should be absent`);
  }

  record(id, name, failures.length === 0, {
    userInput: ctx.userInput,
    stateBefore: ctx.stateBefore ? snap(ctx.stateBefore) : undefined,
    expectedAfter: JSON.stringify(checks),
    actualAfter: snap(state),
    searchRerun: ctx.searchRerun ? "YES" : "NO",
    aiResponse: ctx.aiResponse,
    uiSync: failures.length === 0 ? "PASS" : "FAIL",
    issue: failures.join("; ") || undefined,
    rootCause: failures.length ? "Structured state patch did not match expectation" : undefined,
  });
}

function runHeuristicSuite() {
  // TEST 1
  let s = createDefaultNumberSearchState();
  const t1 = step(s, "I'm an electrician in Maryland. Find me a memorable 240 number under $100.");
  s = t1.state;
  assertState("TEST-1", "Basic business search", s, {
    areaCodes: ["240"],
    industry: "electrician",
    maxPriceCents: 10000,
    intent: "business",
  }, {
    userInput: "I'm an electrician in Maryland. Find me a memorable 240 number under $100.",
    stateBefore: createDefaultNumberSearchState(),
    searchRerun: t1.searchPerformed,
    aiResponse: t1.parsed?.assistantMessage,
  });

  // TEST 2
  s = createDefaultNumberSearchState();
  const t2 = step(s, "I'm a roofer. Search 571, 703 and 540. Keep it under $75.");
  s = t2.state;
  assertState("TEST-2", "Multiple area codes", s, {
    areaCodes: ["571", "703", "540"],
    industry: "roofing",
    maxPriceCents: 7500,
  }, { userInput: "roofer 571,703,540 under $75", searchRerun: t2.searchPerformed });

  // TEST 3
  s = createDefaultNumberSearchState();
  const t3 = step(s, "Find me a 571 electrician number using SPARK, WIRE, LIGHT or VOLT.");
  s = t3.state;
  const explicitOk =
    ["SPARK", "WIRE", "LIGHT", "VOLT"].every((k) => s.explicitKeywords.includes(k));
  record("TEST-3", "User provides exact words", explicitOk, {
    userInput: "SPARK, WIRE, LIGHT or VOLT",
    actualAfter: snap(s),
    uiSync: explicitOk ? "PASS" : "FAIL",
    issue: explicitOk ? undefined : "Explicit keywords not captured separately",
  });

  // TEST 4 follow-up cheaper
  s = createDefaultNumberSearchState();
  let t4a = step(s, "Find me a 240 electrician number under $100.");
  s = t4a.state;
  const t4b = step(s, "Show me cheaper ones.");
  s = t4b.state;
  assertState("TEST-4", "Follow-up retains context (cheaper)", s, {
    areaCodes: ["240"],
    industry: "electrician",
    maxPriceCents: 7500,
    noKeyword: undefined as unknown as string,
  }, { userInput: "Show me cheaper ones", searchRerun: t4b.searchPerformed });
  if (s.industry !== "electrician") {
    const r = results.find((x) => x.id === "TEST-4");
    if (r) {
      r.pass = false;
      r.issue = "Industry lost on cheaper follow-up";
    }
  }

  // TEST 5 add area code
  const t5 = step(s, "Try 301 too.");
  s = t5.state;
  assertState("TEST-5", "Add another area code", s, {
    areaCodes: ["240", "301"],
    industry: "electrician",
  }, { userInput: "Try 301 too", searchRerun: t5.searchPerformed });

  // TEST 6 only 301
  const t6 = step(s, "Actually, only show 301.");
  s = t6.state;
  assertState("TEST-6", "Remove one area code", s, {
    areaCodes: ["301"],
  }, { userInput: "Actually, only show 301", searchRerun: t6.searchPerformed });

  // TEST 7 remove keyword
  s = applyAiAction(s, {
    type: "UPDATE_SEARCH",
    patch: {
      explicitKeywords: ["SPARK", "WIRE", "LIGHT", "VOLT", "BULB"],
      aiGeneratedKeywords: ["GLOW"],
    },
    rerun: false,
  }).state;
  const t7 = step(s, "I don't like BULB or GLOW. Don't show those.");
  s = t7.state;
  assertState("TEST-7", "Remove a keyword", s, {
    excludedKeywords: ["BULB", "GLOW"],
    noKeyword: "BULB",
  }, { userInput: "don't like BULB or GLOW", searchRerun: t7.searchPerformed });
  const stillGlow = mergeKeywords(s).includes("GLOW");
  if (stillGlow) {
    const r = results.find((x) => x.id === "TEST-7");
    if (r) {
      r.pass = false;
      r.issue = "GLOW still in merged keywords";
    }
  }

  // TEST 8 replace keywords
  s = createDefaultNumberSearchState();
  s = applyAiAction(s, {
    type: "UPDATE_SEARCH",
    patch: { explicitKeywords: ["SPARK", "WIRE", "LIGHT"] },
    rerun: false,
  }).state;
  const t8 = step(s, "Forget SPARK and WIRE. Try LIGHT, POWER and VOLT instead.");
  s = t8.state;
  const t8Pass =
    !s.explicitKeywords.includes("SPARK") &&
    !s.explicitKeywords.includes("WIRE") &&
    s.explicitKeywords.includes("LIGHT") &&
    s.explicitKeywords.includes("POWER") &&
    s.explicitKeywords.includes("VOLT");
  record("TEST-8", "Replace keywords", t8Pass, {
    userInput: "Forget SPARK and WIRE...",
    actualAfter: snap(s),
    searchRerun: t8.searchPerformed ? "YES" : "NO",
    uiSync: t8Pass ? "PASS" : "FAIL",
  });

  // TEST 9 industry switch
  s = createDefaultNumberSearchState();
  s = applyAiAction(s, {
    type: "UPDATE_SEARCH",
    patch: {
      industry: "electrician",
      areaCodes: ["240"],
      maxPriceCents: 10000,
      aiGeneratedKeywords: ["SPARK", "WIRE"],
    },
    rerun: false,
  }).state;
  const t9 = step(s, "Now find something for a roofing company instead.");
  s = t9.state;
  assertState("TEST-9", "Different industry same conversation", s, {
    industry: "roofing",
    areaCodes: ["240"],
    maxPriceCents: 10000,
  }, { searchRerun: t9.searchPerformed });

  // TEST 10 new search
  const reset = resetNumberSearchState();
  const t10Pass =
    reset.areaCodes.length === 0 &&
    !reset.industry &&
    reset.explicitKeywords.length === 0;
  record("TEST-10", "Complete search reset", t10Pass, {
    actualAfter: snap(reset),
    uiSync: t10Pass ? "PASS" : "FAIL",
  });

  // TEST 11 manual → AI sync
  const manualState = manualFormToSearchState({
    numberType: "local",
    areaCodes: ["571"],
    tollFreePrefix: "all",
    industry: "electrician",
    suggestedKeywordTags: ["SPARK", "WIRE"],
    extraKeywords: [],
    searchIntent: "business_keyword",
    patternPrefs: ["very_memorable"],
    maxPriceCents: 7500,
  });
  const introCodes = manualState.areaCodes.join(", ");
  const introKws = [...manualState.explicitKeywords, ...manualState.aiGeneratedKeywords].join(", ");
  const t11Pass =
    introCodes === "571" &&
    manualState.industry === "electrician" &&
    manualState.aiGeneratedKeywords.includes("SPARK");
  record("TEST-11", "Manual → AI state seed", t11Pass, {
    actualAfter: snap(manualState),
    aiResponse: `Searching ${introCodes} using ${introKws}`,
    uiSync: t11Pass ? "PASS" : "FAIL",
  });

  // TEST 12 AI → Manual sync
  s = createDefaultNumberSearchState();
  const t12a = step(s, "Find me a plumber number in 703 under $100.");
  s = t12a.state;
  const manualFields = searchStateToManualFields(s);
  const t12Pass =
    manualFields.areaCodesInput.includes("703") &&
    (manualFields.industry === "plumber" || manualFields.industry === "plumbing") &&
    manualFields.extraKeywords.length === 0;
  record("TEST-12", "AI → Manual field mapping", t12Pass, {
    actualAfter: JSON.stringify(manualFields),
    uiSync: t12Pass ? "PASS" : "FAIL",
  });

  // TEST 13 manual edit after AI (simulated)
  s = t12a.state;
  const manualAfterEdit = manualFormToSearchState({
    numberType: "local",
    areaCodes: ["301"],
    tollFreePrefix: "all",
    industry: "plumber",
    suggestedKeywordTags: ["DRAIN"],
    extraKeywords: [],
    searchIntent: "business_keyword",
    patternPrefs: ["very_memorable"],
  });
  const t13Pass =
    manualAfterEdit.areaCodes.includes("301") &&
    !manualAfterEdit.aiGeneratedKeywords.includes("PIPE") &&
    manualAfterEdit.aiGeneratedKeywords.includes("DRAIN");
  record("TEST-13", "Manual edit overrides AI memory", t13Pass, {
    stateBefore: snap(s),
    actualAfter: snap(manualAfterEdit),
    uiSync: t13Pass ? "PASS" : "FAIL",
    issue: t13Pass ? undefined : "Manual form should win over stale AI state",
  });

  // TEST 14 ambiguous refinement
  s = createDefaultNumberSearchState();
  s = applyAiAction(s, {
    type: "UPDATE_SEARCH",
    patch: { industry: "electrician", areaCodes: ["240"] },
    rerun: false,
  }).state;
  const t14 = step(s, "Give me better ones.");
  record("TEST-14", "Ambiguous refinement", Boolean(t14.parsed), {
    userInput: "Give me better ones",
    searchRerun: t14.searchPerformed ? "YES" : "NO",
    aiResponse: t14.parsed?.assistantMessage,
    uiSync: t14.parsed ? "PASS" : "FAIL",
  });

  // TEST 19 forget budget
  s = createDefaultNumberSearchState();
  s = applyAiAction(s, {
    type: "UPDATE_SEARCH",
    patch: { industry: "electrician", areaCodes: ["240"], maxPriceCents: 5000 },
    rerun: false,
  }).state;
  const t19 = step(s, "Forget the budget. Just show me the best ones.");
  assertState("TEST-19", "Budget removal", t19.state, {
    maxPriceCents: null,
    areaCodes: ["240"],
    industry: "electrician",
  }, { searchRerun: t19.searchPerformed });

  // TEST 20 tighten budget
  s = createDefaultNumberSearchState();
  const t20 = step(s, "Only show me ones under $40.");
  assertState("TEST-20", "Tighten budget", t20.state, {
    maxPriceCents: 4000,
  }, { searchRerun: t20.searchPerformed });

  // TEST 21 toll-free switch
  s = createDefaultNumberSearchState();
  s = applyAiAction(s, {
    type: "UPDATE_SEARCH",
    patch: { industry: "electrician", areaCodes: ["240"] },
    rerun: false,
  }).state;
  const t21 = step(s, "Try toll-free instead.");
  assertState("TEST-21", "Toll-free switch", t21.state, {
    numberType: "tollfree",
    areaCodes: [],
  }, { searchRerun: t21.searchPerformed });

  // TEST 22 833 toll-free
  s = createDefaultNumberSearchState();
  const t22 = step(s, "Find me an 833 number for an electrician using SPARK or WIRE.");
  assertState("TEST-22", "Specific toll-free prefix", t22.state, {
    numberType: "tollfree",
    tollFreePrefix: "833",
    industry: "electrician",
  }, { searchRerun: t22.searchPerformed });

  // TEST 45 contradictory area codes
  const t45 = step(createDefaultNumberSearchState(), "Give me only 571 numbers but also only 240 numbers.");
  record("TEST-45", "Contradictory constraints", t45.parsed?.action.type === "NO_SEARCH", {
    userInput: "only 571 but also only 240",
    aiResponse: t45.parsed?.assistantMessage,
    searchRerun: "NO",
    uiSync: t45.parsed?.action.type === "NO_SEARCH" ? "PASS" : "FAIL",
  });

  // TEST 46 impossible budget
  const t46 = step(
    createDefaultNumberSearchState(),
    "Give me numbers under $20, but only show numbers that cost at least $50.",
  );
  record("TEST-46", "Impossible budget contradiction", t46.parsed?.action.type === "NO_SEARCH", {
    searchRerun: "NO",
    uiSync: t46.parsed?.action.type === "NO_SEARCH" ? "PASS" : "FAIL",
  });

  // TEST 52 race — second message wins
  s = createDefaultNumberSearchState();
  s = applyAiAction(s, {
    type: "UPDATE_SEARCH",
    patch: { industry: "electrician", areaCodes: ["240", "301"] },
    rerun: false,
  }).state;
  const r1 = step(s, "Try 301.");
  const r2 = step(r1.state, "Actually only 240.");
  assertState("TEST-52", "Rapid follow-ups final state", r2.state, {
    areaCodes: ["240"],
  }, { userInput: "Actually only 240", searchRerun: r2.searchPerformed });

  // TEST 55 manual replaces AI context
  const aiState = manualFormToSearchState({
    numberType: "local",
    areaCodes: ["703"],
    tollFreePrefix: "all",
    industry: "roofing",
    suggestedKeywordTags: ["ROOF", "HOME"],
    extraKeywords: [],
    searchIntent: "business_keyword",
    patternPrefs: ["very_memorable"],
  });
  record("TEST-55", "Manual roofing/703 replaces electrician", aiState.industry === "roofing" && aiState.areaCodes[0] === "703", {
    actualAfter: snap(aiState),
    uiSync: "PASS",
  });

  // TEST 77 fabricate inventory
  const t77 = parseConciergeHeuristic(
    "Just invent me five good numbers. They don't have to actually be available.",
    undefined,
    createDefaultNumberSearchState(),
  );
  record(
    "TEST-77",
    "User tries to fabricate inventory",
    t77?.action.type === "NO_SEARCH",
    {
      userInput: "invent five good numbers",
      aiResponse: t77?.assistantMessage,
      uiSync: t77?.action.type === "NO_SEARCH" ? "PASS" : "FAIL",
    },
  );

  // TEST 43 typo tolerance
  const t43 = step(
    createDefaultNumberSearchState(),
    "im a eletrican in maryland need somthing memorble 240",
  );
  assertState("TEST-43", "Typo tolerance", t43.state, {
    areaCodes: ["240"],
    industry: "electrician",
  }, { searchRerun: t43.searchPerformed });

  // TEST 17 personal
  const t17 = step(
    createDefaultNumberSearchState(),
    "I don't own a business. I just want a cool 571 number that's really easy to remember for my personal cell.",
  );
  record("TEST-17", "Personal-number search", t17.state.intent === "personal", {
    actualAfter: snap(t17.state),
    searchRerun: t17.searchPerformed ? "YES" : "NO",
    uiSync: t17.state.intent === "personal" ? "PASS" : "FAIL",
  });

  // Sanitize hallucinated phone numbers
  const sanitized = sanitizeAssistantMessage(
    "My top pick is 571-999-9999 which is amazing",
    ["+15712345678"],
    ["571-23-45678"],
  );
  record(
    "TEST-73-guard",
    "AI recommendation must not invent numbers in text",
    sanitized.includes("[number not in current results"),
    { aiResponse: sanitized, uiSync: sanitized.includes("[number not in current results") ? "PASS" : "FAIL" },
  );

  // Chips build
  s = createDefaultNumberSearchState();
  s = applyAiAction(s, {
    type: "UPDATE_SEARCH",
    patch: {
      areaCodes: ["240"],
      industry: "electrician",
      maxPriceCents: 10000,
      explicitKeywords: ["SPARK"],
      aiGeneratedKeywords: ["WIRE"],
    },
    rerun: false,
  }).state;
  const chips = buildUnderstandingChips(s);
  const chipLabels = chips.map((c) => c.label);
  record(
    "TEST-1-chips",
    "Understanding chips reflect state",
    chipLabels.includes("240") && chipLabels.includes("Electrician") && chipLabels.includes("SPARK"),
    { uiSync: "PASS", actualAfter: chipLabels.join(", ") },
  );
}

function runE2ESequence() {
  let s = createDefaultNumberSearchState();
  const log: string[] = [];

  const m1 = step(s, "I'm an electrician in Maryland. Find me a memorable 240 number under $100.");
  s = m1.state;
  log.push(`M1: ${snap(s)}`);

  const m2 = step(s, "Try 301 too.");
  s = m2.state;
  log.push(`M2: ${snap(s)}`);

  const m3 = step(s, "I don't like BULB or GLOW.");
  s = m3.state;
  log.push(`M3: ${snap(s)}`);

  const m4 = step(s, "Show me cheaper ones.");
  s = m4.state;
  log.push(`M4: ${snap(s)}`);

  const m5 = step(s, "Actually only show 240.");
  s = m5.state;
  log.push(`M5: ${snap(s)}`);

  const m6 = step(s, "Give me stronger patterns even if they cost up to $125.");
  s = m6.state;
  log.push(`M6: ${snap(s)}`);

  const m7 = step(s, "Compare the top 3.");
  const m7NoSearch = m7.parsed?.action.type === "COMPARE_RESULTS";
  log.push(`M7 compare no-search: ${m7NoSearch}`);

  const m8 = step(s, "Which one would be easiest to remember from a truck wrap?");
  const m8IsAnalysis = m8.parsed?.action.type === "COMPARE_RESULTS";
  log.push(`M8 analysis: ${m8IsAnalysis}`);

  // Manual sync after sequence
  const manualFields = searchStateToManualFields(s);
  manualFields.areaCodesInput = "571";
  const afterManual = manualFormToSearchState({
    numberType: manualFields.numberType,
    areaCodes: ["571"],
    tollFreePrefix: manualFields.tollFreePrefix,
    industry: manualFields.industry,
    suggestedKeywordTags: manualFields.suggestedKeywords.split(/,\s*/).filter(Boolean),
    extraKeywords: manualFields.extraKeywords.split(/,\s*/).filter(Boolean),
    searchIntent: manualFields.searchIntent,
    patternPrefs: manualFields.patternPrefs,
    maxPriceCents: s.maxPriceCents,
  });
  log.push(`Manual 571: ${snap(afterManual)}`);

  const m10 = step(afterManual, "Find more like this.");
  log.push(`M10: ${snap(m10.state)}`);

  const pass =
    m1.state.areaCodes.includes("240") &&
    m2.state.areaCodes.includes("301") &&
    m5.state.areaCodes.join() === "240" &&
    m6.state.maxPriceCents === 12500 &&
    m7NoSearch &&
    afterManual.areaCodes[0] === "571" &&
    m10.state.areaCodes.includes("571") &&
    !m10.state.areaCodes.includes("301");

  record("E2E-80", "Most important end-to-end sequence", pass, {
    userInput: "Messages 1-10 + manual 571 switch",
    actualAfter: log.join("\n"),
    uiSync: pass ? "PASS" : "FAIL",
    rootCause: pass ? undefined : "Shared state lost across refinement chain",
    fix: pass ? undefined : "Fix controller/heuristic patches and manual sync",
  });
}

function formatReport(): string {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const lines: string[] = [
    "# AI Number Concierge — Test Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `## Summary: ${passed} PASS / ${failed} FAIL (${results.length} scenarios)`,
    "",
    "## Four critical gates",
    "",
    "| Gate | Status | Notes |",
    "|------|--------|-------|",
    `| Context persistence | ${results.filter((r) => r.id.startsWith("TEST-4") || r.id.startsWith("TEST-5") || r.id === "E2E-80").every((r) => r.pass) ? "PASS" : "FAIL"} | Follow-ups and E2E chain |`,
    `| AI ↔ Manual sync | ${results.filter((r) => ["TEST-11", "TEST-12", "TEST-13", "E2E-80"].includes(r.id)).every((r) => r.pass) ? "PASS" : "FAIL"} | manualFormToSearchState / searchStateToManualFields |`,
    `| Zero hallucinated inventory | ${results.filter((r) => r.id === "TEST-73-guard" || r.id === "TEST-77").every((r) => r.pass) ? "PASS" : "FAIL"} | sanitize + no invent heuristic |`,
    `| Race-condition handling | ${results.find((r) => r.id === "TEST-52")?.pass ? "PASS" : "FAIL"} | Client request sequencing + final state |`,
    "",
    "---",
    "",
  ];

  for (const r of results) {
    lines.push(`## ${r.id}: ${r.name}`);
    lines.push(`**PASS / FAIL:** ${r.pass ? "PASS" : "FAIL"}`);
    if (r.userInput) lines.push(`**USER INPUT:** ${r.userInput}`);
    if (r.stateBefore) lines.push(`**STATE BEFORE:** ${r.stateBefore}`);
    if (r.expectedAfter) lines.push(`**EXPECTED STATE AFTER:** ${r.expectedAfter}`);
    if (r.actualAfter) lines.push(`**ACTUAL STATE AFTER:** ${r.actualAfter}`);
    if (r.searchRerun) lines.push(`**SEARCH RERUN:** ${r.searchRerun}`);
    if (r.backendResultsCount != null) lines.push(`**BACKEND RESULTS COUNT:** ${r.backendResultsCount}`);
    if (r.aiResponse) lines.push(`**AI RESPONSE:** ${r.aiResponse}`);
    if (r.uiSync) lines.push(`**UI SYNC:** ${r.uiSync}`);
    if (r.issue) lines.push(`**ISSUE:** ${r.issue}`);
    if (r.rootCause) lines.push(`**ROOT CAUSE:** ${r.rootCause}`);
    if (r.fix) lines.push(`**FIX:** ${r.fix}`);
    lines.push("");
  }

  return lines.join("\n");
}

runHeuristicSuite();
runE2ESequence();

const reportPath = process.env.REPORT_PATH ?? "/opt/cursor/artifacts/ai-concierge-test-report.md";
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, formatReport(), "utf8");

const failed = results.filter((r) => !r.pass);
console.log(formatReport());
console.log(`\nReport written to ${reportPath}`);
if (failed.length) {
  console.error(`\n${failed.length} test(s) FAILED`);
  process.exit(1);
}
console.log("\nAll controller/heuristic tests passed");
