# Curtain — Specification

Status: draft. Source references verified against logseq/logseq `99074899af` (2026-09-19).

## 1. Scope

Curtain conceals graph content along two **independent** axes:

| Axis | Tag | Inline flag | Hides from | Enforced by |
|---|---|---|---|---|
| Human | `#spoiler` | `spoiler` | the app UI | the plugin |
| Agent | `#norobots` | `norobots` | CLI · MCP · browser agents | MCP filter + convention |

Because the axes are independent, two tags express all four states and no third concept is needed:

| Tags | Flags | Human | Agent |
|---|---|---|---|
| — | — | sees | sees |
| `#spoiler` | `spoiler` | **hidden** | sees |
| `#norobots` | `norobots` | sees | **blocked** |
| `#spoiler #norobots` | `spoiler norobots` | **hidden** | **blocked** |

The `#spoiler`-only row is a first-class case, not a degenerate one: content staged for an agent that should not clutter the human's view.

### Non-goals

Curtain filters read paths. It does not encrypt. The payload is plaintext in SQLite, db-sync payloads and EDN exports. Not a control for credentials.

## 2. Vocabulary

### Node level

Tag any node — block, page, journal — with `#spoiler`, `#norobots`, or both.

### Inline fragments

```
{{renderer :curtain, <key>, <flags>}}
```

- `<key>` — short opaque id (`k7`), referencing the payload. **Never the text itself.**
- `<flags>` — space-separated subset of `spoiler norobots`. Same names as the tags.

Flags are space-separated *within one argument* because mldoc comma-splits macro arguments: cloze re-joins with `", "` (`fsrs.cljs:459`) and text export with `","` (`text_impl.cljs:362`).

### Why a renderer and not `{{spoiler}}`

Plugins cannot own arbitrary macro names. The registry `frontend.components.macro/macros` is an internal CLJS atom (`components/macro.cljs:4-10`); only `fsrs.cljs:484` writes to it. Plugins get `{{renderer :name, …}}` via `onMacroRendererSlotted` (`components/block.cljs:1944`). Nesting `{{…}}` inside `{{…}}` is not a supported shape, so two combinable macros are not available — one renderer carrying both flags is.

### Why not reuse `{{cloze}}`

Rejected for three verified reasons:

1. `has-cloze?` (`fsrs.cljs:151-153`) makes any `{{cloze }}` block flashcard-eligible, with no opt-out.
2. Text export **unwraps cloze to bare plaintext, destroying the marker** (`text_impl.cljs:359-360`), while `{{renderer …}}` survives as `{{renderer(...)}}` (lines 361-364).
3. The plugin could never change either behaviour, since cloze is host-registered.

Cloze does one thing well and worth copying: it **substitutes** rather than blurs (`fsrs.cljs:465-473`), rendering `[...]` or `(cue)` so the answer is absent from the DOM. Curtain does the same. Blurring leaves the text in the DOM for any agent to read.

## 3. Storage model

> The payload never appears in `:block/title`.

`:block/title` holds only the macro with its key. The text lives in a hidden plugin property on the same block:

```
:plugin.property.logseq-curtain/payloads   →   {"k7": "the concealed text"}
```

One property per block, a JSON map of key → text, so N fragments per block cost one property.

Two verified reasons this is not optional:

**Commas corrupt inline payloads.** mldoc comma-splits arguments; re-joining normalises `a,b` to `a, b`. A lossy round-trip on the user's own text.

**`:block/title` leaks through seven surfaces at once.** `data-block-title` (`block.cljs:4478`), the search index (`worker/search.cljs:614`), cmdk results, graph labels, breadcrumbs, text export, publish HTML. Moving the payload out closes all seven with one decision — the highest-leverage choice in the design. Full inventory in [leak-surfaces.md](leak-surfaces.md).

The search index selector is a **fixed list** of `:block/title` plus specific `:logseq.property/*` attributes (`worker/search.cljs:611-625`). Arbitrary property values are not indexed, which is exactly why the property is a safe home.

The payload property sets `:hide? true` at creation so it does not clutter the property area (`components/property/value.cljs:337` skips hidden properties). Pending verification — T0.4.

## 4. Architecture

Three enforcement layers; the plugin reaches only one.

| Layer | Who reads | Plugin reach |
|---|---|---|
| App renderer | human eyes | **yes** |
| Graph DB (SQLite) | CLI, MCP, export, sync | **no** |
| Agent behaviour | Claude, bots | **no** — convention |

Plugins are gated on `util/plugin-platform?` (`frontend/config.cljs:149-152`) and nothing under `src/main/logseq/cli/` references them. So `#norobots` **cannot** be a plugin feature. Four artifacts:

1. **Vocabulary spec** — this document. Keystone; the other three encode it.
2. **Plugin** — the `#spoiler` axis and the `:curtain` renderer.
3. **MCP filter** in `logseq-headless-mcp` — the only place `#norobots` becomes real enforcement.
4. **Skill + CLI wrapper** — the portable contract.

