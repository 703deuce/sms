## Output template: single_payoff
- Target length 15-30s (hard max 45s). Beats: hook → setup → build → payoff → reaction tail.
- One main payoff; aggressive inner cuts in setup/build only.
- Music usually off unless user asked.

## Output template: montage
- Target 30-60s short montage unless user asked long-form (3-10 min).
- Strongest moment in last 25%; second-best opens or follows hook.
- Library music only; cut on beat when music is present.

## Output template: story
- Target 45-90s default; longer only when user instruction requests it.
- Cause before effect across segments/sources; labels for time jumps.
- Multi-source encouraged when inventory shows linked callbacks.

## Output template: auto
- Orchestrator/agent DECIDE step picks single_payoff, montage, or story from inventory + user instruction.
- Max 3 separate editor projects per run when footage has multiple clear winners; never pad weak edits.
- If output type is auto, apply the template for the resolved type in the plan JSON.
