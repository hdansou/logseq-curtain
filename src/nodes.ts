import { CONCEALED_TITLE, concealBlockTitle } from './conceal'
import { expandDescendants } from './descendants'
import { isLocked, revealOnHover, setLocked, syncHoverSetting } from './settings'

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
const REVEALED_CLASS = 'curtain-node-revealed'
const HOVER_CLASS = 'curtain-hover-reveal'

let spoilered = new Set<string>()
/** Session-only: a reveal lasts until reload, never persisted to the graph. */
const revealed = new Set<string>()
let observer: MutationObserver | null = null

const hostDocument = (): Document | null => (window.parent as Window | undefined)?.document ?? null

async function fetchSpoileredUuids(): Promise<Set<string>> {
  // Tagging a page must conceal what is written on it, not just its title.
  // Every block on a page carries `:block/page`, so that one clause covers the
  // page's whole tree however deeply nested — no recursion needed.
  //
  // A tagged *block* needs its whole subtree, which a single `:block/parent`
  // clause does not give. Rules would, but they must be passed as a `%` input
  // and the bridge serialises inputs as JSON, which cannot express the symbols
  // a rule is made of — so the descent is finished in `expandDescendants`.
  const rows = (await logseq.DB.datascriptQuery(
    `[:find ?uuid
      :where
      [?tag :block/title "spoiler"]
      [?tagged :block/tags ?tag]
      (or-join [?b ?tagged]
        [(identity ?tagged) ?b]
        [?b :block/page ?tagged])
      [?b :block/uuid ?uuid]]`,
  )) as unknown[]
  const seeds = new Set(
    (rows ?? [])
      .map((row) => (Array.isArray(row) ? row[0] : row))
      .filter((value): value is string => typeof value === 'string'),
  )

  return expandDescendants(seeds, await fetchParentEdges())
}

/**
 * Child → parent for the pages that contain a tagged block.
 *
 * Scoped to those pages rather than the whole graph: a tagged block's subtree
 * cannot leave the page it is on.
 */
async function fetchParentEdges(): Promise<Map<string, string>> {
  const rows = (await logseq.DB.datascriptQuery(
    `[:find ?child ?parent
      :where
      [?tag :block/title "spoiler"]
      [?tagged :block/tags ?tag]
      [?tagged :block/page ?pg]
      [?b :block/page ?pg]
      [?b :block/parent ?p]
      [?b :block/uuid ?child]
      [?p :block/uuid ?parent]]`,
  )) as unknown[]

  const edges = new Map<string, string>()
  for (const row of rows ?? []) {
    if (!Array.isArray(row)) continue
    const [child, parent] = row
    if (typeof child === 'string' && typeof parent === 'string') edges.set(child, parent)
  }
  return edges
}

function applyToDocument(): void {
  const doc = hostDocument()
  if (doc === null) return

  for (const element of Array.from(doc.querySelectorAll<HTMLElement>('.ls-block[blockid]'))) {
    const uuid = element.getAttribute('blockid')
    const shouldConceal = uuid !== null && spoilered.has(uuid)
    element.classList.toggle(SPOILER_CLASS, shouldConceal)
    element.classList.toggle(REVEALED_CLASS, uuid !== null && revealed.has(uuid))
    // Hover-reveal is gated by a class rather than by rewriting the CSS.
    // `provideStyle` takes a style string and does not replace a previous one
    // by key, so re-providing left the old rule in the cascade and the setting
    // appeared to do nothing whichever way it was set.
    element.classList.toggle(HOVER_CLASS, shouldConceal && revealOnHover())
    // Defence in depth only — see the note above. Closes the attribute
    // channel; the rendered text remains readable in the DOM.
    if (shouldConceal) concealBlockTitle(element, CONCEALED_TITLE)
  }
}

async function refresh(): Promise<void> {
  spoilered = await fetchSpoileredUuids()
  applyToDocument()
}

/**
 * Provided once, and never rewritten.
 *
 * Hover-reveal is expressed as a rule gated on a class, not by re-providing
 * CSS with the rule added or removed: `provideStyle` takes a style string and
 * does not replace an earlier one, so rewriting only ever appended, leaving
 * the old rule live. Whether hover reveals is decided per element in
 * `applyToDocument`, which the observer already runs.
 */
function paintStyle(): void {
  logseq.provideStyle(`
    .${SPOILER_CLASS} .block-content {
      filter: blur(5px);
      transition: filter 120ms ease-in-out;
      cursor: pointer;
    }
    .${SPOILER_CLASS}.${HOVER_CLASS} .block-content:hover,
    .${SPOILER_CLASS}.${REVEALED_CLASS} .block-content {
      filter: none;
    }
  `)
}

/** Re-conceal everything and stop hover working, in one action. */
function setLockedAndRepaint(value: boolean): void {
  setLocked(value)
  if (value) revealed.clear()
  applyToDocument()
  logseq.UI.showMsg(
    value ? 'Curtain: locked — nothing reveals until unlocked' : 'Curtain: unlocked',
    value ? 'success' : 'warning',
  )
}

export async function registerNodeConcealment(): Promise<void> {
  paintStyle()
  syncHoverSetting(logseq.settings as Record<string, unknown> | undefined)
  // Take the new values from the event rather than re-reading the snapshot,
  // and repaint the classes: the setting changes which elements carry the
  // hover class, never the stylesheet.
  logseq.onSettingsChanged((next: Record<string, unknown>) => {
    syncHoverSetting(next)
    applyToDocument()
  })

  logseq.App.registerCommandPalette(
    { key: 'curtain-lock', label: 'Curtain: lock (re-conceal everything, disable hover)' },
    () => setLockedAndRepaint(true),
  )
  logseq.App.registerCommandPalette(
    { key: 'curtain-unlock', label: 'Curtain: unlock' },
    () => setLockedAndRepaint(false),
  )

  await refresh()

  const doc = hostDocument()
  if (doc !== null) {
    // Click to toggle a concealed node. Capture phase, so the reveal lands
    // before Logseq's own handler moves the block into edit mode.
    doc.addEventListener(
      'click',
      (event) => {
        const target = event.target as HTMLElement | null
        const block = target?.closest?.(`.${SPOILER_CLASS}`) as HTMLElement | null
        const uuid = block?.getAttribute('blockid')
        if (!uuid) return
        // While locked, not even a deliberate click reveals.
        if (isLocked()) return
        if (revealed.has(uuid)) revealed.delete(uuid)
        else revealed.add(uuid)
        applyToDocument()
      },
      true,
    )

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
