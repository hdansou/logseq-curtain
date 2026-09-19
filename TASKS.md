# Curtain — Tasks

Vocabulary first: every other artifact encodes it, so changing it later means
changing it in four places. Each task carries a note when it completes —
what was done, and anything learned that changes later work.

## Phase 0 — Verified against the host

- [x] **T0.1** `hide?` on a leaf block → **DISPROVED.** CLI `search block` still returns it. See [docs/t0-findings.md](docs/t0-findings.md).
- [x] **T0.2** `hide?` on a page → **PARTIAL.** Filters `logseq list page` (`--include-hidden` reverses it); `search page` and `search block` ignore it.
- [x] **T0.3** Human-search side effect → **RESOLVED AGAINST THE DESIGN.** Honored inconsistently; cannot carry either axis. SPEC §5 rewritten, R1 closed.
- [x] **T0.3b** App search **does** filter hidden blocks (control found, hidden leaf not). Inversion confirmed: the human loses it, agents keep it. `hide?` is *harmful*, not inert.
- [x] **T0.6** ~~`hide?` side effects on markdown-mirror and db-sync~~ — **MOOT.** Curtain never sets `hide?`.
- [x] **Upstream** Filed [logseq/db-test#1237](https://github.com/logseq/db-test/issues/1237) for the CLI/app search inconsistency.

## Phase 1 — Scaffold and vocabulary

Moved ahead of the remaining probes: T0.4 and T0.5 both need a loaded plugin,
so they cannot run until this phase exists.

- [x] **T1.1** Scaffold — vite + `vite-plugin-logseq`, TS, vitest, `@logseq/libs` ^0.3.2. *Notes: vitest needs its own config (`vite-plugin-logseq` fails at `buildStart` under the runner); pnpm 11 needs `pnpm approve-builds esbuild`.*
- [x] **T1.2** Freeze the vocabulary — `src/flags.ts` is the single source. `FLAG_NAMES` drives both the node tags and the macro flags, so they cannot drift. Parsing throws on unknown or duplicate flags: a typo must not degrade to "conceal from nobody", since over-concealing is recoverable and leaking is not. 10 tests, written first.
- [ ] **T1.3** Key format — short base36 per block (`k7`, `m3`); collisions only matter inside one block's payload map. Needs a test + generator.
- [ ] **T1.4** Write `NOROBOTS.md`, the portable contract agents are pointed at.

## Phase 2 — Host probes (need a loadable plugin)

Both answered **yes**; results are in [docs/t0-findings.md](docs/t0-findings.md).
`src/probes.ts` has been deleted as planned — git history holds it. A stray
`curtain-probe-payloads` property and a `Curtain-Probe-Results` page remain in
the `cliworker` test graph; harmless, removable whenever.

- [x] **T2.1** **YES.** `upsertProperty({ hide: true })` sets `:logseq.property/hide?`; ident is `:plugin.property.logseq-curtain/<name>` (plugin id unsanitised). Storage model in SPEC §3 stands.
- [x] **T2.2** **YES.** `window.parent.document` is reachable; read 6 blocks, wrote and restored `data-block-title`. Leak surface #2 is closable (T3.5).

## Phase 3 — Plugin

- [x] **T3.1** Payload store — key → text in one hidden plugin property. Flags stay in the macro so they remain readable in raw text. Parsing throws on corruption rather than reading as empty. `readRawPayload` absorbs the host key-spelling variance in one place. 20 tests.
- [x] **T3.2** `:curtain` renderer. `provideUI` keyed on slot, and reveal state is per slot too, since one block can hold several fragments. Concealed markup never carries the payload — asserted in a unit test. Payload is HTML-escaped. A macro whose payload is missing says so rather than rendering blank. 10 tests.
- [x] **T3.3a** Selection memory + `isSelectionUsable` — 17 tests, written first. Rules 1–3 checked; rule 4 is enforced by construction since `consume()` always clears. Bounds are validated before slicing because `slice()` truncates silently.
- [x] **T3.3b** `/spoiler`, `/norobots`, `/veil` (slash → node) plus editing-mode shortcuts (→ fragment). Context dispatch was **abandoned**: typing `/` replaces the selection, so it would have silently tagged nodes when the user meant fragments. `/veil` derives from `FLAG_NAMES`, so a third axis is covered without edits. 5 tests for trigger stripping.
- [x] **T3.3c** Block context menu — right-click a bullet; honours a multi-block selection when one exists.
- [x] **T3.3d** Page menu — the hook hands over a page *name*, not a uuid, so the page is resolved before tagging.
- [x] **T3.3e** Multi-block selection — a selection wins over an explicit target, which wins over the editing block. Commands add, never toggle.
- [x] **T3.3g** Tag uuids resolved once and cached per session; `addBlockTag(blockId, tagId)`. Detection by id with caching — `block.tags` returns bare `{ id: N }` refs in DB graphs, so names must be resolved per id. Reading `originalName`/`name` off the ref yields `''` and matches nothing, failing as "no tags" rather than erroring. Use `addBlockTag(blockId, tagId)`; `addTag` does not exist.
- [ ] **T3.3f** *(deferred)* Un-conceal a fragment — needs plugin support to lift text back out of the payload property.
- [x] **T3.7** **Collect orphaned payloads.** Found live on block 1058, which kept `{"ma":"robots"}` after its macro was undone away — so undoing a concealment left the text in storage. Now dropped on block change, debounced. A blank title keeps everything, since this deletion is irreversible and a mid-edit read must not wipe a block's payloads. `findMacroKeys` matches on the key without validating flags, so an unparseable macro still protects its payload. 11 tests.
- [x] **T3.4** Reveal-on-click via `provideModel`. `#norobots` alone renders revealed — only `#spoiler` conceals from the human, which is what makes the two axes independent in practice.
- [x] **T3.5** Strip `data-block-title` on spoilered nodes — **scoped down honestly.** It closes one of two channels; the rendered text stays in the DOM because CSS cannot remove it without breaking editing. Leak surface #2 is closed for *fragments* by the storage model, not by this. 5 tests.
- [x] **T3.6** Node-level `#spoiler` — queries tagged uuids, toggles a class per `blockid`, re-applies on a MutationObserver and on tag-touching DB changes (debounced). No observer loop: `concealBlockTitle` reports no-change once concealed.

## Phase 3b — Settings and sharing

- [x] **T3.8** Hover-reveal stays on by default — it is the right everyday behaviour — with two ways to stop an accidental reveal: a setting, and a **`Curtain: lock`** palette command that re-conceals everything revealed this session and disables both hover *and* click until unlocked. The lock exists because the need is momentary (about to share a screen) and hunting through plugin settings at that moment is friction in the wrong place. Reveal state is session-only, never written to the graph.
- [ ] **T3.9** Copying a concealed fragment. `{{renderer :curtain, k7}}` copies as the macro, not the text, which is a real defect. **Storing the text in the macro is not the fix** — E2E-03 passes precisely because the payload is not in `:block/title`, and reversing that reopens seven leak surfaces plus the comma-mangling bug. `onBeforeCommandInvoked('logseq.editor/copy')` is a notification hook with no way to rewrite the clipboard, so interception is out. Options: a "copy with concealed text" command writing to the clipboard directly, or T3.3f un-conceal then copy natively.

## Phase 4 — Agent-side enforcement

- [ ] **T4.1** MCP filter in `logseq-headless-mcp` — the only real enforcement. Hook verified: an injectable pass at `src/server.mjs:169-175`, after `resolveRefs`, before `capResponse`, matching their injection convention. Covers all eight tools; does **not** cover error text or worker-side `get_backlinks` filtering.
- [ ] **T4.1a** Handle the paging hazard: filtering after paging makes `limit: 20` return fewer with no cursor, indistinguishable from "there were only 12". Page after filtering, or report the removed count.
- [ ] **T4.2** Skill instruction honoring the contract.
- [ ] **T4.3** CLI wrapper `--respect-norobots`.

## Phase 5 — Tests

- [ ] **T5.1** One E2E per leak surface asserting the payload string is absent. See [docs/leak-surfaces.md](docs/leak-surfaces.md).
- [ ] **T5.2** CI gate on the surface matrix.
