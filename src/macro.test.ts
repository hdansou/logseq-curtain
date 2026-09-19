import { describe, expect, it } from 'vitest'
import { parseFlags } from './flags'
import {
  findMacroKeys,
  formatMacro,
  insertMacroAtTrigger,
  parseMacro,
  parseMacroArguments,
  spliceMacro,
  stripSlashTrigger,
} from './macro'

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

describe('parseMacroArguments', () => {
  // mldoc comma-splits macro arguments before the renderer sees them, so the
  // host hands over already-split pieces rather than the raw macro text.
  it('reads the host-split argument form', () => {
    expect(parseMacroArguments([':curtain', 'k7', 'spoiler norobots'])).toEqual({
      reference: 'k7',
      audience: parseFlags('spoiler norobots'),
    })
  })

  it('tolerates the whitespace mldoc leaves around arguments', () => {
    expect(parseMacroArguments([' :curtain ', ' k7 ', ' spoiler '])).toEqual({
      reference: 'k7',
      audience: parseFlags('spoiler'),
    })
  })

  // In inline mode the reference IS the text, and mldoc splits it on every
  // comma. Flags are always last, so the middle arguments rejoin into the text.
  it('rejoins inline text that mldoc split on commas', () => {
    expect(parseMacroArguments([':curtain', 'one', 'two', 'spoiler'])).toEqual({
      reference: 'one, two',
      audience: parseFlags('spoiler'),
    })
  })

  it('reads inline text with no commas', () => {
    expect(parseMacroArguments([':curtain', 'humans and robots', 'spoiler norobots'])).toEqual({
      reference: 'humans and robots',
      audience: parseFlags('spoiler norobots'),
    })
  })

  it('returns null for another plugin renderer', () => {
    expect(parseMacroArguments([':progress-bar', 'k7', 'spoiler'])).toBeNull()
  })

  it('returns null when arguments are missing', () => {
    expect(parseMacroArguments([':curtain'])).toBeNull()
    expect(parseMacroArguments([':curtain', 'k7'])).toBeNull()
    expect(parseMacroArguments([])).toBeNull()
  })
})

describe('findMacroKeys', () => {
  it('finds nothing in a block with no macros', () => {
    expect(findMacroKeys('an ordinary block')).toEqual([])
  })

  it('finds the key of a single macro', () => {
    expect(findMacroKeys('before {{renderer :curtain, k7, spoiler}} after')).toEqual(['k7'])
  })

  it('finds every key when a block holds several fragments', () => {
    expect(
      findMacroKeys('{{renderer :curtain, k7, spoiler}} and {{renderer :curtain, m3, norobots}}'),
    ).toEqual(['k7', 'm3'])
  })

  it('ignores other plugins’ renderers', () => {
    expect(findMacroKeys('{{renderer :progress-bar, k7, spoiler}}')).toEqual([])
  })

  // Conservative on purpose: this drives deletion, so a macro that cannot be
  // fully parsed must still protect its payload rather than orphan it.
  it('still finds the key when the flags are unparseable', () => {
    expect(findMacroKeys('{{renderer :curtain, k7, sploiler}}')).toEqual(['k7'])
  })
})

describe('insertMacroAtTrigger', () => {
  const FLAGS = 'spoiler norobots'

  it('replaces the typed trigger with an empty macro', () => {
    const result = insertMacroAtTrigger('some text /conceal', 'conceal', FLAGS)
    expect(result?.content).toBe('some text {{renderer :curtain, , spoiler norobots}}')
  })

  it('places the cursor in the empty reference slot', () => {
    const result = insertMacroAtTrigger('some text /conceal', 'conceal', FLAGS)
    // Typing at that position must land between the commas.
    const typed =
      result!.content.slice(0, result!.cursor) + 'secret' + result!.content.slice(result!.cursor)
    expect(typed).toBe('some text {{renderer :curtain, secret, spoiler norobots}}')
  })

  it('works when the trigger is the whole block', () => {
    const result = insertMacroAtTrigger('/conceal', 'conceal', FLAGS)
    expect(result?.content).toBe('{{renderer :curtain, , spoiler norobots}}')
    const typed =
      result!.content.slice(0, result!.cursor) + 'x' + result!.content.slice(result!.cursor)
    expect(typed).toBe('{{renderer :curtain, x, spoiler norobots}}')
  })

  it('returns null when the trigger is not at the end', () => {
    expect(insertMacroAtTrigger('talk about /conceal in prose', 'conceal', FLAGS)).toBeNull()
  })

  it('returns null when the trigger is absent', () => {
    expect(insertMacroAtTrigger('some text', 'conceal', FLAGS)).toBeNull()
  })
})
