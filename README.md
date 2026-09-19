# Curtain

Conceal parts of a Logseq DB graph along two independent axes: from **human eyes** in the app, and from **AI agents** reading the graph through the CLI, MCP or browser automation.

```
#spoiler     hidden from humans, agents still read it
#norobots    humans still read it, withheld from agents
both         hidden from everyone
neither      ordinary content
```

Inline fragments use the same two flags:

```
{{renderer :curtain, k7, spoiler}}
{{renderer :curtain, k7, norobots}}
{{renderer :curtain, k7, spoiler norobots}}
```

## What Curtain is not

Curtain is **concealment, not confidentiality.** It filters read paths; it does not encrypt anything. The payload sits in plaintext in SQLite, in db-sync payloads and in EDN exports, so anyone holding the graph file holds the content.

Use it for spoilers, screenshares, demo graphs, and keeping agents from ingesting content you would rather they skip. Do not use it for credentials.

The `#norobots` axis is an honor system with one exception. Agents that route through a filtering MCP server genuinely never receive the content; every other agent is trusted to respect the tag, exactly as with `robots.txt`.

## Documentation

- [docs/SPEC.md](docs/SPEC.md) — vocabulary, storage model, architecture
- [docs/leak-surfaces.md](docs/leak-surfaces.md) — verified leak inventory and the test matrix
- [TASKS.md](TASKS.md) — build order
