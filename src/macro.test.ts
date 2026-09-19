import { describe, expect, it } from 'vitest'
import { parseFlags } from './flags'
import { formatMacro, parseMacro, spliceMacro, stripSlashTrigger } from './macro'

describe('formatMacro', () => {
  it('writes the key and both flags', () => {
    expect(formatMacro('k7', parseFlags('spoiler norobots'))).toBe(
      '{{renderer :curtain, k7, spoiler norobots}}',
    )
  })

  it('writes a single flag', () => {
    expect(formatMacro('k7', parseFlags('spoiler'))).toBe('{{renderer :curtain, k7, spoiler}}')
  })

  it('emits flags in canonical order regardless of how they were given', () => {
    expect(formatMacro('k7', parseFlags('norobots spoiler'))).toBe(
      '{{renderer :curtain, k7, spoiler norobots}}',
    )
  })

  // A curtain concealing from nobody is a programmer error, not a valid state.
  it('throws when no axis is set', () => {
    expect(() => formatMacro('k7', parseFlags(''))).toThrow(/axis/i)
  })
})

describe('parseMacro', () => {
  it('round-trips everything formatMacro produces', () => {
    for (const flags of ['spoiler', 'norobots', 'spoiler norobots']) {
      const audience = parseFlags(flags)
      expect(parseMacro(formatMacro('k7', audience))).toEqual({ key: 'k7', audience })
    }
  })

  it('finds a macro embedded in surrounding text', () => {
    const found = parseMacro('before {{renderer :curtain, m3, spoiler}} after')
    expect(found).toEqual({ key: 'm3', audience: parseFlags('spoiler') })
  })

  it('tolerates loose whitespace', () => {
    expect(parseMacro('{{renderer  :curtain ,  k7 ,  spoiler  norobots }}')).toEqual({
      key: 'k7',
      audience: parseFlags('spoiler norobots'),
    })
  })

  it('returns null for text with no macro', () => {
    expect(parseMacro('an ordinary block')).toBeNull()
  })

  it('returns null for a different renderer', () => {
    expect(parseMacro('{{renderer :progress-bar, k7, spoiler}}')).toBeNull()
  })

  // Fail fast rather than rendering something that conceals from nobody.
  it('throws on a macro carrying an unknown flag', () => {
    expect(() => parseMacro('{{renderer :curtain, k7, sploiler}}')).toThrow(/unknown flag/i)
  })
})

describe('spliceMacro', () => {
  const CONTENT = 'the quick brown fox'
  const MACRO = '{{renderer :curtain, k7, spoiler}}'

  it('replaces the selected range', () => {
    expect(spliceMacro(CONTENT, 4, 9, MACRO)).toBe(`the ${MACRO} brown fox`)
  })

  it('replaces a range at the start', () => {
    expect(spliceMacro(CONTENT, 0, 3, MACRO)).toBe(`${MACRO} quick brown fox`)
  })

  it('replaces a range at the end', () => {
    expect(spliceMacro(CONTENT, 16, 19, MACRO)).toBe(`the quick brown ${MACRO}`)
  })

  it('replaces the whole content', () => {
    expect(spliceMacro(CONTENT, 0, CONTENT.length, MACRO)).toBe(MACRO)
  })
})

describe('stripSlashTrigger', () => {
  // The host does not reliably remove the typed "/command" text before the
  // callback runs, and `editor/clear-current-slash` is not reachable through
  // invokeExternalCommand. If the host did already strip it, this is a no-op.
  it('removes the trigger typed at the end of the block', () => {
    expect(stripSlashTrigger('some text /spoiler', 'spoiler')).toBe('some text ')
  })

  it('leaves content alone when the trigger is absent', () => {
    expect(stripSlashTrigger('some text', 'spoiler')).toBe('some text')
  })

  it('only strips a trailing trigger, never one mid-sentence', () => {
    expect(stripSlashTrigger('talk about /spoiler tags here', 'spoiler')).toBe(
      'talk about /spoiler tags here',
    )
  })

  it('does not strip a different command', () => {
    expect(stripSlashTrigger('some text /norobots', 'spoiler')).toBe('some text /norobots')
  })

  it('leaves a bare slash alone', () => {
    expect(stripSlashTrigger('some text /', 'spoiler')).toBe('some text /')
  })
})
