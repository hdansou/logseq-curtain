import { describe, expect, it } from 'vitest'
import {
  collectPayloads,
  newKey,
  parsePayloads,
  putPayload,
  readRawPayload,
  removePayload,
  revealFragments,
  serialisePayloads,
} from './payloads'

describe('parsePayloads', () => {
  it('treats a block with no payload property as empty', () => {
    expect(parsePayloads(undefined)).toEqual({})
    expect(parsePayloads('')).toEqual({})
    expect(parsePayloads('   ')).toEqual({})
  })

  it('reads a map of key to text', () => {
    expect(parsePayloads('{"k7":"the concealed text"}')).toEqual({ k7: 'the concealed text' })
  })

  it('preserves text that would be mangled inside a macro argument', () => {
    // The reason payloads live here rather than inline: mldoc comma-splits
    // macro arguments, so "a,b" round-trips as "a, b".
    const text = 'one,two,  three'
    expect(parsePayloads(serialisePayloads({ k7: text })).k7).toBe(text)
  })

  // Fail fast: a corrupted payload must not silently read as empty, which
  // would render as concealed-but-blank and lose the user's text without
  // any signal that something went wrong.
  it('throws on malformed JSON', () => {
    expect(() => parsePayloads('not json')).toThrow(/payload/i)
  })

  it('throws when the payload is not an object', () => {
    expect(() => parsePayloads('[1,2]')).toThrow(/payload/i)
    expect(() => parsePayloads('"a string"')).toThrow(/payload/i)
  })

  it('throws when a value is not a string', () => {
    expect(() => parsePayloads('{"k7":5}')).toThrow(/payload/i)
  })
})

describe('serialisePayloads', () => {
  it('round-trips through parsePayloads', () => {
    const map = { k7: 'first', m3: 'second with "quotes" and \n newline' }
    expect(parsePayloads(serialisePayloads(map))).toEqual(map)
  })

  it('serialises an empty map to something parsePayloads accepts', () => {
    expect(parsePayloads(serialisePayloads({}))).toEqual({})
  })
})

describe('putPayload', () => {
  it('adds an entry without mutating the original', () => {
    const before = { k7: 'first' }
    const after = putPayload(before, 'm3', 'second')
    expect(after).toEqual({ k7: 'first', m3: 'second' })
    expect(before).toEqual({ k7: 'first' })
  })

  it('replaces the text of an existing key', () => {
    expect(putPayload({ k7: 'old' }, 'k7', 'new')).toEqual({ k7: 'new' })
  })
})

describe('removePayload', () => {
  it('drops an entry without mutating the original', () => {
    const before = { k7: 'first', m3: 'second' }
    expect(removePayload(before, 'k7')).toEqual({ m3: 'second' })
    expect(before).toEqual({ k7: 'first', m3: 'second' })
  })

  it('is a no-op for a key that is not present', () => {
    expect(removePayload({ k7: 'first' }, 'nope')).toEqual({ k7: 'first' })
  })
})

describe('newKey', () => {
  it('produces a short lowercase alphanumeric key', () => {
    expect(newKey({})).toMatch(/^[a-z0-9]{2,6}$/)
  })

  it('never collides with a key already in the map', () => {
    // Keys only need to be unique within one block's map, so exhaust a
    // deliberately crowded map rather than trusting randomness alone.
    let map: Record<string, string> = {}
    for (let i = 0; i < 200; i += 1) {
      const key = newKey(map)
      expect(map[key]).toBeUndefined()
      map = putPayload(map, key, `text ${i}`)
    }
    expect(Object.keys(map)).toHaveLength(200)
  })
})

describe('readRawPayload', () => {
  const IDENT = 'plugin.property.logseq-curtain/payloads'

  it('reads the property from a bare namespaced key', () => {
    expect(readRawPayload({ [IDENT]: '{"k7":"hi"}' })).toBe('{"k7":"hi"}')
  })

  // The T2.1 probe pulled :db/ident and found it under NEITHER `db/ident` nor
  // `:db/ident`, so key spellings from the host cannot be assumed. Every known
  // shape is tried in one place rather than at each call site.
  it('reads the property from a leading-colon key', () => {
    expect(readRawPayload({ [`:${IDENT}`]: '{"k7":"hi"}' })).toBe('{"k7":"hi"}')
  })

  it('reads the property from a nested properties object', () => {
    expect(readRawPayload({ properties: { [IDENT]: '{"k7":"hi"}' } })).toBe('{"k7":"hi"}')
  })

  it('returns undefined when the block carries no payload property', () => {
    expect(readRawPayload({ 'block/title': 'ordinary block' })).toBeUndefined()
  })

  it('returns undefined for a nullish block', () => {
    expect(readRawPayload(undefined)).toBeUndefined()
    expect(readRawPayload(null)).toBeUndefined()
  })

  it('ignores a non-string value rather than passing it on as text', () => {
    expect(readRawPayload({ [IDENT]: 42 })).toBeUndefined()
  })
})

