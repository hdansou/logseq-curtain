# Changelog

## 1.0.0

First release.

### Concealing from people

- Conceal a selected fragment from the command palette, or `/conceal` to
  conceal text as you type it.
- Tag a block, page or journal `#spoiler`. Tagging a page covers everything
  written on it, at any depth; tagging a block covers its whole subtree.
- Blurred nodes reveal on hover, which can be turned off. **`Curtain: lock`**
  re-conceals everything revealed this session and stops both hover and click
  until unlocked — one action before sharing a screen.

### Withholding from agents

- Tag a node `#norobots`, or flag a fragment with it.
- Enforced for anything reading through a filtering MCP server: marked content
  and tagged nodes never reach the model, and the filter fails closed.
- Everywhere else it is a convention. [NOROBOTS.md](NOROBOTS.md) states it and
  `agent/` explains how to point agents at it.

### Two storage modes

- `property` (default) keeps concealed text out of the block title, and so out
  of search, exports and the graph view.
- `inline` keeps it in the macro: editable in place and copies natively, but
  visible to search. Commas are normalised in this mode.
- Two commands convert existing fragments either way.

### Also

- `Curtain: un-conceal` removes a curtain and leaves plain text.
- `Curtain: copy with concealed text` copies blocks with their text restored,
  leaving the graph untouched.
- Orphaned payloads are collected when a macro is edited or undone away, so
  undoing a concealment does not leave the text in storage.
