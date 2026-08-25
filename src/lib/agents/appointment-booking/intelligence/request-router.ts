/**
 * Lightweight deterministic request router — avoids full reasoning when intent is clear.
 */

import type { OwnerRequestIntent } from "./types";

export type RoutedRequest = {
  intent: OwnerRequestIntent;
  confidence: "high" | "medium" | "low";
  matchedPattern?: string;
  delegateTo?: "diagnostic_specialist" | "appointment_workflow_architect";
};

type PatternRule = {
  intent: OwnerRequestIntent;
  patterns: RegExp[];
  delegateTo?: RoutedRequest["delegateTo"];
};

const RULES: PatternRule[] = [
  {
    intent: "deploy_version",
    patterns: [
      /\b(put|go)\s+(it|this|version)\s+live\b/i,
      /\bput\s+this\s+version\s+live\b/i,
      /^(yes|yep|yeah|confirm|approve|go ahead|do it|activate|publish)\b/i,
      /\brollback\b/i,
      /\bundo\b.*\bchange\b/i,
      /\bdeploy(ed)?\s+version\b/i,
      /\bdrift\b/i,
      /\bwhat version\b/i,
      /\blive version\b/i,
    ],
  },
  {
    intent: "duplicate_agent",
    patterns: [
      /\bduplicate\b/i,
      /\bmake another\b/i,
      /\bcopy this agent\b/i,
      /\banother amy\b/i,
      /\bfor richmond\b/i,
      /\bcreate another\b/i,
    ],
  },
  {
    intent: "build_workflow",
    patterns: [
      /\bafter[- ]hours\b.*\b(workflow|flow|version)\b/i,
      /\bworkflow draft\b/i,
      /\bcreate an after-hours\b/i,
      /\bemergency\b.*\b(flow|workflow)\b/i,
      /\bsewer backup\b/i,
      /\btransfer\b.*\b(doesn't|does not|dont)\s+answer\b/i,
    ],
    delegateTo: "appointment_workflow_architect",
  },
  {
    intent: "run_test",
    patterns: [
      /\btest yourself\b/i,
      /\brun (a )?test/i,
      /\bsimulat(e|ion)\b/i,
      /\bregression\b/i,
    ],
  },
  {
    intent: "diagnose_failure",
    patterns: [
      /\bwhy didn't\b/i,
      /\bwhy did(n't| not)\b.*\bbook\b/i,
      /\bfail(ed|ure)\b/i,
      /\blast (call|booking|caller)\b/i,
      /\bshow\b.*\bfail/i,
      /\berror\b/i,
      /\bwhat happened\b/i,
      /\bwalk me through\b.*\b(call|conversation)\b/i,
      /\bmost recent\b.*\b(person|caller|appointment)\b/i,
      /\bhow did\b.*\blast call\b/i,
      /\bwhat\b.*\bamy did\b.*\bcall\b/i,
      /\blatest (call|phone conversation|caller)\b/i,
    ],
    delegateTo: "diagnostic_specialist",
  },
  {
    intent: "change_configuration",
    patterns: [
      /\b(change|set|require|disable|enable|stop|allow|turn)\b/i,
      /\bminimum notice\b/i,
      /\bsame[- ]day\b/i,
      /\badd\b.*\b(field|email|question|collect)\b/i,
      /\brequire\b.*\b(email|address|field)\b/i,
      /\bgreeting\b/i,
      /\bopening line\b/i,
    ],
  },
  {
    intent: "manage_knowledge",
    patterns: [
      /\bteach\b/i,
      /\bknowledge\b/i,
      /\bcompany brain\b/i,
      /\bnever quote\b/i,
      /\balways transfer\b/i,
    ],
  },
  {
    intent: "explain_activity",
    patterns: [
      /\bhow (did|are)\b.*\b(today|week|doing)\b/i,
      /\bhow many\b/i,
      /\bappointments\b.*\b(book|booked)\b/i,
      /\bmetrics\b/i,
      /\bconversion\b/i,
      /\bperformance\b/i,
      /\brecommend\b/i,
      /\bimprove\b/i,
    ],
  },
  {
    intent: "read_information",
    patterns: [
      /\bwhat do you do\b/i,
      /\bwho are you\b/i,
      /\bresponsible\b/i,
      /\bnot allowed\b/i,
      /\bprohibited\b/i,
      /\bexplain your setup\b/i,
      /\bwhich (number|calendar)\b/i,
      /\bwhat number\b/i,
      /\bhealth\b/i,
      /\bready\b/i,
      /\bservice\b/i,
      /\bbookable\b/i,
      /\bbusiness hours\b/i,
      /\bworkflow\b/i,
      /\bhelp me set up\b/i,
      /\bfinish setup\b/i,
      /\bwhat's missing\b/i,
    ],
  },
  {
    intent: "restricted_or_unsupported",
    patterns: [
      /\b(write|run|execute)\s+(code|sql|script)\b/i,
      /\barbitrary\b/i,
      /\bdelete all\b/i,
      /\baccess\b.*\bother workspace\b/i,
      /\banother company'?s?\b/i,
      /\bapi key\b/i,
      /\bmodify\b.*\bdatabase\b/i,
    ],
  },
];

export function routeOwnerRequest(question: string): RoutedRequest {
  const q = question.trim();
  if (!q) {
    return { intent: "restricted_or_unsupported", confidence: "high" };
  }

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(q)) {
        return {
          intent: rule.intent,
          confidence: "high",
          matchedPattern: pattern.source,
          delegateTo: rule.delegateTo,
        };
      }
    }
  }

  // Soft heuristics for medium confidence
  if (/\?/.test(q) && q.length < 120) {
    return { intent: "read_information", confidence: "medium" };
  }

  return { intent: "read_information", confidence: "low" };
}

export function shouldDelegateToSpecialist(route: RoutedRequest): boolean {
  return Boolean(route.delegateTo);
}
