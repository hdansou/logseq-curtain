import type { Audience } from './flags'
import { parseMacroArguments } from './macro'
import { renderCurtain } from './render'
import { resolveReference } from './payloads'
import { readPayloads } from './store'

/**
 * The `{{renderer :curtain, …}}` hook.
 *
 * Reveal state is per *slot*, not per block: a block can hold several
 * fragments, and a query-class block mounts the same macro in more than one
 * slot. `provideUI` is keyed on slot for the same reason — keying on the
 * block uuid renders the fragment into every slot that shares it.
 */
type SlotContext = { blockUuid: string; reference: string; audience: Audience }

const contexts = new Map<string, SlotContext>()
const revealed = new Set<string>()

/**
 * Every curtain conceals by default, whichever axis is set.
 *
 * `#norobots` withholds from agents rather than from the reader, so an earlier
 * version left it readable. In practice that made the mark easy to doubt: a
 * curtain that does not look like a curtain gives no confident signal it took
 * effect. The axis is carried in the styling instead, so nothing is lost.
 */
const concealedByDefault = (_audience: Audience): boolean => true

async function paint(slot: string): Promise<void> {
  const context = contexts.get(slot)
  if (context === undefined) return

  const payloads = await readPayloads(context.blockUuid)

  // A payload key in keyed mode, the text itself in inline mode.
  const text = resolveReference(payloads, context.reference)

  const template = renderCurtain({
    slot,
    key: context.reference,
    concealed: !revealed.has(slot) && concealedByDefault(context.audience),
    text,
    audience: context.audience,
  })

  logseq.provideUI({ key: `curtain-${slot}`, slot, template })
}

export function registerRenderer(): void {
  logseq.provideModel({
    async toggleCurtain(event: { dataset: Record<string, string> }) {
      const slot = event.dataset.curtainSlot
      if (!slot) return
      if (revealed.has(slot)) revealed.delete(slot)
      else revealed.add(slot)
      await paint(slot)
    },
  })

  logseq.provideStyle(`
    .curtain {
      cursor: pointer;
      border-radius: 3px;
      padding: 0 4px;
    }
    .curtain--concealed {
      background: var(--ls-secondary-background-color, #8884);
      color: var(--ls-secondary-text-color, #888);
      letter-spacing: 2px;
    }
    /* Which axis is in force, once the text itself is gone. */
    .curtain--concealed.curtain--norobots {
      background: color-mix(in srgb, var(--ls-active-primary-color, #d97706) 22%, transparent);
      color: var(--ls-active-primary-color, #b45309);
    }
    .curtain--concealed.curtain--spoiler.curtain--norobots {
      background: color-mix(in srgb, var(--ls-active-primary-color, #d97706) 22%, transparent);
      box-shadow: inset 2px 0 0 var(--ls-secondary-text-color, #888);
    }
    .curtain--norobots.curtain--revealed {
      text-decoration-color: var(--ls-active-primary-color, #b45309);
    }
    .curtain--revealed {
      background: var(--ls-secondary-background-color, #8882);
      text-decoration: underline dotted;
      text-underline-offset: 3px;
    }
  `)

  logseq.App.onMacroRendererSlotted(async ({ slot, payload }) => {
    const parsed = parseMacroArguments(payload.arguments ?? [])
    if (parsed === null) return
    contexts.set(slot, {
      blockUuid: payload.uuid,
      reference: parsed.reference,
      audience: parsed.audience,
    })
    await paint(slot)
  })
}
