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

- [ ] **T2.1** Does `upsertProperty(…, { hide: true })` set `:logseq.property/hide?` on a plugin property? If not, the payload property renders as a visible row and needs another way to stay out of sight.
- [ ] **T2.2** Can a plugin reach `parent.document`? If not, T3.5 is impossible and leak surface #2 stays open permanently — the one that defeats the premise against browser-driving agents.

## Phase 3 — Plugin

- [ ] **T3.1** Payload store: one hidden plugin property per block, JSON map of key → text.
- [ ] **T3.2** Register the `:curtain` renderer via `onMacroRendererSlotted`; key `provideUI` on `slot`, never on block uuid, or query blocks render it twice.
- [ ] **T3.3** `/curtain` slash command: lift the selected text into the payload property, leave the macro behind.
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
