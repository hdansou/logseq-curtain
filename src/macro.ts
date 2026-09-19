import { formatFlags, parseFlags, type Audience } from './flags'

/**
 * The inline macro: `{{renderer :curtain, <key>, <flags>}}`.
 *
 * The key references the payload property; the text itself is never here.
 * Flags are space-separated inside ONE argument because mldoc comma-splits
 * macro arguments — separate arguments would work, but keeping the axes
 * together mirrors how the tags read and leaves the key in a fixed position.
 */
export const RENDERER_NAME = 'curtain'

const MACRO_PATTERN = new RegExp(
  `\\{\\{renderer\\s+:${RENDERER_NAME}\\s*,\\s*([a-z0-9]+)\\s*,\\s*([a-z][a-z\\s]*?)\\s*\\}\\}`,
)

/** Render a macro. Throws if no axis is set: concealing from nobody is a bug. */
export function formatMacro(key: string, audience: Audience): string {
  const flags = formatFlags(audience)
  if (flags === '') throw new Error('Cannot format a Curtain macro with no axis set')
  return `{{renderer :${RENDERER_NAME}, ${key}, ${flags}}}`
}

/**
 * Read the first Curtain macro in some text, or null if there is none.
 *
 * An unknown flag throws rather than returning null: a macro that exists but
 * cannot be understood must not be treated as ordinary text, which would
 * reveal the payload it was meant to conceal.
 */
export function parseMacro(text: string): { key: string; audience: Audience } | null {
  const match = MACRO_PATTERN.exec(text)
  if (match === null) return null
  const [, key, flags] = match
  return { key, audience: parseFlags(flags) }
}

/** Replace `[start, end)` with the macro. The range is validated upstream. */
export function spliceMacro(content: string, start: number, end: number, macro: string): string {
  return content.slice(0, start) + macro + content.slice(end)
}

/**
 * Remove the typed `/command` text from the end of a block.
 *
 * The host does not reliably strip it before the callback runs, and
 * `editor/clear-current-slash` is not reachable through
 * `invokeExternalCommand` — it exists only as a `SlashCommandAction`, which
 * rules out a dynamic callback. Only a trailing occurrence is removed, so
 * a block that merely talks about `/spoiler` is left alone. A no-op if the
 * host did already strip it.
 */
export function stripSlashTrigger(content: string, trigger: string): string {
  const suffix = `/${trigger}`
  return content.endsWith(suffix) ? content.slice(0, -suffix.length) : content
}

/**
 * Read the already-split argument form the renderer hook receives.
 *
 * mldoc comma-splits macro arguments before the host calls the renderer, so
 * `{{renderer :curtain, k7, spoiler norobots}}` arrives as
 * `[':curtain', 'k7', 'spoiler norobots']` rather than as raw text.
 */
export function parseMacroArguments(
  args: readonly string[],
): { key: string; audience: Audience } | null {
  const [name, key, flags] = args.map((argument) => argument.trim())
  if (name !== `:${RENDERER_NAME}`) return null
  if (!key || flags === undefined) return null
  return { key, audience: parseFlags(flags) }
}

/**
 * Every Curtain key referenced by a block's title.
 *
 * Deliberately looser than `parseMacro`: it matches on the key alone and does
 * not validate flags. This drives payload deletion, so a macro that cannot be
 * fully parsed must still protect its payload rather than orphan it.
 */
export function findMacroKeys(title: string): string[] {
  const pattern = new RegExp(`\\{\\{renderer\\s+:${RENDERER_NAME}\\s*,\\s*([a-z0-9]+)`, 'g')
  return Array.from(title.matchAll(pattern), (match) => match[1])
}
