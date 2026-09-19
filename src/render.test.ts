import { describe, expect, it } from 'vitest'
import { parseFlags } from './flags'
import { renderCurtain } from './render'

const PAYLOAD = 'the launch date is March'

describe('renderCurtain', () => {
  // The whole point of the plugin. If the concealed markup carries the text,
  // every browser-driving agent reads it straight out of the DOM.
  it('does NOT contain the payload when concealed', () => {
    const html = renderCurtain({ slot: 's1', key: 'k7', concealed: true, text: PAYLOAD, audience: parseFlags('spoiler') })
    expect(html).not.toContain(PAYLOAD)
    expect(html).not.toContain('March')
  })

  it('shows a placeholder when concealed', () => {
    expect(renderCurtain({ slot: 's1', key: 'k7', concealed: true, text: PAYLOAD, audience: parseFlags('spoiler') })).toContain('•••')
  })

  it('contains the payload when revealed', () => {
    const html = renderCurtain({ slot: 's1', key: 'k7', concealed: false, text: PAYLOAD, audience: parseFlags('spoiler') })
    expect(html).toContain(PAYLOAD)
  })

  it('escapes HTML in the payload rather than injecting it', () => {
    const html = renderCurtain({
      slot: 's1',
      key: 'k7',
      concealed: false,
      text: '<img src=x onerror="alert(1)"> a & b',
      audience: parseFlags('spoiler'),
    })
    // No element can be injected, and the quote that would close an
    // attribute is escaped. The literal text "onerror=" surviving inside an
    // escaped text node is inert, so asserting on it would test the wrong thing.
    expect(html).not.toContain('<img')
    expect(html).not.toContain('onerror="')
    expect(html).toContain('&lt;img')
    expect(html).toContain('&amp;')
  })

  it('escapes the key, which reaches the markup as an attribute', () => {
    const html = renderCurtain({ slot: 's1', key: 'k7" onclick="x', concealed: true, text: PAYLOAD, audience: parseFlags('spoiler') })
    expect(html).not.toContain('onclick="x')
  })

  it('carries the key and slot so the click handler can find them', () => {
    const html = renderCurtain({ slot: 'slot-9', key: 'k7', concealed: true, text: PAYLOAD, audience: parseFlags('spoiler') })
    expect(html).toContain('k7')
    expect(html).toContain('slot-9')
  })
})

describe('renderCurtain — axis styling', () => {
  const opts = (flags: string, concealed = true) => ({
    slot: 's1',
    key: 'k7',
    concealed,
    text: PAYLOAD,
    audience: parseFlags(flags),
  })

  // Every curtain conceals now, so the mark is unmistakable. The axis has to
  // survive in the markup, or the 2x2 model becomes invisible once concealed.
  it('marks a spoiler-only fragment', () => {
    const html = renderCurtain(opts('spoiler'))
    expect(html).toContain('curtain--spoiler')
    expect(html).not.toContain('curtain--norobots')
  })

  it('marks a norobots-only fragment', () => {
    const html = renderCurtain(opts('norobots'))
    expect(html).toContain('curtain--norobots')
    expect(html).not.toContain('curtain--spoiler')
  })

  it('marks both axes when both are set', () => {
    const html = renderCurtain(opts('spoiler norobots'))
    expect(html).toContain('curtain--spoiler')
    expect(html).toContain('curtain--norobots')
  })

  it('keeps the axis marks once revealed', () => {
    const html = renderCurtain(opts('norobots', false))
    expect(html).toContain('curtain--norobots')
    expect(html).toContain('curtain--revealed')
  })

  it('still hides the payload when concealed, whatever the axis', () => {
    for (const flags of ['spoiler', 'norobots', 'spoiler norobots']) {
      expect(renderCurtain(opts(flags))).not.toContain(PAYLOAD)
    }
  })
})
