import { RENDERER_NAME } from './macro'
import { newKey, type PayloadMap } from './payloads'

/**
 * Editing a concealed fragment in place.
 *
 * Un-concealing by deleting the macro means re-selecting and re-running a
 * command to put it back. Instead the text takes the key's place inside the
 * macro, so it can be edited where it sits and the macro survives.
 *
 * Everything here parses the **raw title** rather than mldoc's split
 * arguments. mldoc comma-splits, and rejoining is lossy — `a,b` comes back as
 * `a, b` — so text containing a comma cannot survive that round trip. Reading
 * the raw macro body and treating everything between the first and last comma
 * as the text handles commas without needing to escape them.
 */
const MACRO_BODY = new RegExp(`\\{\\{renderer\\s+:${RENDERER_NAME}\\s*,([^}]*)\\}\\}`, 'g')

/** Split a macro body into its text part and its trailing flags. */
function splitBody(body: string): { text: string; flags: string } | null {
  const lastComma = body.lastIndexOf(',')
  if (lastComma === -1) return null
  return { text: body.slice(0, lastComma).trim(), flags: body.slice(lastComma + 1).trim() }
}

/** Swap each key for its stored text, leaving the macro in place. */
export function inlineFragments(title: string, payloads: PayloadMap): string {
  return title.replace(MACRO_BODY, (macro, body: string) => {
    const parts = splitBody(body)
    if (parts === null) return macro
    const text = payloads[parts.text]
    // Missing payload: leave it exactly as it is rather than blanking it.
    if (text === undefined) return macro
    return `{{renderer :${RENDERER_NAME}, ${text}, ${parts.flags}}}`
  })
}

/**
 * Swap inline text back out for a fresh key, storing the text.
 *
 * A macro is "already keyed" when its text part matches a payload we hold.
 * Anything else is treated as text the user typed in place.
 */
export function extractInlineFragments(
  title: string,
  payloads: PayloadMap,
): { title: string; payloads: PayloadMap; changed: boolean } {
  const next: PayloadMap = { ...payloads }
  let changed = false

  const rewritten = title.replace(MACRO_BODY, (macro, body: string) => {
    const parts = splitBody(body)
    if (parts === null) return macro
    if (parts.text in next) return macro

    const key = newKey(next)
    next[key] = parts.text
    changed = true
    return `{{renderer :${RENDERER_NAME}, ${key}, ${parts.flags}}}`
  })

  return { title: rewritten, payloads: next, changed }
}
