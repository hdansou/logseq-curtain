import { describe, expect, it } from 'vitest'
import { extractInlineFragments, inlineFragments } from './inline'

describe('inlineFragments', () => {
  it('puts the text where the key was, keeping the macro', () => {
    expect(inlineFragments('a {{renderer :curtain, k7, spoiler}} b', { k7: 'the secret' })).toBe(
      'a {{renderer :curtain, the secret, spoiler}} b',
    )
  })

  it('keeps both flags', () => {
    expect(inlineFragments('{{renderer :curtain, k7, spoiler norobots}}', { k7: 'x' })).toBe(
      '{{renderer :curtain, x, spoiler norobots}}',
    )
  })

  it('leaves a macro alone when its payload is missing', () => {
    const title = '{{renderer :curtain, gone, spoiler}}'
    expect(inlineFragments(title, {})).toBe(title)
  })
})

describe('extractInlineFragments', () => {
  it('replaces inline text with a fresh key and stores it', () => {
    const result = extractInlineFragments('a {{renderer :curtain, the secret, spoiler}} b', {})
    const [key] = Object.keys(result.payloads)
    expect(result.payloads[key]).toBe('the secret')
    expect(result.title).toBe(`a {{renderer :curtain, ${key}, spoiler}} b`)
  })

  // The reason this parses the raw title rather than mldoc's split arguments:
  // a comma in the text adds an argument, and rejoining is lossy.
  it('survives commas in the text', () => {
    const result = extractInlineFragments('{{renderer :curtain, one, two, spoiler}}', {})
    const [key] = Object.keys(result.payloads)
    expect(result.payloads[key]).toBe('one, two')
  })

  it('leaves an already-keyed macro untouched', () => {
    const title = '{{renderer :curtain, k7, spoiler}}'
    const payloads = { k7: 'stored' }
    const result = extractInlineFragments(title, payloads)
    expect(result.title).toBe(title)
    expect(result.payloads).toEqual(payloads)
  })

  it('reports whether anything changed', () => {
    expect(extractInlineFragments('{{renderer :curtain, k7, spoiler}}', { k7: 'x' }).changed).toBe(
      false,
    )
    expect(extractInlineFragments('{{renderer :curtain, free text, spoiler}}', {}).changed).toBe(
      true,
    )
  })

  it('round-trips through inlineFragments', () => {
    const extracted = extractInlineFragments('{{renderer :curtain, one, two, spoiler}}', {})
    expect(inlineFragments(extracted.title, extracted.payloads)).toBe(
      '{{renderer :curtain, one, two, spoiler}}',
    )
  })

  it('handles several fragments in one block', () => {
    const result = extractInlineFragments(
      '{{renderer :curtain, first, spoiler}} and {{renderer :curtain, second, norobots}}',
      {},
    )
    expect(Object.values(result.payloads).sort()).toEqual(['first', 'second'])
  })
})
