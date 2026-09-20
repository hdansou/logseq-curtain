import { findMacroKeys, macroBodyPattern, splitMacroBody } from './macro'

/**
 * The payload store: concealed text, keyed, kept out of `:block/title`.
 *
 * A block's payloads live in one hidden plugin property as a JSON map, so N
 * fragments cost one property. The block's title holds only the macro and its
 * key, which is what keeps the text out of `data-block-title`, the search
 * index, graph labels, breadcrumbs and every text export.
 *
 * Flags are deliberately NOT stored here. They belong in the macro, where the
 * user can read and edit them in raw text; a bare `{{renderer :curtain, k7}}`
 * would otherwise be unreadable without revealing it.
 */
export type PayloadMap = Record<string, string>

const corrupt = (why: string): never => {
  throw new Error(`Corrupt Curtain payload: ${why}`)
}

/**
 * Read a block's payload map.
 *
 * A block with no payload property is legitimately empty. Anything present
 * but unreadable throws: silently reading a corrupted payload as empty would
 * render concealed-but-blank and lose the user's text with no signal.
 */
export function parsePayloads(raw: string | undefined): PayloadMap {
  if (raw === undefined || raw.trim() === '') return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return corrupt(`not valid JSON (${(error as Error).message})`)
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return corrupt('expected an object mapping key to text')
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') return corrupt(`value for "${key}" is not text`)
  }
  return { ...(parsed as PayloadMap) }
}

export function serialisePayloads(payloads: PayloadMap): string {
  return JSON.stringify(payloads)
}

/** Add or replace one payload. Returns a new map; the input is untouched. */
export function putPayload(payloads: PayloadMap, key: string, text: string): PayloadMap {
  return { ...payloads, [key]: text }
}

/** Drop one payload. Returns a new map; the input is untouched. */
export function removePayload(payloads: PayloadMap, key: string): PayloadMap {
  const next = { ...payloads }
  delete next[key]
  return next
}

const KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const MIN_KEY_LENGTH = 2
const MAX_KEY_LENGTH = 6
const ATTEMPTS_PER_LENGTH = 64

const randomKey = (length: number): string =>
  Array.from({ length }, () => KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)]).join('')

/**
 * Allocate a key unused within this block.
 *
 * Keys only need to be unique inside one block's map, never graph-wide, so
 * they stay short enough to read in raw text. Length grows if a crowded block
 * keeps colliding.
 */
export function newKey(existing: PayloadMap): string {
  for (let length = MIN_KEY_LENGTH; length <= MAX_KEY_LENGTH; length += 1) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_LENGTH; attempt += 1) {
      const key = randomKey(length)
      if (!(key in existing)) return key
    }
  }
  throw new Error('Could not allocate a Curtain payload key')
}

/** The plugin id is not sanitised, so the ident keeps its hyphens (T2.1). */
export const PAYLOAD_PROPERTY_NAME = 'payloads'
export const PAYLOAD_PROPERTY_IDENT = `plugin.property.logseq-curtain/${PAYLOAD_PROPERTY_NAME}`

/**
 * Pull the raw payload property off a block, whatever shape the host hands back.
 *
 * Key spellings from the host cannot be assumed: the T2.1 probe pulled
 * `:db/ident` and found it under neither `db/ident` nor `:db/ident`, while the
 * CLI showed it present. Every known shape is tried here, once, rather than at
 * each call site.
 */
export function readRawPayload(block: unknown): string | undefined {
  if (block === null || typeof block !== 'object') return undefined
  const record = block as Record<string, unknown>
  const nested = record.properties as Record<string, unknown> | undefined

  const candidates = [
    record[PAYLOAD_PROPERTY_IDENT],
    record[`:${PAYLOAD_PROPERTY_IDENT}`],
    nested?.[PAYLOAD_PROPERTY_IDENT],
    nested?.[`:${PAYLOAD_PROPERTY_IDENT}`],
  ]
  return candidates.find((value): value is string => typeof value === 'string')
}

/**
 * Drop payloads whose macro is no longer in the block.
 *
 * Undo and ordinary editing remove a macro from the title but leave its
 * payload behind. Without this, orphans accumulate, and — the real problem —
 * undoing a concealment leaves the concealed text in storage, so someone who
 * conceals something and thinks better of it is wrong to believe it is gone.
 *
 * An empty or blank title keeps everything. This deletion is irreversible, and
 * a block momentarily reporting no title — mid-edit, or a partial read — must
 * not wipe every payload it has.
 */
export function collectPayloads(title: string, payloads: PayloadMap): PayloadMap {
  if (title.trim() === '') return { ...payloads }

  const referenced = new Set(findMacroKeys(title))
  const kept: PayloadMap = {}
  for (const [key, text] of Object.entries(payloads)) {
    if (referenced.has(key)) kept[key] = text
  }
  return kept
}

/**
 * Put concealed text back into a block's title.
 *
 * Serves both un-concealing (write the result back to the block) and copying
 * (use the title, leave the block alone), so the two cannot drift apart.
 *
 * Handles both storage modes: a reference naming a payload is replaced by that
 * payload, and one that names nothing is already the text.
 */
export function revealFragments(
  title: string,
  payloads: PayloadMap,
): { title: string; payloads: PayloadMap } {
  const used = new Set<string>()

  const restored = title.replace(macroBodyPattern(), (macro, body: string) => {
    const parts = splitMacroBody(body)
    if (parts === null) return macro

    // Keyed mode: the reference names a payload. Inline mode: it *is* the
    // text. Only the keyed case consumes a payload.
    const stored = payloads[parts.reference]
    if (stored !== undefined) {
      used.add(parts.reference)
      return stored
    }
    return parts.reference
  })

  const remaining: PayloadMap = {}
  for (const [key, text] of Object.entries(payloads)) {
    if (!used.has(key)) remaining[key] = text
  }
  return { title: restored, payloads: remaining }
}

/**
 * Resolve a macro's reference to the text it stands for.
 *
 * A key names a payload; anything else is already the text (inline mode).
 *
 * Checks for an *own* string rather than indexing directly. A plain lookup
 * reaches the prototype chain, so a reference of `constructor` or `__proto__`
 * resolved to a function or an object and then threw when escaped as text.
 */
export function resolveReference(payloads: PayloadMap, reference: string): string {
  if (!Object.prototype.hasOwnProperty.call(payloads, reference)) return reference
  const stored = payloads[reference]
  return typeof stored === 'string' ? stored : reference
}
