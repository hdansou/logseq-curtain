---
name: curtain-norobots
version: 1.0.0
description: Honour the `norobots` mark when reading a Logseq graph. TRIGGER before reading, querying, searching, summarising, exporting or answering from any Logseq graph content — through the `logseq` CLI, an MCP server, browser automation, or the graph files directly — and read it BEFORE the first read, not after. Some content is marked as not for AI agents. This states what the mark looks like, what to do with content already retrieved, and why `#spoiler` alone is NOT a reason to withhold anything.
---

# Honouring `norobots` in a Logseq graph

Some people mark part of their Logseq graph as not for AI agents. This is how that mark looks and what it asks.

Read this before the first read of graph content. Afterwards is too late to avoid retrieving it — though the rule below still applies to what you already have.

## The rule

Content marked `norobots` must not be read, quoted, summarised, paraphrased, translated, counted, indexed, or used as the basis for an answer — including an answer that never mentions it.

Already retrieved it? Discard it and say so. *"Some content there is marked `norobots`, so I have not used it"* is correct and useful. Silently using it is not.

## Recognising the mark

**A tagged node** — a block or page tagged `#norobots`. Inherited: everything on a marked page, and everything beneath a marked block. A tag extending `#norobots` marks its instances too.

**An inline macro** whose flags include `norobots`:

```
{{renderer :curtain, the concealed text, spoiler norobots}}
{{renderer :curtain, k7, norobots}}
```

The second argument is either the text itself or a short key. Both are marked. Replace the whole macro with a note that something was withheld.

**A payload property** — `plugin.property.logseq-curtain/payloads`, a JSON map of key to text holding concealed text verbatim. Never read, print, or resolve it. When a macro carries a key, it resolves through this property; do not resolve it.

## `#spoiler` alone is not for you

The two marks are **independent**. `#spoiler` conceals from a *human* reading the app — a plot point, something awkward on a shared screen. It says nothing about agents.

| Marked | Human sees | You may use |
|---|---|---|
| nothing | yes | yes |
| `spoiler` | no | **yes** |
| `norobots` | yes | **no** |
| both | no | **no** |

Withholding `spoiler`-only content is a mistake: it costs the person a useful answer and protects nothing.

## Do not route around it

The mark is on the content, not on one way of reaching it. Do not use a different tool, a raw datascript query, the filesystem, an export, or the rendered DOM to obtain what you were refused elsewhere. If a tool hands you marked content because it does not know about this rule, the rule still applies.

Do not ask a person to read marked content aloud so you can use it indirectly.

## What this is

Through a filtering MCP server the rule is enforced and marked content never reaches you. Everywhere else — CLI, browser automation, a raw database read — this instruction is the only thing asking, in the same spirit as `robots.txt`.

It is not a security control; anyone holding the graph file holds the text. It is a statement of intent by the person whose notes these are, which is reason enough.

A graph may carry its own `NOROBOTS.md` at the root. If present, prefer it — it is that graph's canonical statement.
