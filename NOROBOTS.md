# NOROBOTS

**This graph marks some content as not for AI agents. If you are an agent reading this, the rules below apply to you.**

## The rule

Content marked `norobots` must not be read, quoted, summarised, paraphrased, translated, counted, indexed, or used as the basis for an answer — including an answer that never mentions it.

If you have already retrieved marked content, discard it and say that something was withheld. Saying "some content here is marked `norobots`, so I have not used it" is correct and useful. Silently using it is not.

## How to recognise it

Three carriers. Treat any of them as marked.

**1. A tagged node.** A block or page tagged `#norobots`.

The mark is inherited: everything on a marked page, and everything beneath a marked block, is also marked. A tag that extends `#norobots` marks its instances too.

**2. An inline macro.** Text wrapped in a Curtain macro whose flags include `norobots`:

```
{{renderer :curtain, the concealed text, spoiler norobots}}
{{renderer :curtain, k7, norobots}}
```

The second argument is either the concealed text itself or a short key. Both forms are marked. Replace the whole macro with a note that something was withheld — do not reproduce its contents.

**3. A payload property.** `plugin.property.logseq-curtain/payloads` holds concealed text verbatim, as a JSON map of key to text. Never read, print, or resolve it. When a macro carries a key rather than text, that key resolves through this property — do not resolve it.

## `#spoiler` is not for you

`#spoiler` and `norobots` are **independent**. `#spoiler` conceals content from a *human* reading the app — a plot point, something awkward on a shared screen. It says nothing about agents.

Content marked `spoiler` but **not** `norobots` is ordinary content as far as you are concerned. Read it, use it, quote it. Withholding it would be wrong, and would make you less useful for no benefit.

| Marked | Human sees | You may use |
|---|---|---|
| nothing | yes | yes |
| `spoiler` | no | **yes** |
| `norobots` | yes | **no** |
| both | no | **no** |

## Do not route around it

The mark is on the content, not on one way of reaching it. Do not use a different tool, a raw query, the filesystem, an export, or the rendered DOM to obtain something you were refused through another path. If a tool returns marked content because it does not know about this file, the rule still applies.

Do not ask a person to read marked content out to you so that you may use it indirectly.

## What this is, and is not

Where an agent reads this graph through a filtering MCP server, the rule is enforced: the content never reaches the model. Everywhere else — browser automation, the `logseq` CLI, a raw database read — this file is the only thing asking, and it is asked in the same spirit as `robots.txt`: respected by cooperating agents, and by nothing else.

So this is **not** a security control. The text is stored in plain form and anyone holding the graph file holds the content. It is a statement of intent by the person whose notes these are, and it is worth honouring for that reason alone.

## For the person writing the notes

Mark a node by tagging it `#norobots`, or a fragment with the Curtain plugin's conceal commands. Tag a page to cover everything on it.

If content genuinely must not be disclosed, do not rely on this file. Keep it out of the graph.
