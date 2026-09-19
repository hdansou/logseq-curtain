import { describe, expect, it } from 'vitest'
import {
  newKey,
  parsePayloads,
  putPayload,
  readRawPayload,
  removePayload,
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
