import { CONCEALED_TITLE, concealBlockTitle } from './conceal'
import { isLocked, revealOnHover, setLocked } from './settings'

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
const STYLE_KEY = 'curtain-nodes'

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
  // `:block/parent` adds the direct children of a tagged *block*. Deeper
  // descendants of a tagged block are NOT covered: that needs a recursive rule,
  // and rules must be passed as a `%` input, which the plugin bridge
  // serialises as JSON and cannot express. See TASKS T3.16.
  const rows = (await logseq.DB.datascriptQuery(
    `[:find ?uuid
      :where
      [?tag :block/title "spoiler"]
      [?tagged :block/tags ?tag]
      (or-join [?b ?tagged]
        [(identity ?tagged) ?b]
        [?b :block/page ?tagged]
        [?b :block/parent ?tagged])
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
    element.classList.toggle(REVEALED_CLASS, uuid !== null && revealed.has(uuid))
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
 * Hover-reveal is on by default and suppressed while locked.
 *
 * Unconditional hover-reveal defeated the point at the one moment it mattered:
 * a stray mouse-over during a screen share. Rather than making the everyday
 * case worse, the lock turns it off for as long as it is needed.
 */
function paintStyle(): void {
  const hoverRule = revealOnHover() ? `.${SPOILER_CLASS} .block-content:hover,` : ''
  logseq.provideStyle({
    key: STYLE_KEY,
    style: `
      .${SPOILER_CLASS} .block-content {
        filter: blur(5px);
        transition: filter 120ms ease-in-out;
        cursor: pointer;
      }
      ${hoverRule}
      .${SPOILER_CLASS}.${REVEALED_CLASS} .block-content {
        filter: none;
      }
    `,
  })
}

/** Re-conceal everything and stop hover working, in one action. */
function setLockedAndRepaint(value: boolean): void {
  setLocked(value)
  if (value) revealed.clear()
  paintStyle()
  applyToDocument()
  logseq.UI.showMsg(
    value ? 'Curtain: locked — nothing reveals until unlocked' : 'Curtain: unlocked',
    value ? 'success' : 'warning',
  )
}

export async function registerNodeConcealment(): Promise<void> {
  paintStyle()
  logseq.onSettingsChanged(() => paintStyle())

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
