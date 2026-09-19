import { describe, expect, it } from 'vitest'
import { CONCEALED_TITLE, concealBlockTitle } from './conceal'

/** The two attribute calls are all the DOM surface this needs. */
const fakeElement = (title: string | null) => {
  const attrs: Record<string, string | null> = { 'data-block-title': title }
  return {
    getAttribute: (name: string) => attrs[name] ?? null,
    setAttribute: (name: string, value: string) => {
      attrs[name] = value
    },
    current: () => attrs['data-block-title'],
  }
}

describe('concealBlockTitle', () => {
  it('replaces the raw title so it cannot be read off the attribute', () => {
    const element = fakeElement('the launch date is March')
    concealBlockTitle(element, CONCEALED_TITLE)
    expect(element.current()).toBe(CONCEALED_TITLE)
    expect(element.current()).not.toContain('March')
  })

  it('reports that it changed something', () => {
    expect(concealBlockTitle(fakeElement('secret'), CONCEALED_TITLE)).toBe(true)
  })

  // A MutationObserver watching attributes will re-fire on its own writes.
  // Reporting "no change" is what stops that becoming an infinite loop.
  it('is a no-op once already concealed', () => {
    const element = fakeElement(CONCEALED_TITLE)
    expect(concealBlockTitle(element, CONCEALED_TITLE)).toBe(false)
    expect(element.current()).toBe(CONCEALED_TITLE)
  })

  it('is a no-op when the attribute is absent', () => {
    const element = fakeElement(null)
    expect(concealBlockTitle(element, CONCEALED_TITLE)).toBe(false)
    expect(element.current()).toBeNull()
  })

  it('never writes the real title back', () => {
    const element = fakeElement('secret')
    concealBlockTitle(element, CONCEALED_TITLE)
    concealBlockTitle(element, CONCEALED_TITLE)
    expect(element.current()).toBe(CONCEALED_TITLE)
  })
})
