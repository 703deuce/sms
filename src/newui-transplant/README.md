# newui-transplant

Exact copies of approved `newui/` components moved into production.

- **Do not** redesign files here — only integration boundaries (imports, props, adapters).
- **Source of truth for presentation:** these files (kept in sync with `newui/` when Opus updates the sandbox).
- **Source of truth for data/behavior:** existing `src/` loaders, APIs, mutations.

When transplanting a new component from `newui/`:

1. Copy file(s) into the matching path under `src/newui-transplant/`.
2. Rewrite imports to `@/newui-transplant/...` and `@/lib/utils` (production).
3. Remove any `@/lib/data` usage — pass real data via props or server parent.
4. Do not substitute production legacy components for the transplanted UI.
