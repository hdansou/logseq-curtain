import { extractInlineFragments } from './inline'
import {
  PAYLOAD_PROPERTY_NAME,
  collectPayloads,
  parsePayloads,
  readRawPayload,
  serialisePayloads,
  type PayloadMap,
} from './payloads'

/**
 * Host binding for the payload store.
 *
 * Kept deliberately thin: every decision lives in `payloads.ts`, which is
 * pure and tested. This module only moves strings between there and the host,
 * so there is very little here that a test could not reach but should.
 */

/**
 * Declare the payload property, hidden by default.
 *
 * T2.1 confirmed `hide: true` reaches `:logseq.property/hide?`, which keeps
 * the property out of the block's property area. That conceals the row in the
 * UI only — it is unrelated to concealing a node from any reader, which T0
 * ruled out.
 */
export async function ensurePayloadProperty(): Promise<void> {
  await logseq.Editor.upsertProperty(PAYLOAD_PROPERTY_NAME, { type: 'string', hide: true })
}

export async function readPayloads(blockUuid: string): Promise<PayloadMap> {
  return parsePayloads(readRawPayload(await logseq.Editor.getBlock(blockUuid)))
}

export async function writePayloads(blockUuid: string, payloads: PayloadMap): Promise<void> {
  await logseq.Editor.upsertBlockProperty(
    blockUuid,
    PAYLOAD_PROPERTY_NAME,
    serialisePayloads(payloads),
  )
}

/**
 * Bring a block back into its canonical shape: keys in the macro, text in the
 * property.
 *
 * Two things can leave it otherwise. Un-concealing puts text inline so it can
 * be edited in place, and that text must move back out once the user is done.
 * Undo and ordinary editing remove a macro, orphaning the payload it used.
 *
 * Skips the block being edited. Rewriting a block under the cursor moves it,
 * which is worse than waiting — and the text inline is exactly what the user
 * asked to see while editing.
 *
 * Returns whether anything was written. Writing is itself a database change,
 * so reporting "nothing to do" is what stops this retriggering itself.
 */
export async function reconcileBlock(blockUuid: string): Promise<boolean> {
  const editing = await logseq.Editor.checkEditing()
  if (editing === blockUuid) return false

  const block = await logseq.Editor.getBlock(blockUuid)
  if (block === null) return false

  const title = (block as { title?: string }).title ?? ''
  const payloads = parsePayloads(readRawPayload(block))

  // Text typed in place goes back to the property first.
  const extracted = extractInlineFragments(title, payloads)
  if (extracted.changed) {
    await writePayloads(blockUuid, extracted.payloads)
    await logseq.Editor.updateBlock(blockUuid, extracted.title)
    return true
  }

  if (Object.keys(payloads).length === 0) return false
  const kept = collectPayloads(title, payloads)
  // `kept` is always a subset, so a matching size means nothing was dropped.
  if (Object.keys(kept).length === Object.keys(payloads).length) return false

  await writePayloads(blockUuid, kept)
  return true
}

/** Watch for blocks left inline-edited, or with macros undone away. */
export function registerPayloadCollection(): void {
  const pending = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | null = null

  logseq.DB.onChanged(({ blocks }) => {
    for (const block of blocks ?? []) {
      const uuid = (block as { uuid?: string } | null)?.uuid
      if (typeof uuid === 'string') pending.add(uuid)
    }
    if (pending.size === 0) return

    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      const batch = Array.from(pending)
      pending.clear()
      void Promise.all(batch.map((uuid) => reconcileBlock(uuid).catch(() => false)))
    }, 500)
  })
}

/** A block's title and payloads together, in one fetch. */
export async function readBlockText(
  blockUuid: string,
): Promise<{ title: string; payloads: PayloadMap } | null> {
  const block = await logseq.Editor.getBlock(blockUuid)
  if (block === null) return null
  return {
    title: (block as { title?: string }).title ?? '',
    payloads: parsePayloads(readRawPayload(block)),
  }
}
