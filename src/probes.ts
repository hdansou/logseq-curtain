/**
 * Host probes.
 *
 * These measure behaviour of the Logseq host that cannot be determined by
 * reading source alone, so they are experiments rather than TDD units: there
 * is no meaningful failing test for "what does the host actually do?".
 * Each returns a result instead of throwing, so one failure does not hide
 * the other's answer.
 *
 * They are temporary. Once both questions are settled the answers move into
 * docs/t0-findings.md and this module is deleted.
 */
export type ProbeResult = { id: string; question: string; ok: boolean; detail: string }

const PROBE_PROPERTY = 'curtain-probe-payloads'

/**
 * T2.1 — can a plugin create a property that is hidden by default?
 *
 * If not, Curtain's payload property renders as a visible row on every block
 * that uses it, and the storage model needs another way to stay out of sight.
 */
export async function probeHiddenPluginProperty(): Promise<ProbeResult> {
  const id = 'T2.1'
  const question = 'Does upsertProperty({ hide: true }) set :logseq.property/hide? on a plugin property?'
  try {
    await logseq.Editor.upsertProperty(PROBE_PROPERTY, { type: 'string', hide: true } as never)
    const rows = (await logseq.DB.datascriptQuery(
      `[:find (pull ?p [:db/ident :block/title :logseq.property/hide?])
        :where [?p :block/title "${PROBE_PROPERTY}"]]`,
    )) as Array<Array<Record<string, unknown>>>

    const property = rows?.[0]?.[0]
    if (!property) {
      return { id, question, ok: false, detail: 'property was not created at all (upsertProperty silently did nothing)' }
    }
    const ident = String(property['db/ident'] ?? property[':db/ident'] ?? '(no ident)')
    const hidden = property['logseq.property/hide?'] ?? property[':logseq.property/hide?']
    return {
      id,
      question,
      ok: hidden === true,
      detail: `ident=${ident} hide?=${JSON.stringify(hidden)}`,
    }
  } catch (error) {
    return { id, question, ok: false, detail: `threw: ${(error as Error).message}` }
  }
}

/**
 * T2.2 — can a plugin reach the host DOM to strip `data-block-title`?
 *
 * Leak surface #2: the attribute carries the raw block title, so a browser
 * agent reads the payload even while the pixels show the concealed form.
 * If this is unreachable, that surface cannot be closed from a plugin.
 *
 * Non-destructive: any attribute it overwrites is restored before returning.
 */
export function probeParentDocument(): ProbeResult {
  const id = 'T2.2'
  const question = 'Can a plugin read and write data-block-title on the host DOM?'
  try {
    const doc = (window.parent as Window | undefined)?.document
    if (!doc) return { id, question, ok: false, detail: 'window.parent.document is unreachable' }

    const blocks = doc.querySelectorAll('.ls-block[data-block-title]')
    if (blocks.length === 0) {
      return { id, question, ok: false, detail: 'reached the document but found no .ls-block[data-block-title] (is a graph open?)' }
    }

    const target = blocks[0] as HTMLElement
    const original = target.getAttribute('data-block-title')
    target.setAttribute('data-block-title', '[curtain-probe]')
    const wrote = target.getAttribute('data-block-title') === '[curtain-probe]'
    if (original === null) target.removeAttribute('data-block-title')
    else target.setAttribute('data-block-title', original)
    const restored = target.getAttribute('data-block-title') === original

    return {
      id,
      question,
      ok: wrote && restored,
      detail: `read ${blocks.length} block(s); write=${wrote} restore=${restored}`,
    }
  } catch (error) {
    return { id, question, ok: false, detail: `threw: ${(error as Error).message}` }
  }
}

export async function runProbes(): Promise<ProbeResult[]> {
  return [await probeHiddenPluginProperty(), probeParentDocument()]
}
