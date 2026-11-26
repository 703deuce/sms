---
name: lab-sign-in-handoff
description: Sign-in/2FA/captcha handoff to Rick, Live screen
when_to_use: Use when a page needs a sign-in, 2FA, captcha, or file picker that Rick must do, or when using handoff or the Live screen.
---

# Sign-in handoff and the Live screen

(Moved word for word from AGENTS.md lines 161-162. These are still your rules; they just load on demand.)

- While Rick uses the Live screen (or a sign-in handoff is waiting), actions on the SHARED browser wait automatically until he has been idle 30 s; you'll see "waiting for Rick". Your own job browser (below) never waits for him.


- **Sign-ins, 2FA, captchas, file pickers: hand off to Rick.** Open the page on the desktop, then run `handoff "Please sign in to YouTube, then press I'm done" [--timeout 1800]`. Rick works on the SHARED desktop: in a run, `handoff` opens your current page there for him and, when he is done, copies the new login into your own browser and reloads your tab. It waits until Rick finishes. Rick sees the request as a notice on the Agent Lab page (https://transovo.ai/app/agent-lab) with a **Live screen** and an **I'm done** button; tell him to go there. Ignore any `:6080` URL or PIN the tool prints; that direct link is closed to the internet. Never ask Rick to send passwords or codes in chat.
- Rick can watch the shared desktop any time with the page's Live screen (`/workspace/desktop/live.jpg` is the current frame). Your own job browser is not on it; if Rick wants to see it, `job-browser shot out.png` and show him the file.

- When `handoff` starts, the runner pushes an urgent notification to Rick with the Live screen link, and the stuck-job watchdog pauses while he works, so waiting up to `--timeout` is safe. After "I'm done" the new login/cookies are copied into your own browser and your tab reloads; continue from there. Captchas and press-and-hold checks go through the same handoff.