describe('collectPayloads', () => {
  it('drops a payload whose macro is gone', () => {
    const payloads = { ma: 'robots', '3u': 'humans and spoiled' }
    const title = 'I am to be avoided by {{renderer :curtain, 3u, spoiler}} and there is more'
    expect(collectPayloads(title, payloads)).toEqual({ '3u': 'humans and spoiled' })
  })

  it('keeps every payload that is still referenced', () => {
    const payloads = { k7: 'one', m3: 'two' }
    const title = '{{renderer :curtain, k7, spoiler}} {{renderer :curtain, m3, norobots}}'
    expect(collectPayloads(title, payloads)).toEqual(payloads)
  })

  it('does not mutate the input', () => {
    const payloads = { ma: 'robots', k7: 'kept' }
    collectPayloads('{{renderer :curtain, k7, spoiler}}', payloads)
    expect(payloads).toEqual({ ma: 'robots', k7: 'kept' })
  })

  // This drives irreversible deletion. A block momentarily reporting an empty
  // title — mid-edit, or a partial read — must not wipe every payload it has.
  it('keeps everything when the title is empty', () => {
    const payloads = { k7: 'one', m3: 'two' }
    expect(collectPayloads('', payloads)).toEqual(payloads)
    expect(collectPayloads('   ', payloads)).toEqual(payloads)
  })

  it('drops everything when a real title references no macros', () => {
    expect(collectPayloads('the user removed every macro', { k7: 'one' })).toEqual({})
  })

  it('handles a block with no payloads', () => {
    expect(collectPayloads('{{renderer :curtain, k7, spoiler}}', {})).toEqual({})
  })
})

describe('revealFragments', () => {
  it('puts the concealed text back and drops the payload it used', () => {
    const result = revealFragments('before {{renderer :curtain, k7, spoiler}} after', {
      k7: 'the secret',
    })
    expect(result.title).toBe('before the secret after')
    expect(result.payloads).toEqual({})
  })

  it('restores every fragment in the block', () => {
    const result = revealFragments(
      '{{renderer :curtain, k7, spoiler}} and {{renderer :curtain, m3, norobots}}',
      { k7: 'one', m3: 'two' },
    )
    expect(result.title).toBe('one and two')
    expect(result.payloads).toEqual({})
  })

  // Once inline became a storage mode, a reference with no payload stopped
  // meaning "broken". `{{renderer :curtain, gone, spoiler}}` with no payloads
  // is indistinguishable from an inline fragment whose text is "gone" — keys
  // are short lowercase strings, and so is plenty of real text.
  //
  // So the reference is treated as the text. The alternative would leave every
  // inline macro permanently un-removable, which is far worse than a macro
  // with a lost payload revealing its short id.
  it('treats a reference with no payload as the text itself', () => {
    expect(revealFragments('before {{renderer :curtain, gone, spoiler}} after', {}).title).toBe(
      'before gone after',
    )
  })

  it('keeps payloads that belong to other blocks’ keys', () => {
    const result = revealFragments('{{renderer :curtain, k7, spoiler}}', {
      k7: 'used',
      other: 'untouched',
    })
    expect(result.payloads).toEqual({ other: 'untouched' })
  })

  it('leaves a block with no macros alone', () => {
    const result = revealFragments('nothing here', { k7: 'kept' })
    expect(result.title).toBe('nothing here')
    expect(result.payloads).toEqual({ k7: 'kept' })
  })

  it('restores text containing commas, which a macro argument could not hold', () => {
    const result = revealFragments('{{renderer :curtain, k7, spoiler}}', { k7: 'one,two,  three' })
    expect(result.title).toBe('one,two,  three')
  })
})

describe('revealFragments — inline mode', () => {
  // In inline mode the macro's reference IS the text, so there is no payload
  // to look up. An earlier version only substituted when the lookup succeeded,
  // which left inline macros in the block untouched.
  it('removes an inline macro, keeping its text', () => {
    expect(revealFragments('a {{renderer :curtain, humans and robots, spoiler}} b', {}).title).toBe(
      'a humans and robots b',
    )
  })

  it('handles inline text containing commas', () => {
    expect(revealFragments('{{renderer :curtain, one, two, spoiler}}', {}).title).toBe('one, two')
  })

  it('handles a block holding one of each mode', () => {
    const result = revealFragments(
      '{{renderer :curtain, k7, spoiler}} then {{renderer :curtain, inline text, norobots}}',
      { k7: 'stored' },
    )
    expect(result.title).toBe('stored then inline text')
    expect(result.payloads).toEqual({})
  })

  it('still drops only the payloads it used', () => {
    const result = revealFragments('{{renderer :curtain, inline, spoiler}}', { k7: 'kept' })
    expect(result.payloads).toEqual({ k7: 'kept' })
  })
})
