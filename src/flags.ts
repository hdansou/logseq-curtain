/**
 * The Curtain vocabulary, defined once.
 *
 * These same names are the node tags (`#spoiler`, `#norobots`) and the inline
 * macro flags (`{{renderer :curtain, k7, spoiler norobots}}`). Anything that
 * needs either must derive it from here rather than restating the strings.
 */
export const FLAG_NAMES = ['spoiler', 'norobots'] as const

export type FlagName = (typeof FLAG_NAMES)[number]

/** Who a fragment is concealed from. The two axes are independent. */
export type Audience = { [K in FlagName]: boolean }

const isFlagName = (token: string): token is FlagName =>
  (FLAG_NAMES as readonly string[]).includes(token)

/**
 * Parse a space-separated flag list.
 *
 * Throws on anything unrecognised. A typo must not degrade to "conceal from
 * nobody", because that failure mode leaks the payload; over-concealing is
 * recoverable, leaking is not.
 */
export function parseFlags(input: string): Audience {
  const audience: Audience = { spoiler: false, norobots: false }
  for (const token of input.trim().split(/\s+/).filter(Boolean)) {
    if (!isFlagName(token)) throw new Error(`Unknown flag: ${token}`)
    if (audience[token]) throw new Error(`Duplicate flag: ${token}`)
    audience[token] = true
  }
  return audience
}

/** Render an audience back to canonical `FLAG_NAMES` order. */
export function formatFlags(audience: Audience): string {
  return FLAG_NAMES.filter((name) => audience[name]).join(' ')
}
