import { describe, expect, it } from 'vitest'
import { parseFlags } from './flags'
import { formatMacro, spliceMacro } from './macro'
import { inlineFragments, extractInlineFragments } from './inline'
import {
  collectPayloads,
  newKey,
  parsePayloads,
  putPayload,
  revealFragments,
  serialisePayloads,
} from './payloads'

/**
 * The leak-surface matrix, as assertions.
 *
 * docs/leak-surfaces.md lists fourteen places concealed text can escape. Ten of
 * them — the DOM attribute, the search index, cmdk results, graph labels,
 * breadcrumbs, text export, publish HTML, linked references, the sidebar and
 * the rendered block — are not ten independent facts. Every one of them reads
 * `:block/title`, so all ten hold exactly while ONE invariant holds:
 *
 *     in keyed mode, the payload never appears in the block title.
 *
 * Asserting that invariant once is worth more than driving ten surfaces, and
 * it is the assertion that was missing: every other test used text that would
 * have looked fine even if it leaked.
 *
 * Rows 11-12 (CLI, MCP) do not reduce to it — they read the property directly
 * — and are covered in logseq-headless-mcp/test/norobots.test.mjs.
 */
const CANARY = 'XYZZY-PAYLOAD-CANARY-7'

/** What `concealFragment` does to a block, as pure composition. */
const concealKeyed = (content: string, start: number, end: number, flags: string) => {
  const text = content.slice(start, end)
  const payloads = putPayload({}, newKey({}), text)
  const key = Object.keys(payloads)[0]
  return {
    title: spliceMacro(content, start, end, formatMacro(key, parseFlags(flags))),
    payloads,
  }
}

describe('the keyed-mode invariant: the payload is never in the title', () => {
  const SENTENCE = `the launch date is ${CANARY} and more`
  const start = SENTENCE.indexOf(CANARY)
  const end = start + CANARY.length

  it('holds for a single fragment', () => {
    const out = concealKeyed(SENTENCE, start, end, 'spoiler')
    expect(out.title).not.toContain(CANARY)
    expect(Object.values(out.payloads)).toContain(CANARY)
  })

  it('holds whichever axis is set', () => {
    for (const flags of ['spoiler', 'norobots', 'spoiler norobots']) {
      expect(concealKeyed(SENTENCE, start, end, flags).title).not.toContain(CANARY)
    }
  })

  // Each payload carries the canary so the assertion tests leakage rather than
  // coincidental overlap with macro syntax: a bare `}}` appears in every title
  // that holds a macro, which would make the check unsatisfiable and useless.
  it('holds for payloads containing characters that break naive escaping', () => {
    for (const payload of [
      `${CANARY} commas, and more, commas`,
      `${CANARY} braces {like} this`,
      `${CANARY} a "quoted" string`,
      `${CANARY} an 'apostrophe'`,
      `${CANARY} <script>alert(1)</script>`,
      `${CANARY}\nnewline`,
      `${CANARY}}}`,
      `${CANARY} {{renderer :curtain, nested, spoiler}}`,
    ]) {
      const sentence = `before ${payload} after`
      const s = 'before '.length
      const out = concealKeyed(sentence, s, s + payload.length, 'spoiler')
      expect(out.title).not.toContain(payload)
      expect(Object.values(out.payloads)).toContain(payload)
    }
  })

  it('survives the property round trip that storage performs', () => {
    const out = concealKeyed(SENTENCE, start, end, 'spoiler')
    const stored = serialisePayloads(out.payloads)
    expect(stored).toContain(CANARY) // in the property, by design
    expect(out.title).not.toContain(CANARY) // never in the title
    expect(parsePayloads(stored)).toEqual(out.payloads)
  })

  it('holds after the orphan collector runs', () => {
    const out = concealKeyed(SENTENCE, start, end, 'spoiler')
    const kept = collectPayloads(out.title, out.payloads)
    expect(out.title).not.toContain(CANARY)
    expect(Object.values(kept)).toContain(CANARY)
  })
})

describe('inline mode makes the opposite trade, on purpose', () => {
  // Asserted so the trade is explicit. If this ever passes silently as
  // "not in the title", inline mode has stopped doing what it claims.
  it('does put the text in the title', () => {
    const keyed = concealKeyed(`before ${CANARY} after`, 7, 7 + CANARY.length, 'norobots')
    const inlined = inlineFragments(keyed.title, keyed.payloads)
    expect(inlined).toContain(CANARY)
  })

  it('and converting back removes it again', () => {
    const keyed = concealKeyed(`before ${CANARY} after`, 7, 7 + CANARY.length, 'norobots')
    const inlined = inlineFragments(keyed.title, keyed.payloads)
    const extracted = extractInlineFragments(inlined, {})
    expect(extracted.title).not.toContain(CANARY)
    expect(Object.values(extracted.payloads)).toContain(CANARY)
  })
})

describe('un-concealing is the only path that puts it back', () => {
  it('restores the text and drops the payload', () => {
    const keyed = concealKeyed(`before ${CANARY} after`, 7, 7 + CANARY.length, 'spoiler')
    const revealed = revealFragments(keyed.title, keyed.payloads)
    expect(revealed.title).toContain(CANARY)
    expect(Object.values(revealed.payloads)).not.toContain(CANARY)
  })
})
