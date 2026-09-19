# Leak surfaces

Every place concealed content can escape. Verified against logseq/logseq `99074899af` (2026-09-19) by reading source, not by observation — each row still needs the test in the last column.

The scope decision was **full sweep**, which means every missed surface fails *silently*: the UI looks correct and the content leaks anyway. This inventory exists so that failure mode has somewhere to be caught.

## The table

`inline` = payload sits in `:block/title`. `property` = payload in the plugin property, title holds only the key.

| # | Surface | Source | inline | property | Test |
|---|---|---|---|---|---|
| 1 | Rendered block text | renderer | safe | safe | `E2E-01` |
| 2 | `data-block-title` attribute | `components/block.cljs:4478` | **LEAKS** | safe *(fragments)* / **LEAKS** *(nodes)* | `E2E-02` |
| 3 | Search index | `worker/search.cljs:614` | **LEAKS** | safe | `E2E-03` |
| 4 | Search results UI (cmdk) | `components/cmdk/list_item.cljs:84-97` | **LEAKS** | safe | `E2E-04` |
| 5 | Graph view node labels | `worker/graph_view.cljs` | **LEAKS** | safe | `E2E-05` |
| 6 | Breadcrumbs | `components/block.cljs:3766+` | **LEAKS** | safe | `E2E-06` |
| 7 | Text export | `handler/export/text_impl.cljs:356-366` | **LEAKS** | safe | `E2E-07` |
| 8 | Publish HTML | `deps/publish/.../render.cljs:557-558` | **LEAKS** | safe | `E2E-08` |
| 9 | Linked references | `components/reference.cljs` | **LEAKS** | safe | `E2E-09` |
| 10 | Right sidebar | `components/right_sidebar.cljs` | **LEAKS** | safe | `E2E-10` |
| 11 | CLI output | `cli/common/db_worker.cljs` | **LEAKS** | **LEAKS** | `E2E-11` |
| 12 | MCP / agent tools | `api/db_based/tools.cljs` | **LEAKS** | **LEAKS** | `E2E-12` |
| 13 | db-sync payloads | `deps/db-sync/.../semantic.cljs` | **LEAKS** | **LEAKS** | out of scope (R6) |
| 14 | EDN graph export | `graph export` | **LEAKS** | **LEAKS** | out of scope (R6) |

**Rows 1–10 are closed by one decision** — keeping the payload out of `:block/title`. No plugin code required.

**Rows 11–12 are artifact 3.** Unreachable from the app: no plugin runtime exists in the CLI (`frontend/config.cljs:149-152`).

**Rows 13–14 are documented non-goals.** Concealment, not confidentiality.

## Test shape

One assertion, applied per surface: *the payload string does not appear.*

```
GIVEN a block whose payload is "XYZZY-CANARY-7"
  AND it is tagged #spoiler, or flagged spoiler
WHEN  <surface> is rendered or serialised
THEN  the output does not contain "XYZZY-CANARY-7"
```

A distinctive canary makes a leak unambiguous in any output format. Keep one canary per axis so a `#spoiler`-only node can be asserted *present* for agents while absent for humans — the case a single canary would hide.

## Priority

`E2E-02`, `E2E-03`, `E2E-11` and `E2E-12` first.

Row 2 is the one that defeats the whole premise for browser-driving agents: the pixels show `[•••]` while the raw title sits in a DOM attribute one `getAttribute` away. Rows 11 and 12 are where agents actually read. Row 3 feeds row 4.

## Notes per surface

**2 — `data-block-title`.** Present on every `.ls-block`. Holds `:block/title` verbatim, macro syntax included. Confirmed twice: the attribute assignment, and `has-cloze?` matching `"{{cloze "` against the same field (`fsrs.cljs:151-153`).

The "property" column splits here, and an earlier draft got it wrong by marking the whole row safe on storage alone:

- **Fragments — genuinely closed.** The payload is in a property, so the attribute holds only `{{renderer :curtain, k7, spoiler}}`. Nothing to leak.
- **Nodes — not closed, and not closable from a plugin.** For a `#spoiler` node the block's own title *is* the concealed content. CSS can blur or hide the rendered text but cannot remove it, and removing it would break editing. So the text stays in the DOM and a browser-driving agent reads it whatever the pixels show.

Curtain still rewrites the attribute for spoilered nodes, but that is defence in depth against one of two open channels, **not** a guarantee. `#spoiler` is a human-eyes treatment by design; blocking agents is `#norobots`, enforced in the MCP filter (rows 11–12), never in the DOM.

**3 — Search index.** The pull selector (`worker/search.cljs:611-625`) is a fixed list: `:block/title` plus specific `:logseq.property/*` attributes. Arbitrary property values are never indexed — the property store's main guarantee.

**4 — cmdk results.** Items carry `data-cmdk-item`, `data-hoverable`, `data-highlighted`, `data-testid` — **no uuid**. Results cannot be mapped back to a block from the DOM, so this surface cannot be fixed by interception. It is safe only because of the storage model.

**7 — Text export.** `inline-macro` special-cases cloze to bare arguments (`text_impl.cljs:359-360`); everything else keeps `{{name(args)}}` (361-364). `:curtain` therefore survives export as a visible marker rather than silently unwrapping.

**11–12 — CLI and tools.** An earlier draft expected `:logseq.property/hide?` to close these upstream. **T0 disproved it.** `cli/common/db_worker.cljs:193` is `list-pages`, not search: `logseq search block` and `search page` both return hidden entities, verified on `cliworker`. The agent tools API does filter (`api/db_based/tools.cljs:92`, source only). These rows need artifact 3. See [t0-findings.md](t0-findings.md).
