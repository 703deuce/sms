# Transovo AI: Team Registry & Roles (Updated Nov 19, 2026)

Every bot reports to the Chief of Staff. The Chief of Staff reports to John Jones. Security may escalate critical issues straight to John.

**New Chief of Staff bot starting after Nov 19, 2026:** Read [`docs/handoffs/2026-11-19-chief-of-staff/START_HERE.md`](../docs/handoffs/2026-11-19-chief-of-staff/START_HERE.md) first.

## Active Motion Studio Operations (Nov 19, 2026)

In daily Motion Studio production as of Nov 19, 2026, work runs primarily through:
- **Chief of Staff** (orchestration, GitHub source of truth, Modal/Coolify ops, QA coordination, owner reporting)
- **Motion Studio Producer** (`7b7a2930-99bd-42a5-9c47-a96d6a15a8c4`) — receives Agent Bridge jobs and produces Motion Studio documentaries/bundles (`producer_handoff_kit/` + PR #1270)
- **Grok Bot** (`04661bbc-cc5f-4946-9d58-cc948d106ebb`) — general assistant

*(When transitioning the Chief of Staff onto a new workspace/account, verify `<teammates>` and update agent IDs here.)*

## Full Roster (Original 12-Bot Plan + Producer)

| Role | Prior Account Agent ID | Scope | Permissions / Access |
|---|---|---|---|
| Chief of Staff | `d7a6dc1a-8cc5-4dc0-a4d7-1ff750adf615` (being replaced on new account) | Central coordinator, backlog, Modal/server ops, owner reports | GitHub, Hetzner SSH, Modal CLI, Coordinator admin |
| Motion Studio Producer | `7b7a2930-99bd-42a5-9c47-a96d6a15a8c4` | Motion Studio job production, research, scripts, scene bundles | Agent Bridge job tokens, `producer_handoff_kit/` |
| Researcher | `2e46c557-1340-400f-ae50-6e4446cc647a` | Market & competitive research | GitHub issues/comments |
| Product Manager | `c4c535e3-2937-46a3-80be-88f643a52d50` | Product specs, roadmap, backlog | GitHub issues/comments |
| Backend Engineer ("New") | `8508ade4-9425-4db7-8d32-a8265e0904e7` | `new-app/`, workers, DB, APIs | GitHub, Hetzner SSH/deploys |
| Frontend Engineer | `610ea706-4ddd-4847-a8be-e9d513f1c772` | Authenticated app & Compact Editor UI | GitHub |
| Landing Pages | `1a3a4a0a-1bd1-4d80-9197-eb3f41d301e4` | Public marketing site | GitHub |
| QA Engineer | `a5d7df12-c8f9-48e9-9808-8d4c1652f1fc` | Independent QA & E2E verification | GitHub comments/reviews |
| Video Quality | `3a810a68-4611-4a84-bc31-e293bfa6c829` | AI video quality & editorial evaluation | GitHub comments/reviews |
| Security | `6d0a56bd-47cc-480a-96d6-9fb799624a89` | Authn/authz, storage privacy, secrets audit | GitHub read; server read-only |
| DevOps | `cdb84bac-1eb8-42bf-a4b0-4aa08b140379` | Hetzner/Coolify, health, logs, backups | GitHub, Hetzner SSH/deploys |
| Customer Support | `f5bb8b81-ab50-46bb-8b6c-86b74e68c341` | Customer troubleshooting & feedback | GitHub issues/comments |
| Growth & Analytics | `1fa6f991-42c1-48ba-8818-b5e3151081ac` | Funnel metrics, AI cost per video | GitHub issues/comments |
| Grok Bot (general) | `04661bbc-cc5f-4946-9d58-cc948d106ebb` | General assistant outside the 12-bot org | Per task |

Full role charters: [`docs/transovo_team/roles/`](../docs/transovo_team/roles/).
