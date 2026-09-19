# Pointing agents at the contract

[`NOROBOTS.md`](../NOROBOTS.md) states what the `norobots` mark asks of an AI
agent. It only works if agents see it, and the ones that most need to are
exactly those that bypass a filtering MCP server — the CLI, browser
automation, a raw database read.

Three ways to point them at it, cheapest first.

## 1. A line in `CLAUDE.md` / `AGENTS.md`

Paste into the file at the root of any project whose agents touch this graph:

```markdown
## Logseq: the `norobots` mark

Some content in this graph is marked as not for AI agents. Before reading,
querying, searching, summarising or exporting any Logseq graph content, read
`NOROBOTS.md` at the graph root and honour it. In short: content tagged
`#norobots`, content beneath it, and Curtain macros whose flags include
`norobots` must not be read, quoted, summarised or used. `#spoiler` alone is
*not* a reason to withhold anything — it hides from human eyes, not from you.
```

## 2. The skill

[`curtain-norobots/SKILL.md`](curtain-norobots/SKILL.md) is self-contained, so
it works even where the graph's own `NOROBOTS.md` is never fetched. Install it
for Claude Code with:

```sh
ln -s "$PWD/agent/curtain-norobots" ~/.claude/skills/curtain-norobots
```

Its description is written to trigger *before* the first read rather than after,
which is the only point at which honouring the mark can still avoid retrieval.

## 3. In the graph itself

Put a copy of `NOROBOTS.md` in the graph root, and a block on the home page
pointing at it. An agent exploring the graph meets the contract early, without
anyone having configured anything.

## What none of this achieves

An agent that does not read the instruction, or chooses not to follow it, is
unaffected. Only the MCP filter enforces anything. If content genuinely must
not be disclosed, keep it out of the graph.
