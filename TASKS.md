# Curtain — Tasks

Vocabulary first: artifacts 2–4 all encode it, so changing it later means changing it in four places.

## Phase 0 — Verify assumptions (no code)

- [x] **T0.1** ~~hide? on a leaf hides it from search~~ — **DISPROVED.** CLI `search block` returns the block with `hide? true`. Staleness ruled out by forced reindex. See [docs/t0-findings.md](docs/t0-findings.md).
- [x] **T0.2** Page-level `hide?` — **PARTIAL.** Filters `logseq list page` (reversible via `--include-hidden`), but `search page` still returns the page and `search block` still returns its blocks.
- [x] **T0.3** Human-search side effect — **RESOLVED AGAINST THE DESIGN.** `hide?` is honored inconsistently: `list page` yes, CLI `search` no. It cannot carry either axis; §5 of SPEC rewritten, R1 closed.
- [x] **T0.3b** App search **does** filter hidden blocks — control found, hidden leaf not found. Inversion confirmed: human loses it, agents keep it. `hide?` is **harmful**, not inert; Curtain never sets it.
- [ ] **T0.4** Confirm `upsertProperty(..., { hide: true })` sets `:logseq.property/hide?` on a plugin property (`property.cljs:742-748`).
- [ ] **T0.5** Confirm a plugin can reach `parent.document` to strip `data-block-title`.
- [x] **T0.6** ~~Check `hide?` side effects on markdown-mirror and db-sync~~ — **MOOT.** Curtain never sets `hide?`.

## Phase 1 — Vocabulary spec

- [ ] **T1.1** Freeze tag names, renderer name, flag grammar, key format.
- [ ] **T1.2** Write `NOROBOTS.md`, the portable contract agents are pointed at.

## Phase 2 — Plugin (UI axis)

- [ ] **T2.1** Scaffold: vite + `vite-plugin-logseq`, TS, `@logseq/libs` ≥ 0.3.2.
- [ ] **T2.2** Register `:curtain` renderer via `onMacroRendererSlotted`; key the `provideUI` call on `slot`, not block uuid.
- [ ] **T2.3** `/curtain` slash command: lift selected text into the payload property, leave the macro behind.
- [ ] **T2.4** Payload store: one hidden plugin property per block, JSON map of key → text.
- [ ] **T2.5** Reveal-on-click for `spoiler`; respect `norobots`-only as visible.
- [ ] **T2.6** Node-level `#spoiler`: query tagged nodes, inject CSS keyed by `blockid`.
- [ ] **T2.7** Strip `data-block-title` on concealed blocks (`block.cljs:4478`).
- [x] **T2.8** ~~`#norobots` → set `:logseq.property/hide?`~~ — **CUT.** Disproved by T0.1/T0.3b.

## Phase 3 — Agent-side enforcement

- [ ] **T3.1** MCP filter in `logseq-headless-mcp`: drop `#norobots` nodes, strip payload properties.
- [ ] **T3.2** Skill instruction honoring the contract.
- [ ] **T3.3** CLI wrapper `--respect-norobots`.

## Phase 4 — Tests

- [ ] **T4.1** One E2E per leak surface asserting the payload string is absent. See `docs/leak-surfaces.md`.
- [ ] **T4.2** Unit tests for flag parsing and the payload store.
- [ ] **T4.3** CI gate on the surface matrix.
