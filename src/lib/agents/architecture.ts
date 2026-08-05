/**
 * Transovo operating model (locked foundation)
 *
 * Agents are reusable workers. Workflows connect them. Triggers start them.
 * Deployments attach them to real communication channels.
 *
 * An agent is NOT defined by its trigger. The same SMS Response Agent can be
 * invoked by a missed call, a website lead, a campaign audience, a CRM change,
 * another agent, or a manual action — without changing the agent itself.
 *
 * Reusable pattern on every primary / overall flow:
 *   Trigger → Agent or action nodes → conditions / delays → outcome
 *
 * ---------------------------------------------------------------------------
 * Agent
 *   What intelligence or behavior performs the work.
 *   Supported channels, capabilities, configuration.
 *   May be mostly deterministic (Promotion Agent = compliance + send + route)
 *   with AI only where judgment is needed.
 *
 * Workflow (AutomationFlow)
 *   When it runs, which agents/actions it invokes, waits, branches, follow-ups.
 *   Agent primary workflow = that agent's own behavior.
 *   Overall / standalone automation = composes multiple agents + nodes.
 *
 * Deployment (TriggerDeployment / numbers / calendars / audiences)
 *   Which number, inbox, audience, calendar, or external system is connected.
 *   Test vs live status. Voice readiness ≠ SMS readiness.
 *   Phone routing: TriggerDeployment is compiled FROM the Inbound Call trigger
 *   on Activate (canvas is source of truth). My Numbers is the management view.
 *
 * Trigger
 *   Belongs on the workflow, not on the agent identity.
 *   Inbound Call holds phoneNumberId + routingMode; Activate publishes direct
 *   Telnyx routing (automation worker is never in the live audio path).
 *   Outbound call is an action node, not a trigger.
 *   Catalog templates pick a default trigger; customers can reuse the agent
 *   under different triggers via Use Agent / new workflows.
 * ---------------------------------------------------------------------------
 *
 * Use Agent (overall composition) has explicit modes:
 *   run_primary_workflow | invoke_task | hand_off_conversation
 *
 * Voice agent primary flows use Run Voice Agent — never Use Agent → self.
 *
 * Wizards are only an easy setup UI. Every completed wizard must leave:
 *   typed Agent + runnable primary Workflow + link + deployment/trigger config.
 */

export const PLATFORM_OBJECTS = [
  "agent",
  "workflow",
  "deployment",
  "trigger",
] as const;

export type PlatformObject = (typeof PLATFORM_OBJECTS)[number];

/** Customer-facing “agent” may be AI-heavy or mostly deterministic steps. */
export type AgentIntelligenceMode =
  | "realtime_ai"
  | "mixed"
  | "deterministic";

export const FLOW_PATTERN =
  "Trigger → Agent or action nodes → conditions/delays → outcome" as const;
