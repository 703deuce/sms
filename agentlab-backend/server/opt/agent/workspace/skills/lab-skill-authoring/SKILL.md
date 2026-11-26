---
name: lab-skill-authoring
when_to_use: Use when you have worked out a reusable way to do a kind of job and should save or update a SKILL.md, or when Rick asks you to write or dedupe a skill. Never rewrite core rules (AGENTS.md) or disabled video skills.
description: Save or update a short reusable skill the router can attach later.
---

# Saving a reusable skill

When you work out a reliable way to do a kind of job, save it so a later similar job can load it. Skills are how-tos, not a place to put core rules.

## Before you write

- List installed skills with `skill` and open any close match (`skill <slug>`). If one already covers this job, **update that slug** instead of adding a near-duplicate.
- **Never** edit `AGENTS.md` or any other core rules file. A skill cannot replace those rules.
- **Never** rewrite, re-enable, or update a disabled video skill. If a folder has `SKILL.md.disabled*` and no `SKILL.md`, leave it alone. The list is in `protected.md` in this folder (`read_section` or `agent_skill_file`). `save-skill` will refuse those slugs.
- **No secrets** in a skill: no API keys, tokens, passwords, private keys, or URLs that embed credentials. Draft in this job folder and run `redact` on the draft if you are unsure. `save-skill` will refuse a body that looks like it contains a secret.

## What to write

- One `SKILL.md`, under ~500 lines. Frontmatter must include `name` and a single-line `when_to_use` (≤220 characters) with **triggers and exclusions** so the Haiku router can attach it. Add a short `description` too.
- Put a long recipe in a reference `.md` **one level down** in the same folder, and tell the agent to open that file with `read_section` or `agent_skill_file`. Do not nest further, and do not pack many unrelated topics into one skill.
- Write the draft under this job folder first, then save.

A template is in `template.md` in this folder.

## How to save

```
save-skill <slug> --when-to-use "Use when … Not for …" --description "short blurb" --file ./SKILL.md
```

- Updating the same slug keeps a dated backup in that skill folder.
- Default scope is shared (`/workspace/skills`). Use `--mine` only for a bot-private skill.
- Do not copy files into `/workspace/skills` yourself; the sandbox will block it. Use `save-skill`.

## After you save

The router reads `SKILL.md` from disk at the start of each job. There is no re-index step and no runner restart. Confirm with `skill <slug>`. A later related job will attach the skill if `when_to_use` is clear and accurate.
