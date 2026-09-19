import { describe, expect, it } from 'vitest'
import { FLAG_NAMES, formatFlags, parseFlags } from './flags'

describe('parseFlags', () => {
  it('treats an empty string as concealing from nobody', () => {
    expect(parseFlags('')).toEqual({ spoiler: false, norobots: false })
  })

  it('parses each flag on its own', () => {
    expect(parseFlags('spoiler')).toEqual({ spoiler: true, norobots: false })
    expect(parseFlags('norobots')).toEqual({ spoiler: false, norobots: true })
  })

  it('parses both flags together', () => {
    expect(parseFlags('spoiler norobots')).toEqual({ spoiler: true, norobots: true })
  })

  it('is order-independent', () => {
    expect(parseFlags('norobots spoiler')).toEqual(parseFlags('spoiler norobots'))
  })

  it('tolerates surrounding and repeated whitespace', () => {
    expect(parseFlags('  spoiler   norobots  ')).toEqual({ spoiler: true, norobots: true })
  })

  // Fail fast: a typo must not silently degrade to "conceal from nobody",
  // which would leak the payload rather than over-conceal it.
  it('throws on an unknown flag', () => {
    expect(() => parseFlags('sploiler')).toThrow(/unknown flag/i)
  })

  it('throws on a duplicate flag', () => {
    expect(() => parseFlags('spoiler spoiler')).toThrow(/duplicate flag/i)
  })
})

describe('formatFlags', () => {
  it('round-trips through parseFlags', () => {
    for (const input of ['', 'spoiler', 'norobots', 'spoiler norobots']) {
      expect(formatFlags(parseFlags(input))).toBe(input)
    }
  })

  it('emits a canonical order regardless of input order', () => {
    expect(formatFlags(parseFlags('norobots spoiler'))).toBe('spoiler norobots')
  })
})

describe('FLAG_NAMES', () => {
  // DRY: tags and macro flags must share one vocabulary, so the tag
  // names are derived from this list rather than written twice.
  it('is the single source of the vocabulary', () => {
    expect(FLAG_NAMES).toEqual(['spoiler', 'norobots'])
  })
})
