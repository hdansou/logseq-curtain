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
 *
 * The middle is a *reference*: a payload key in keyed mode, or the concealed
 * text itself in inline mode. Inline text containing commas arrives as several
 * arguments, so the middle is rejoined. Note that rejoin normalises `a,b` to
 * `a, b` — the documented cost of inline mode.
 */
export function parseMacroArguments(
  args: readonly string[],
): { reference: string; audience: Audience } | null {
  const parts = args.map((argument) => argument.trim())
  if (parts[0] !== `:${RENDERER_NAME}` || parts.length < 3) return null

  // Flags are always last. Everything between the name and the flags is the
  // reference — a key in keyed mode, or the text itself in inline mode, which
  // mldoc will have split on every comma it contains.
  const flags = parts[parts.length - 1]
  const reference = parts.slice(1, -1).join(', ')
  if (reference === '') return null
  return { reference, audience: parseFlags(flags) }
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

/**
 * A fresh global matcher for macro bodies — everything between
 * `{{renderer :curtain,` and `}}`.
 *
 * Returned fresh each call because a global regex carries `lastIndex`, and a
 * shared instance would skip matches on its second use.
 */
export const macroBodyPattern = (): RegExp =>
  new RegExp(`\\{\\{renderer\\s+:${RENDERER_NAME}\\s*,([^}]*)\\}\\}`, 'g')

/**
 * Split a macro body into its reference and its trailing flags.
 *
 * Flags are always last, so everything before the final comma is the
 * reference — a payload key in keyed mode, or the text itself in inline mode,
 * commas and all.
 */
export function splitMacroBody(body: string): { reference: string; flags: string } | null {
  const lastComma = body.lastIndexOf(',')
  if (lastComma === -1) return null
  return { reference: body.slice(0, lastComma).trim(), flags: body.slice(lastComma + 1).trim() }
}

/**
 * Replace a typed `/trigger` with an empty macro, and say where the cursor goes.
 *
 * For concealing text that has not been written yet, where there is nothing to
 * select. The reference slot is left empty rather than pre-filled: there is no
 * API to *select* inserted text, only to place a caret, so a placeholder would
 * have to be deleted by hand before typing over it.
 *
 * Returns null unless the trigger is at the end, so a block merely discussing
 * `/conceal` is untouched.
 */
export function insertMacroAtTrigger(
  content: string,
  trigger: string,
  flags: string,
): { content: string; cursor: number } | null {
  const suffix = `/${trigger}`
  if (!content.endsWith(suffix)) return null

  const before = content.slice(0, -suffix.length)
  const opening = `{{renderer :${RENDERER_NAME}, `
  return {
    content: `${before}${opening}, ${flags}}}`,
    cursor: before.length + opening.length,
  }
}
