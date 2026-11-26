---
name: lab-writing-editing
when_to_use: Use when the deliverable is written prose: a newsletter, email, brief, announcement, launch plan, or an edit of existing copy. Not for code, slide decks, spreadsheets, or sourced fact lists with no drafted writing.
description: Write and edit prose (newsletters, briefs, announcements, plans) to a spec.
---

# Writing and editing

The deliverable is the **prose**, usually `out/*.md` (or the format Rick asked for). Follow the requested length, tone, and audience. Do what was asked; don't add unrequested variants.

## Drafting

- If Rick supplied facts, names, dates, prices, or a source file, use **only** those plus anything you were told to look up. Don't invent features, quotes, or statistics.
- Put the important fact first (or follow a structure he gave). Short paragraphs. One idea per paragraph.
- Match the tone he named (warm, plain, formal). Don't use hype, fake urgency, or a stack of exclamation marks unless he asked for that voice.
- Include a clear call to action when the piece is an announcement or email.
- If the request has a word-count or length target, measure the words (or pages) and put the count at the top of the file or in the report.

## Editing existing copy

- Keep the author's meaning and facts. Fix clarity, grammar, and structure; don't silently change claims.
- If you cut or rewrite a section, say what you changed in one short note.

## Checks

- Re-read the file against the request: names, dates, prices, length, tone, and "do not invent" constraints.
- Word count: `wc -w` (or a Python count of words in the body, excluding a "Word count:" line if you added one). If you are outside the asked range, edit until you are inside it.
- No placeholder text (`TODO`, `lorem ipsum`, `TBD` unless the request allows an open item).

## Keep the facts
When you rewrite, shorten or convert someone's text, keep every date, number, price, name and heading exactly as given (never change a date to today). Before delivering, list them from the input and tick each one off in your output; fix any that changed or dropped. A dated post must not promote a deadline that has already passed on its date.

## High-stakes or legal writing: `sonnet-assist --mode legal` (rare, situational)

Use only for a contract, legal-ish text, or customer-facing copy where an error would be costly, and only when you are not confident you can get it right yourself. If Haiku is enough, stay with Haiku.

  sonnet-assist --mode legal --goal "<purpose, audience, and constraints>" --file draft.md

Send only the draft or section and the purpose. It returns `REVISED:` text plus at most 5 `NOTES:`. You apply the edits and remain responsible for the final wording. It is a one-shot call, not a model switch.
