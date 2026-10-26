# Screenplay format & flow (Final Draft parity)

Keystroke-level rules implemented in `lib/screenwriting/editor/element-keys.ts`, `schema/extensions.ts` (keymap), and `smarttype/store.ts`.

## Enter / Tab / Backspace

See `nextElementType()` and `createScreenplayKeymap()`.

## Auto-detect while typing

`autoDetectElementType()` — scene headings (INT./EXT.), transitions (… TO:), parenthetical from dialogue.

## Pagination

Editor decorations and PDF both use `layoutElementsFromPmJson` + `paginateFromElements()` with the active `FormatSpec`.

## Acceptance tests (28) — `[U]` in `screenwriting-format-flow.test.ts`

| # | Rule |
|---|------|
| T01 | Enter after scene heading → action |
| T02 | Enter after action → action |
| T03 | Enter after character → dialogue |
| T04 | Enter after parenthetical → dialogue |
| T05 | Enter after dialogue → action |
| T06 | Enter after transition → scene heading |
| T07 | Tab on action → character |
| T08 | Tab on character → transition |
| T09 | Tab on dialogue → parenthetical |
| T10 | Shift+Tab on character → action |
| T11 | Backspace empty dialogue → character |
| T12 | Backspace empty action → scene heading |
| T13 | Auto-detect INT. → scene heading |
| T14 | Auto-detect EXT. → scene heading |
| T15 | Auto-detect CUT TO: → transition |
| T16 | Dialogue line starting with ( → parenthetical |
| T17 | Fountain: no blank between character and parenthetical |
| T18 | Fountain: no blank between character and dialogue |
| T19 | Scene heading forced uppercase in fountain export |
| T20 | PDF and layout share page count for sample script |
| T21 | Cmd+1 → scene heading type |
| T22 | Cmd+3 → character type |
| T23 | Widow: dialogue block does not orphan single line (pagination) |
| T24 | Scene heading space-before at page top is 0 |
| T25 | Character caps in format spec |
| T26 | Transition right-aligned in element style |
| T27 | Normalize empty doc → one action element |
| T28 | Reorder scenes preserves scene block integrity |
