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
- [ ] **T3.2** Register the `:curtain` renderer via `onMacroRendererSlotted`; key `provideUI` on `slot`, never on block uuid, or query blocks render it twice.
- [x] **T3.3a** Selection memory + `isSelectionUsable` — 17 tests, written first. Rules 1–3 checked; rule 4 is enforced by construction since `consume()` always clears. Bounds are validated before slicing because `slice()` truncates silently.
- [ ] **T3.3b** `/spoiler`, `/norobots` and `/veil` slash commands with fragment-or-node dispatch. `/veil` means *every axis* and is a command, not a tag — it applies both tags, so no `#veil` ever exists.
- [ ] **T3.3c** Block context menu items (`registerBlockContextMenuItem`).
- [ ] **T3.3d** Page menu items (`registerPageMenuItem`) — needed for the page/journal half of the scope.
- [ ] **T3.3e** Multi-block selection (`getSelectedBlocks`); commands add, never toggle.
- [ ] **T3.3g** Tag detection by id with caching — `block.tags` returns bare `{ id: N }` refs in DB graphs, so names must be resolved per id. Reading `originalName`/`name` off the ref yields `''` and matches nothing, failing as "no tags" rather than erroring. Use `addBlockTag(blockId, tagId)`; `addTag` does not exist.
- [ ] **T3.3f** *(deferred)* Un-conceal a fragment — needs plugin support to lift text back out of the payload property.
- [ ] **T3.4** Reveal-on-click for `spoiler`; `norobots`-only stays visible to the human.
- [ ] **T3.5** Strip `data-block-title` on concealed blocks (leak surface #2).
- [ ] **T3.6** Node-level `#spoiler`: query tagged nodes, inject CSS keyed by `blockid` (`.ls-block` carries no tag information).

## Phase 4 — Agent-side enforcement

- [ ] **T4.1** MCP filter in `logseq-headless-mcp`: drop `#norobots` nodes, strip payload properties. The only real enforcement.
- [ ] **T4.2** Skill instruction honoring the contract.
- [ ] **T4.3** CLI wrapper `--respect-norobots`.

## Phase 5 — Tests

- [ ] **T5.1** One E2E per leak surface asserting the payload string is absent. See [docs/leak-surfaces.md](docs/leak-surfaces.md).
- [ ] **T5.2** CI gate on the surface matrix.
