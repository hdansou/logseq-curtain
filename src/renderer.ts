import type { Audience } from './flags'
import { parseMacroArguments } from './macro'
import { renderCurtain } from './render'
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

/** `#norobots` alone conceals nothing from the human — only `#spoiler` does. */
const concealedByDefault = (audience: Audience): boolean => audience.spoiler

async function paint(slot: string): Promise<void> {
  const context = contexts.get(slot)
  if (context === undefined) return

  const payloads = await readPayloads(context.blockUuid)

  // The reference is a payload key in keyed mode, or the concealed text itself
  // in inline mode. A key that resolves wins; anything else is literal text.
  const text = payloads[context.reference] ?? context.reference

  const template = renderCurtain({
    slot,
    key: context.reference,
    concealed: !revealed.has(slot) && concealedByDefault(context.audience),
    text,
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
    .curtain--revealed {
      background: var(--ls-secondary-background-color, #8882);
      text-decoration: underline dotted;
      text-underline-offset: 3px;
    }
    .curtain--broken {
      color: var(--ls-error-text-color, #c00);
      font-style: italic;
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
