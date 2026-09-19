/**
 * Everything beneath a tagged block.
 *
 * `:block/page` already covers a whole page at any depth, so tagging a page is
 * complete. Tagging a *block* is not: only its direct children fall out of a
 * single `:block/parent` clause, and full descent needs a recursive datalog
 * rule. Rules must be passed as a `%` input, and the plugin bridge serialises
 * inputs as JSON, which cannot express the symbols a rule is made of.
 *
 * So the descent happens here instead, over the parent edges of the pages that
 * contain a tagged block — a bounded set, not the whole graph.
 */

/**
 * Seeds plus every node with a seed among its ancestors.
 *
 * Walks upward from each node rather than downward from each seed, so one pass
 * over the edges answers for every node, and nothing depends on the order the
 * query returned them in.
 */
export function expandDescendants(
  seeds: ReadonlySet<string>,
  parentOf: ReadonlyMap<string, string>,
): Set<string> {
  const covered = new Set<string>(seeds)

  for (const child of parentOf.keys()) {
    if (covered.has(child)) continue

    // Climb to the first seed, or to the root. `seen` bounds the walk: a valid
    // outline has no cycles, but this runs on whatever the query returned.
    const chain: string[] = []
    const seen = new Set<string>()
    let current: string | undefined = child

    while (current !== undefined && !seen.has(current)) {
      seen.add(current)
      if (covered.has(current)) {
        for (const node of chain) covered.add(node)
        break
      }
      chain.push(current)
      current = parentOf.get(current)
    }
  }

  return covered
}
