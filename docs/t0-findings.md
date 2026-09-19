# T0 findings — `:logseq.property/hide?` is not a concealment primitive

Run 2026-09-19 against graph `cliworker`. CLI revision **`127e3bb-dirty`**, which tracks the last-started desktop app — not the `99074899af` source the spec cites. Findings are behavioural; source line references are from `99074899af`.

## Result

**`hide?` is honored by some readers and ignored by others.** It cannot carry either Curtain axis.

| Reader | Honors `hide?` | How established |
|---|---|---|
| `logseq list page` | **yes** | verified — disappears, `--include-hidden` restores |
| `logseq search block` | **no** | verified — returned while `hide? true` |
| `logseq search page` | **no** | verified — returned while `hide? true` |
| Agent tools API | yes | source only (`api/db_based/tools.cljs:92`) |
| **App search** | **yes** | **verified live — T0.3b** |
| Editor render | no | source only — no check in `components/block.cljs` |

## Why this kills the §5 shortcut

The draft assumed `hide?` filters agent read paths while leaving the human's view intact — a ready-made `#norobots`.

The opposite appears to be true. The app's search path filters hidden entities, while **CLI search — a primary agent read path — does not.** So `hide?` would degrade the human's search while leaving the content fully readable by the CLI. Backwards for `#norobots`, and it does not hide from the editor either, so it is not `#spoiler`.

`hide?` remains useful for exactly one thing Curtain needs: removing a page from `list page`.

## Evidence

Fixture on `cliworker`, page `Curtain-T0-Test` (id 1032):

| id | Block | State |
|---|---|---|
| 1033 | `XYZZY-LEAF-1 … TOUCHED` | **`hide? true`** |
| 1034 | `XYZZY-PARENT-2 parent block` | normal |
| 1035 | `XYZZY-CONTROL-9 control block` | normal (control) |
| 1036 | `XYZZY-CHILD-3 child of parent` | child of 1034 |

### T0.1 — hidden leaf still returned by search

```bash
logseq upsert block --graph cliworker --id 1033 \
  --update-properties '{:logseq.property/hide? true}'

logseq search block --graph cliworker --content XYZZY-LEAF-1
# → returned, despite hide? true
```

Write confirmed landed by pulling the entity. Note `upsert` returns `{:result nil}` on success for property updates — not a silent failure, but read back regardless.

### Staleness eliminated

`:block/title` is a reindex-triggering attribute (`worker/search.cljs:1123`), and `hidden-status-changed-eids-for` (`:1116-1120`) exists specifically to reindex on a `hide?` flip. Editing the title forced a reindex; the block was still returned, with `hide? true` intact. So this is a missing filter, not a stale index.

### T0.2 — page hide works for `list`, not for `search`

```bash
logseq upsert page --graph cliworker --id 1032 \
  --update-properties '{:logseq.property/hide? true}'

logseq list page   --graph cliworker                    # → absent
logseq list page   --graph cliworker --include-hidden   # → present
logseq search page --graph cliworker --content Curtain-T0   # → PRESENT (not filtered)
logseq search block --graph cliworker --content XYZZY-CHILD-3  # → PRESENT
```

Blocks on a hidden page are still returned by block search, even though `hidden-entity?` (`worker/search.cljs:536-541`) checks `:block/page`.

## T0.3b — RESOLVED: the inversion is real

Run in the desktop app against the staged fixture (page 1032 visible, block 1033 hidden):

| Canary | State | App search |
|---|---|---|
| `XYZZY-CONTROL-9` | normal | **found** |
| `XYZZY-LEAF-1` | `hide? true` | **not found** |

The app filters hidden blocks from search. The CLI does not. Both directions are now verified, and the conclusion is the harmful one:

> **`hide?` removes content from the human's search while leaving it fully readable by every agent read path.**

Precisely backwards for `#norobots`. Setting it costs the user the ability to find their own content and buys no concealment from agents whatsoever.

## Upstream issue — filed as [logseq/db-test#1237](https://github.com/logseq/db-test/issues/1237)

The asymmetry is now sharp and verified on both sides:

- **App search** filters `hide?` — a user who hides a node sees it disappear from search.
- **CLI `search block` / `search page`** ignore `hide?` entirely.
- `list page` honors it and offers `--include-hidden`; `search` has no such flag.

So hiding a node makes it invisible to its owner while leaving it exposed to anything reading through the CLI — including MCP servers built on it. That reads as a defect, and arguably a privacy one, rather than a deliberate split.

Filed 2026-09-19 as db-test#1237. App and CLI were confirmed to be the same nightly build (`127e3bb-dirty`, base identical to master), so the discrepancy is between two code paths rather than version skew.
