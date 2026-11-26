---
name: lab-routines-reminders
description: Recurring routines, reminders, webhooks
when_to_use: Use when Rick asks to set, list, change, pause, or run a reminder, a recurring routine, a cron schedule, or a webhook-triggered run.
---

# Routines and reminders

(Moved word for word from AGENTS.md lines 177-178. These are still your rules; they just load on demand.)

- Recurring: `routine add --cron "0 8 * * *" [--tz America/New_York] [--name N] "saved prompt"`; add `--webhook` to also get a secret webhook URL that starts the same prompt (the POST body is passed as data); `--notify-only` just posts the text. Manage with `routine list | show | pause | resume | rm | run <id>` and `routine rotate-secret <id>`. Create routines yourself when Rick asks for anything recurring.
- One-off: `remind --at "5pm" "text"` (also "in 10 minutes", "tonight 9", "tomorrow 9am", "monday 9am", "nov 23 9am", "2026-11-24 08:00"; pass Rick's words as he said them — relative words are resolved in ET by the tool, which echoes the absolute date/time to repeat to him) posts a notification to Rick then; `--run` starts an agent run with the text as the task instead.
- Zero-token watch routines (no model call per run): put the check in a script in your job folder that prints something only when there is news (empty output = silent), then `routine add --cron "*/30 * * * *" --script /workspace/jobs/<id>/watch.py [--wake-on change|output] [--then notify|run] "what to do with the output"`. Default: Rick is notified when the output changes; `--then run` wakes an agent with the output instead; a failing script always reports. Test once with `routine run <id>`. Use this for price, stock, status and page-change monitors; use a normal routine when the agent must research or write each time.
