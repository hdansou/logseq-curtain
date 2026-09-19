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
- [x] **T1.3** Key format — short base36, unique within a block only, so keys stay short enough to read in raw text. Length grows if a crowded block keeps colliding. Delivered with the payload store.
- [x] **T1.4** [`NOROBOTS.md`](NOROBOTS.md) — states the rule, the three carriers (tagged node with inheritance, inline macro, payload property), and explicitly that `#spoiler` alone is *not* for agents, since a contract that conflated the axes would make an agent withhold content it should use. Also forbids routing around the mark through another tool, and is honest that it is `robots.txt`-shaped rather than a security control.

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
- [x] **T3.3f** Edit in place — `Curtain: edit concealed text in place` puts the text *inside* its own macro rather than deleting the macro, so editing is just editing and re-concealing needs no second command. Writes the title before dropping payloads, the reverse of concealing and for the same reason.
- [x] **T3.11** ~~Self-healing round trip~~ — **reverted.** Auto-extracting inline text back to a property fought whoever was editing: type inline, click away, and it re-keyed under you. Inline is a *mode*, not a transient state.
- [x] **T3.15** `/conceal` — inserts `{{renderer :curtain, , spoiler norobots}}` and drops the cursor in the empty reference slot via `editBlock(uuid, { pos })`. Covers what the palette command cannot: concealing text not yet written, where there is no selection. The slot is left empty rather than pre-filled, because there is no API to *select* inserted text, only to place a caret — a placeholder would have to be deleted by hand. Necessarily produces an inline fragment; converting to a property is one command. 5 tests.
- [x] **T3.13** `Curtain: un-conceal (remove the curtain)` — ends concealment and leaves plain text, distinct from converting between storage modes, which keeps it concealed. Works in both modes.
- [x] **T3.14** `revealFragments` handles inline mode. It previously substituted only when the reference named a stored payload, so inline macros were left untouched and could never be removed. One consequence: a reference naming no payload is now treated as the text, because with two modes a lost-payload macro is indistinguishable from an inline fragment whose text is short. Macro-body parsing is now shared with `inline.ts` rather than duplicated.
- [x] **T3.12** Two storage modes, chosen by the user:
  - **property** (default) — `{{renderer :curtain, ur, spoiler norobots}}`, text in a hidden property. Strongest: out of `:block/title`, so out of search, exports and the graph view.
  - **inline** — `{{renderer :curtain, humans and robots, spoiler norobots}}`, text in the macro. Editable in place and copies natively, but it *is* in the block title and therefore visible to search and exports. Commas normalise (`a,b` → `a, b`) because mldoc splits on them.

  A setting picks the mode for new fragments; two commands convert existing ones either way. The renderer resolves the middle argument through the payloads and falls back to treating it as literal text, so both forms render without a flag.
- [x] **T3.7** **Collect orphaned payloads.** Found live on block 1058, which kept `{"ma":"robots"}` after its macro was undone away — so undoing a concealment left the text in storage. Now dropped on block change, debounced. A blank title keeps everything, since this deletion is irreversible and a mid-edit read must not wipe a block's payloads. `findMacroKeys` matches on the key without validating flags, so an unparseable macro still protects its payload. 11 tests.
- [x] **T3.4** Reveal-on-click via `provideModel`. `#norobots` alone renders revealed — only `#spoiler` conceals from the human, which is what makes the two axes independent in practice.
- [x] **T3.5** Strip `data-block-title` on spoilered nodes — **scoped down honestly.** It closes one of two channels; the rendered text stays in the DOM because CSS cannot remove it without breaking editing. Leak surface #2 is closed for *fragments* by the storage model, not by this. 5 tests.
- [x] **T3.6** Node-level `#spoiler` — queries tagged uuids, toggles a class per `blockid`, re-applies on a MutationObserver and on tag-touching DB changes (debounced). No observer loop: `concealBlockTitle` reports no-change once concealed.

## Phase 3c — Spoiling a whole page

- [x] **T3.16** Tagging a page conceals its content, not just its title. Verified against a live graph before wiring: the query goes from 5 uuids to 7, picking up both blocks on the tagged page. `:block/page` covers a page's whole tree at any depth, so no recursion is needed there.
- [x] **T3.17** Deeper descendants of a tagged block are concealed. Rules remain unusable through the bridge — inputs serialise as JSON, which cannot express a rule's symbols — so the descent is finished in JS over the parent edges of the pages holding a tagged block, a bounded set rather than the whole graph. The walk climbs from each node to the first seed, so one pass answers for every node and the result does not depend on query order; a `seen` set bounds it against malformed data. 10 tests.

## Phase 3b — Settings and sharing

- [x] **T3.8** Hover-reveal stays on by default — it is the right everyday behaviour — with two ways to stop an accidental reveal: a setting, and a **`Curtain: lock`** palette command that re-conceals everything revealed this session and disables both hover *and* click until unlocked. The lock exists because the need is momentary (about to share a screen) and hunting through plugin settings at that moment is friction in the wrong place. Reveal state is session-only, never written to the graph.
- [x] **T3.9** `Curtain: copy with concealed text` — restores payloads into the copied text and leaves the graph untouched, so a concealed block can be shared alongside ordinary ones. Same `revealFragments` as un-conceal, written to the clipboard rather than the graph, so the two cannot drift.
- [x] **T3.10** **Verified: EDN export does not lose concealed text.** Both `:graph` and `:graph-human` exports of a graph with concealed fragments preserve the payload property *and* the macro. Concealing never destroys data at the graph level.

## Phase 4 — Agent-side enforcement

- [ ] **T4.1** MCP filter in `logseq-headless-mcp` — the only real enforcement. Hook verified: an injectable pass at `src/server.mjs:169-175`, after `resolveRefs`, before `capResponse`, matching their injection convention. Covers all eight tools; does **not** cover error text or worker-side `get_backlinks` filtering.
- [ ] **T4.1a** Handle the paging hazard: filtering after paging makes `limit: 20` return fewer with no cursor, indistinguishable from "there were only 12". Page after filtering, or report the removed count.
- [x] **T4.2** [`agent/`](agent/) — a self-contained skill whose description triggers *before* the first graph read (afterwards is too late to avoid retrieval), a paste-able `CLAUDE.md`/`AGENTS.md` block, and the option of putting `NOROBOTS.md` in the graph root. The skill repeats the rule rather than linking it, because an agent may never fetch the other file.
- [ ] **T4.3** CLI wrapper `--respect-norobots`.

## Phase 5 — Tests

- [ ] **T5.1** One E2E per leak surface asserting the payload string is absent. See [docs/leak-surfaces.md](docs/leak-surfaces.md).
- [ ] **T5.2** CI gate on the surface matrix.
