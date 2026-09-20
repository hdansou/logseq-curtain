# Parked: propose `--respect-norobots` to the official Logseq CLI

**Status:** parked, not built. To be proposed upstream rather than shipped as a
wrapper.

**Where it goes:** *not* a `db-test` GitHub issue. That repo disables blank
issues and its `config.yml` routes DB-version feature requests to Discord
`#db-feedback`. Worth re-checking before posting — that was read on 2026-09-19.

## Why a wrapper was the wrong shape

Curtain can enforce `#norobots` in one place only: a filtering MCP server,
where the pass sits between the tool result and the model. Everything else —
the `logseq` CLI, browser automation, a direct database read — is governed by
convention alone.

A wrapper around the CLI would have closed the CLI path for this graph, on this
machine, for whoever remembered to invoke the wrapper instead of the real
binary. That is the weakest possible form of the guarantee: it protects the
careful and misses everyone else, while implying more than it delivers.

Upstream, the same idea is worth much more. Any agent reading any graph through
the official CLI would inherit it.

## The request

> **Add an opt-in flag that excludes content the user has marked as not for AI
> agents.**
>
> A convention is emerging for marking graph content that should not be fed to
> an AI agent — a tag on a node, or a marker inside a block. The DB CLI is a
> common way for agents to read a graph, and today it has no way to honour such
> a mark.
>
> Concretely: a flag such as `--respect-norobots` on the read commands
> (`search`, `list`, `show`, `query`) that drops nodes carrying a designated
> tag, together with everything inheriting from them, and reports how many were
> withheld.
>
> **The count matters as much as the filtering.** A list that silently comes
> back shorter than the `--limit` asked for cannot be distinguished from one
> that simply had fewer matches. Filtering without reporting turns a privacy
> feature into a correctness bug.
>
> There is precedent in the codebase: `logseq list page` already filters on
> `:logseq.property/hide?` and offers `--include-hidden` to opt back in. The
> same shape would fit.

## Related, and worth mentioning in the same conversation

`logseq/db-test#1237` — the `search` subcommands ignore `:logseq.property/hide?`
while `list page` honours it. So a node the user hid is invisible to them and
still visible to anything reading through the CLI. Any work on this proposal
would likely touch the same code path, and the inconsistency is an argument for
doing both at once.

## If upstream declines

Fall back to documentation rather than a wrapper: `NOROBOTS.md` and
`agent/curtain-norobots/SKILL.md` already state the contract, and a wrapper
would add a false sense of enforcement without meaningfully more coverage.
