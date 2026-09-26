# newui-transplant

Exact copies of approved `newui/` components moved into production.

- **Do not** redesign files here — only integration boundaries (imports, props, adapters).
- **Source of truth for presentation:** these files (kept in sync with `newui/` when Opus updates the sandbox).
- **Source of truth for data/behavior:** existing `src/` loaders, APIs, mutations.

When transplanting a **route** from `newui/`:

1. Copy the **page and its full New UI dependency graph** (every `newui/components/...` import, recursively) into `src/newui-transplant/`.
2. Rewrite imports to `@/newui-transplant/...` and `@/lib/utils` (production).
3. Remove any `@/lib/data` usage — pass real data via props, server parent, or a **thin** adapter (`DTO → view model` only).
4. Do not substitute production legacy components for transplanted UI because they already fetch.
5. Keep `newui/` untouched; diff against it to prove Opus code survived. No reformat churn on copy.
