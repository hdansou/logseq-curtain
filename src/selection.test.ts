import { describe, expect, it } from 'vitest'
import {
  SELECTION_STALE_AFTER_MS,
  createSelectionMemory,
  isSelectionUsable,
  type RememberedSelection,
} from './selection'

const BLOCK = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const CONTENT = 'the quick brown fox'

// "quick" sits at [4, 9)
const fresh = (over: Partial<RememberedSelection> = {}): RememberedSelection => ({
  blockUuid: BLOCK,
  start: 4,
  end: 9,
  text: 'quick',
  at: 1_000_000,
  ...over,
})

const context = (over: Partial<{ blockUuid: string; content: string; now: number }> = {}) => ({
  blockUuid: BLOCK,
  content: CONTENT,
  now: 1_000_000,
  ...over,
})

describe('isSelectionUsable', () => {
  it('accepts a selection that still matches the block it came from', () => {
    expect(isSelectionUsable(fresh(), context())).toBe(true)
  })

  it('rejects nothing remembered', () => {
    expect(isSelectionUsable(null, context())).toBe(false)
  })

  // Rule 1 — the user moved on to another block.
  it('rejects a selection from a different block', () => {
    expect(isSelectionUsable(fresh(), context({ blockUuid: 'ffffffff-0000-0000-0000-000000000000' }))).toBe(false)
  })

  // Rule 2 — the load-bearing one. Re-derives truth from current content, so
  // it catches every edit without having to observe the edit.
  it('rejects a selection whose offsets no longer slice to the same text', () => {
    expect(isSelectionUsable(fresh(), context({ content: 'the slow brown fox' }))).toBe(false)
  })

  it('rejects when an edit earlier in the block shifted the offsets', () => {
    // Same word still present, but no longer at [4, 9).
    expect(isSelectionUsable(fresh(), context({ content: 'well the quick brown fox' }))).toBe(false)
  })

  // Rule 3 — a selection from minutes ago is not an intent.
  it('accepts a selection exactly at the staleness boundary', () => {
    expect(isSelectionUsable(fresh(), context({ now: 1_000_000 + SELECTION_STALE_AFTER_MS }))).toBe(true)
  })

  it('rejects a selection past the staleness boundary', () => {
    expect(isSelectionUsable(fresh(), context({ now: 1_000_000 + SELECTION_STALE_AFTER_MS + 1 }))).toBe(false)
  })

  it('rejects an empty selection', () => {
    expect(isSelectionUsable(fresh({ start: 4, end: 4, text: '' }), context())).toBe(false)
  })

  it('rejects a whitespace-only selection', () => {
    expect(isSelectionUsable(fresh({ start: 3, end: 4, text: ' ' }), context())).toBe(false)
  })

  it('rejects an inverted range', () => {
    expect(isSelectionUsable(fresh({ start: 9, end: 4 }), context())).toBe(false)
  })

  it('rejects a negative start', () => {
    expect(isSelectionUsable(fresh({ start: -1, end: 5, text: 'the q' }), context())).toBe(false)
  })

  // slice() silently truncates rather than throwing, so an end past the content
  // length could otherwise pass rule 2 by accident.
  it('rejects an end beyond the content length', () => {
    expect(isSelectionUsable(fresh({ start: 16, end: 99, text: 'fox' }), context())).toBe(false)
  })
})

describe('createSelectionMemory', () => {
  it('returns a usable selection once', () => {
    const memory = createSelectionMemory()
    memory.remember(fresh())
    expect(memory.consume(context())).toEqual(fresh())
  })

  // Rule 4 by construction: consuming always clears, so a used selection
  // cannot survive to be concealed twice.
  it('never returns the same selection twice', () => {
    const memory = createSelectionMemory()
    memory.remember(fresh())
    memory.consume(context())
    expect(memory.consume(context())).toBeNull()
  })

  it('returns null when nothing was remembered', () => {
    expect(createSelectionMemory().consume(context())).toBeNull()
  })

  it('discards an unusable selection rather than leaving it to go stale', () => {
    const memory = createSelectionMemory()
    memory.remember(fresh())
    expect(memory.consume(context({ content: 'edited away' }))).toBeNull()
    // Even now that the original context is back, it is gone for good.
    expect(memory.consume(context())).toBeNull()
  })

  it('keeps only the most recent selection', () => {
    const memory = createSelectionMemory()
    memory.remember(fresh())
    memory.remember(fresh({ start: 10, end: 15, text: 'brown' }))
    expect(memory.consume(context())).toEqual(fresh({ start: 10, end: 15, text: 'brown' }))
  })
})

describe('peek', () => {
  // The command palette may end the editing session, so the caller needs the
  // remembered block's identity before it can resolve that block's content.
  it('reports the remembered selection without consuming it', () => {
    const memory = createSelectionMemory()
    memory.remember(fresh())
    expect(memory.peek()).toEqual(fresh())
    expect(memory.consume(context())).toEqual(fresh())
  })

  it('returns null when nothing is remembered', () => {
    expect(createSelectionMemory().peek()).toBeNull()
  })

  it('returns null after consuming', () => {
    const memory = createSelectionMemory()
    memory.remember(fresh())
    memory.consume(context())
    expect(memory.peek()).toBeNull()
  })
})