## 5. What upstream provides — and what it does not

`:logseq.property/hide?` looked like a ready-made `#norobots`. **T0 testing disproved that** — see [t0-findings.md](t0-findings.md).

It is honored inconsistently across readers:

| Reader | Honors `hide?` | Evidence |
|---|---|---|
| `logseq list page` | **yes** | verified on `cliworker` |
| `logseq search block` | **no** | verified — returned while `hide? true` |
| `logseq search page` | **no** | verified — returned while `hide? true` |
| Agent tools API | yes | source only (`api/db_based/tools.cljs:92`) |
| **App search** | **yes** | **verified live (T0.3b)** |
| Editor render | no | source only — no check in `components/block.cljs` |

The CLI, a primary agent read path, ignores it, while the app's search appears to honor it. That is the reverse of what `#norobots` needs: it would degrade the *human's* search while leaving content fully readable by agents. And since the editor never checks it, it is not `#spoiler` either.

**Decision: Curtain does not use `hide?` to carry either axis.** Artifact 3 does the work for `#norobots`; the plugin does the work for `#spoiler`.

T0.3b settled the remaining question in the harmful direction: the app **does** filter hidden blocks from search, while the CLI does not. So `hide?` costs the user the ability to find their own content and buys no concealment from agents.

**Curtain therefore never sets `hide?`.** The earlier "defence in depth on `#norobots` pages" idea is dropped: it carries the same human cost, and a single uniform mechanism in artifact 3 is one clear code path instead of two partial ones.

There is no UI path to set it on a node: the picker strips built-ins lacking `:logseq.property/public?` (`worker/handler/property.cljs:346-351`), and `hide?` is not public (`deps/db/.../property.cljs:46-48`). The only UI toggle targets *properties* (`components/property/config.cljs:951`). Set it from a plugin or the console — qualified idents pass through `get-db-ident-from-property-name` unchanged (`api/block.cljs:53-66`).

## 6. Plugin design

```
src/
├── index.ts       entry, registration
├── renderer.ts    :curtain macro, reveal state
├── nodes.ts       #spoiler node hiding
├── store.ts       payload property read/write
├── flags.ts       flag parsing (pure, unit-tested)
└── settings.ts
```

Constraints that shape it, all verified:

- **`.ls-block` carries no tag information** (`block.cljs:4477-4493`). Node hiding cannot be pure CSS; the plugin queries tagged nodes and injects rules keyed by `blockid`.
- **cmdk result items carry no uuid** (`cmdk/list_item.cljs:84-97`) — only presentational attributes. Search results cannot be mapped back to a block from the DOM. This is the weakest surface.
- **Query-class blocks mount the same macro in several slots.** Key `provideUI` on `slot`, never on block uuid, or the UI renders twice.
- **`data-block-title` must be stripped** on concealed blocks, or a browser agent reads the raw title while the pixels show `[•••]`.

Everything past the editor — search results, breadcrumbs, graph labels — is reachable only through CSS plus a `MutationObserver` on `parent.document`. That is fragile by construction: an upstream class rename breaks it **silently**. Hence the per-surface tests.

## 6a. Commands

Two commands, one per axis: `/spoiler` and `/norobots`. Combining them means
running both, exactly as `#spoiler #norobots` combine on a node. Adding a third
axis later costs one command, not a new row in a combination table.

Plus `/veil`, defined as **every axis** — not as "spoiler + norobots". Phrased
that way it is not a combination command and does not reopen the combinatorial
problem: "conceal from everyone" stays one stable concept however many axes
exist, whereas a `/spoiler-norobots` style name would multiply.

`/veil` is a **command, not a tag.** It applies `#spoiler` and `#norobots`.
There is no `#veil` tag; introducing one would mean three tags for two axes and
immediate drift between them.

Both commands **add**; they never toggle. Logseq already removes a tag through
its own UI, so a toggle would duplicate that and introduce partial-state
questions across multi-block selections. Un-concealing a *fragment* does need
plugin support (the text must come back out of the payload property) and is
deferred to its own command.

### Entry points split by target, not by context

An earlier draft had one command dispatching on whether a selection existed.
That cannot work: **typing `/` replaces the current selection**, so by the time
a slash command fires there is no selection left to act on. A context-sensitive
command would have silently tagged the whole node every time the user meant to
conceal a fragment — the worst kind of failure, because it looks like it worked.

So the target is decided by *how* the command is invoked:

| Invocation | Target | Why it works |
|---|---|---|
| Keyboard shortcut (`mode: 'editing'`) | the selected fragment | a modifier chord leaves the selection intact |
| Slash command | the whole node | nothing is selected by then anyway |
| Block / page menu | that node | no selection involved |

The shortcut path also makes staleness nearly moot — the selection is live at
the moment the chord is pressed. `isSelectionUsable` still earns its place for
the gap between the selection event and the keypress, but it is no longer
carrying the whole design.

