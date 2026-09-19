import { CONCEALED_TITLE, concealBlockTitle } from './conceal'

/**
 * Node-level `#spoiler`: a visual treatment for human eyes.
 *
 * `.ls-block` carries no tag information, so this cannot be pure CSS. The
 * tagged uuids are queried, then rules are applied per `blockid`.
 *
 * IMPORTANT, and documented in docs/leak-surfaces.md: this conceals from a
 * reader, not from a DOM. CSS can blur or hide the text but cannot remove it,
 * and removing it would break editing. A browser-driving agent still reads a
 * spoilered node. Blocking agents is `#norobots`, enforced in the MCP filter —
 * not here.
 */
const SPOILER_CLASS = 'curtain-node-concealed'

let spoilered = new Set<string>()
let observer: MutationObserver | null = null

const hostDocument = (): Document | null => (window.parent as Window | undefined)?.document ?? null

async function fetchSpoileredUuids(): Promise<Set<string>> {
  const rows = (await logseq.DB.datascriptQuery(
    `[:find ?uuid
      :where
      [?b :block/tags ?t]
      [?t :block/title "spoiler"]
      [?b :block/uuid ?uuid]]`,
  )) as unknown[]
  const uuids = (rows ?? [])
    .map((row) => (Array.isArray(row) ? row[0] : row))
    .filter((value): value is string => typeof value === 'string')
  return new Set(uuids)
}

function applyToDocument(): void {
  const doc = hostDocument()
  if (doc === null) return

  for (const element of Array.from(doc.querySelectorAll<HTMLElement>('.ls-block[blockid]'))) {
    const uuid = element.getAttribute('blockid')
    const shouldConceal = uuid !== null && spoilered.has(uuid)
    element.classList.toggle(SPOILER_CLASS, shouldConceal)
    // Defence in depth only — see the note above. Closes the attribute
    // channel; the rendered text remains readable in the DOM.
    if (shouldConceal) concealBlockTitle(element, CONCEALED_TITLE)
  }
}

async function refresh(): Promise<void> {
  spoilered = await fetchSpoileredUuids()
  applyToDocument()
}

export async function registerNodeConcealment(): Promise<void> {
  logseq.provideStyle(`
    .${SPOILER_CLASS} .block-content {
      filter: blur(5px);
      transition: filter 120ms ease-in-out;
    }
    .${SPOILER_CLASS} .block-content:hover,
    .${SPOILER_CLASS}.curtain-node-revealed .block-content {
      filter: none;
    }
  `)

  await refresh()

  const doc = hostDocument()
  if (doc !== null) {
    // Re-apply after Logseq re-renders. concealBlockTitle reports "no change"
    // once a title is already concealed, so the observer does not retrigger
    // itself into a loop.
    observer = new MutationObserver(() => applyToDocument())
    observer.observe(doc.body, { childList: true, subtree: true })
  }

  let pending: ReturnType<typeof setTimeout> | null = null
  logseq.DB.onChanged(({ txData }) => {
    const touchesTags = (txData ?? []).some(([, attribute]) => String(attribute).includes('tags'))
    if (!touchesTags) return
    if (pending !== null) clearTimeout(pending)
    pending = setTimeout(() => void refresh(), 300)
  })
}
