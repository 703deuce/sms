import { agentLabErrorResponse, redactSecrets, runnerJson } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

/**
 * Read-only overview for the Agent Lab work pages (Responsibilities, Activity, Calendar, Needs you, Assignments).
 * Built only from data the runner already keeps: runs, routines and open questions. Costs, models, bot ids and
 * webhook URLs never reach the browser. Each part is reported separately so one slow part never blanks the page.
 */

type RunnerRun = {
  id: string
  source: string | null
  routine_id: string | null
  parent_conversation_id: string | null
  title: string | null
  conversation_id: string | null
  status: string
  attempts: number | null
  failures: number | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  last_checkpoint: string | null
  error: string | null
}

type RunnerRoutine = {
  id: string
  name: string | null
  kind: string | null
  cron: string | null
  tz: string | null
  action: string | null
  prompt: string | null
  paused: number | boolean | null
  done: number | boolean | null
  next_run_at: string | null
  last_run_at: string | null
  last_run_id: string | null
}

type RunnerQuestion = {
  id: string
  run_id: string | null
  conversation_id: string | null
  title: string | null
  question: string
  choices: string | null
  created_at: string
  expires_at: string | null
}

const clip = (s: string | null | undefined, n: number) => (s ? redactSecrets(String(s)).slice(0, n) : null)

function parseChoices(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.map((x) => clip(String(x), 120) ?? '').filter(Boolean).slice(0, 8) : []
  } catch {
    return []
  }
}

export async function GET() {
  try {
    const [runs, routines, questions] = await Promise.allSettled([
      runnerJson<{ items: RunnerRun[] }>('/runs', { timeoutMs: 15_000 }),
      runnerJson<{ items: RunnerRoutine[] }>('/routines', { timeoutMs: 15_000 }),
      runnerJson<{ items: RunnerQuestion[] }>('/questions', { timeoutMs: 15_000 }),
    ])
    return Response.json({
      runs:
        runs.status === 'fulfilled'
          ? runs.value.items.map((r) => ({
              id: r.id,
              source: r.source ?? null,
              routineId: r.routine_id ?? null,
              helper: Boolean(r.parent_conversation_id) || r.source === 'helper',
              title: clip(r.title, 240),
              conversationId: r.conversation_id ?? null,
              status: r.status,
              attempts: Number(r.attempts) || 0,
              createdAt: r.created_at,
              startedAt: r.started_at,
              finishedAt: r.finished_at,
              progress: clip(r.last_checkpoint, 300),
              error: clip(r.error, 300),
            }))
          : null,
      routines:
        routines.status === 'fulfilled'
          ? routines.value.items.map((r) => ({
              id: r.id,
              name: clip(r.name, 160),
              kind: r.kind ?? null,
              cron: r.cron ?? null,
              tz: r.tz ?? null,
              action: r.action ?? null,
              instruction: clip(r.prompt, 600),
              paused: Boolean(r.paused),
              done: Boolean(r.done),
              nextRunAt: r.next_run_at,
              lastRunAt: r.last_run_at,
              lastRunId: r.last_run_id,
            }))
          : null,
      questions:
        questions.status === 'fulfilled'
          ? questions.value.items.map((q) => ({
              id: q.id,
              runId: q.run_id,
              conversationId: q.conversation_id,
              title: clip(q.title, 200),
              question: clip(q.question, 1200) ?? '',
              choices: parseChoices(q.choices),
              createdAt: q.created_at,
              expiresAt: q.expires_at,
            }))
          : null,
    })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