### The typed trigger is not removed for you

`editor/clear-current-slash` exists only as a `SlashCommandAction`, which rules
out a dynamic callback, and it is absent from `ExternalCommandType` so it
cannot be invoked directly either. The node path therefore strips a trailing
`/<trigger>` itself, and only a trailing one, so a block that merely mentions
`/spoiler` is untouched. Harmless if the host did already strip it.

### The remembered selection

There is no "get current selection" API. `Editor.onInputSelectionEnd` is an
*event* carrying `{ start, end, text }`, and `BlockCursorPosition` exposes only
a caret offset with no range. So the plugin must remember the last selection
and act on it later, which means it can go stale.

All staleness rules live in one **pure predicate**, so the risk is tested
rather than scattered through event handlers:

```ts
isSelectionUsable(remembered, { blockUuid, content, now }): boolean
```

A remembered selection is discarded when:

| # | Condition | Why |
|---|---|---|
| 1 | Its block is not the block being edited | the user moved on |
| 2 | `content.slice(start, end) !== text` | the user edited; offsets no longer mean what they meant |
| 3 | Older than the staleness window | a selection from minutes ago is not an intent |
| 4 | It has already been used | *enforced by construction* — `consume()` always clears, usable or not, so a used selection cannot exist to be checked |

Rule 2 is the load-bearing one: it catches every edit without needing to
observe the edit, because it re-derives the truth from current content.

Two subtleties the implementation has to respect. Bounds are checked *before*
slicing, because `slice()` truncates silently rather than throwing — an `end`
past the content length would otherwise satisfy rule 2 by accident. And
`consume()` clears even when it rejects, so a selection that failed in one
context cannot linger and be reconsidered in another.

### Entry points

| Surface | API | Scope |
|---|---|---|
| Slash command | `registerSlashCommand` + `checkEditing` | current block |
| Keyboard shortcut | `App.registerCommandShortcut`, `mode: 'editing'` | selected fragment |
| Block context menu | `registerBlockContextMenuItem` | that block |
| Page menu | `registerPageMenuItem` | that page |
| Multi-block selection | `getSelectedBlocks` | every selected block |

There is no native text prompt — only `showMsg` — so any future input UI has
to be built with `provideUI`. The remembered-selection design avoids needing
one at all, which is a large part of its appeal.

### Applying tags

`addBlockTag(blockId, tagId)` — verified in the SDK typings; `addTag` does not
exist. Detection cannot read tag names off a block directly: in DB graphs
`block.tags` comes back as bare `{ id: N }` refs with no name fields, so names
must be resolved by id and cached. Code that reads `tag.originalName ?? tag.name`
off a list item silently yields `''` and matches nothing — a failure that looks
like "no tags" rather than an error.

### Why the payload property is typed `:string`

`:string` is not a UI-available property type. It is one of
`user-allowed-internal-property-types` (`#{:map :json :string}`), reachable only
through the API or EDN. That is a small bonus: a user cannot accidentally create
a conflicting property of this type through the UI.

`:json` would describe the payload map more honestly, but the host may then hand
back a parsed object rather than the string `parsePayloads` expects. `:string`
is proven working (T2.1); `:json` is unverified. Worth revisiting only if the
value shape ever matters.

## 7. Agent-side enforcement

**MCP filter (real).** In `logseq-headless-mcp`, before results leave the server: drop nodes tagged `#norobots` and those inheriting it; strip `payloads` entries whose flags include `norobots`; replace concealed fragments with a marker so the model knows something was withheld rather than seeing a malformed sentence.

**Convention (honor system).** `NOROBOTS.md`, pointed at from the graph root:

> Content tagged `#norobots`, and fragments flagged `norobots`, must not be read, quoted, summarised or acted on. If you cannot avoid retrieving it, discard it and say so.

**CLI wrapper.** `--respect-norobots` filtering CLI output. Needs a wrapper you own or an upstream change; there is no plugin runtime in the CLI.

## 8. Risks and open questions

| # | Item | Resolution |
|---|---|---|
| R1 | ~~`hide?` as the `#norobots` mechanism~~ | **closed — disproved by T0**, §5 rewritten |
| R2 | DOM interception breaks silently on upstream renames | per-surface E2E, CI gate |
| R3 | Search results have no uuid to key off | accept; rely on payload-out-of-title |
| R4 | `hide?` side effects on markdown-mirror and db-sync | T0.6 |
| R5 | Plugin property may still reach CLI/MCP output | artifact 3 strips it |
| R6 | A `#norobots` node is still plaintext in EDN export | documented non-goal |
| R7 | Agents outside the MCP path ignore the contract | documented; robots.txt model |
| R8 | CLI `search` ignores `hide?` while `list page` honors it | filed upstream as [db-test#1237](https://github.com/logseq/db-test/issues/1237) |
| R9 | ~~App-side search behaviour unverified~~ | **closed — T0.3b confirmed the inversion** |
