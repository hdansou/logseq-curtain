import { describe, expect, it } from 'vitest'
import { expandDescendants } from './descendants'

/** child → parent, the shape the edge query returns. */
const edges = (pairs: Array<[string, string]>) => new Map(pairs)

describe('expandDescendants', () => {
  it('keeps the seeds themselves', () => {
    expect(expandDescendants(new Set(['a']), edges([]))).toEqual(new Set(['a']))
  })

  it('includes a direct child', () => {
    expect(expandDescendants(new Set(['a']), edges([['b', 'a']]))).toEqual(new Set(['a', 'b']))
  })

  // The gap this fixes: a page's blocks were covered by :block/page, but a
  // tagged block's grandchildren were not, so a subtree looked concealed and
  // was not.
  it('includes a grandchild', () => {
    const out = expandDescendants(new Set(['a']), edges([['b', 'a'], ['c', 'b']]))
    expect(out).toEqual(new Set(['a', 'b', 'c']))
  })

  it('follows a deep chain', () => {
    const chain: Array<[string, string]> = [
      ['b', 'a'],
      ['c', 'b'],
      ['d', 'c'],
      ['e', 'd'],
      ['f', 'e'],
    ]
    expect(expandDescendants(new Set(['a']), edges(chain)).size).toBe(6)
  })

  it('leaves an unrelated subtree alone', () => {
    const out = expandDescendants(
      new Set(['a']),
      edges([['b', 'a'], ['y', 'x'], ['z', 'y']]),
    )
    expect(out).toEqual(new Set(['a', 'b']))
  })

  it('handles several seeds', () => {
    const out = expandDescendants(new Set(['a', 'x']), edges([['b', 'a'], ['y', 'x']]))
    expect(out).toEqual(new Set(['a', 'b', 'x', 'y']))
  })

  it('does not include an ancestor of a seed', () => {
    // Tagging a child must not conceal its parent.
    expect(expandDescendants(new Set(['b']), edges([['b', 'a']]))).toEqual(new Set(['b']))
  })

  // Malformed data must not hang the plugin; a cycle cannot arise from a valid
  // outline but this walks whatever the query returns.
  it('terminates on a cycle', () => {
    const out = expandDescendants(new Set(['a']), edges([['a', 'b'], ['b', 'a']]))
    expect(out.has('a')).toBe(true)
  })

  it('terminates on a self-parent', () => {
    expect(expandDescendants(new Set(['a']), edges([['a', 'a']])).has('a')).toBe(true)
  })

  it('returns only the seeds when nothing is tagged below them', () => {
    expect(expandDescendants(new Set(), edges([['b', 'a']]))).toEqual(new Set())
  })
})
