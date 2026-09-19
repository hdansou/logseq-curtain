import { FLAG_NAMES, parseFlags, type Audience } from './flags'
import { formatMacro, spliceMacro, stripSlashTrigger } from './macro'
import { newKey, putPayload } from './payloads'
import { createSelectionMemory } from './selection'
import { readPayloads, writePayloads } from './store'
import { applyTags } from './tags'

/**
 * Entry points are split by *target*, not by context, because of a host
 * constraint: typing `/` replaces the current selection, so a slash command
 * can never act on selected text.
 *
 *   keyboard shortcut (editing) → conceal the selected fragment
 *   slash command               → tag the whole node
 *
 * A modifier chord leaves the selection intact, which is what makes the
 * fragment path possible at all.
 */
const memory = createSelectionMemory()

/** `/veil` means every axis, derived so a future third axis is covered. */
const AUDIENCES: Record<string, Audience> = {
  spoiler: parseFlags('spoiler'),
  norobots: parseFlags('norobots'),
  veil: parseFlags(FLAG_NAMES.join(' ')),
}

const FRAGMENT_BINDINGS: Record<string, string> = {
  spoiler: 'mod+shift+h',
  norobots: 'mod+shift+j',
  veil: 'mod+shift+k',
}

async function editingBlock(): Promise<string | null> {
  const uuid = await logseq.Editor.checkEditing()
  return typeof uuid === 'string' ? uuid : null
}

/** Move the selected text into the payload property, leaving the macro behind. */
async function concealFragment(audience: Audience): Promise<void> {
  const blockUuid = await editingBlock()
  if (blockUuid === null) return

  const content = await logseq.Editor.getEditingBlockContent()
  const selection = memory.consume({ blockUuid, content, now: Date.now() })
  if (selection === null) {
    logseq.UI.showMsg('Curtain: select some text in this block first', 'warning')
    return
  }

  const payloads = await readPayloads(blockUuid)
  const key = newKey(payloads)
  // Store before editing the block: if the write fails, the text is still
  // in the content rather than replaced by a macro pointing at nothing.
  await writePayloads(blockUuid, putPayload(payloads, key, selection.text))
  await logseq.Editor.updateBlock(
    blockUuid,
    spliceMacro(content, selection.start, selection.end, formatMacro(key, audience)),
  )
}

async function tagNode(audience: Audience, trigger: string): Promise<void> {
  const blockUuid = await editingBlock()
  if (blockUuid === null) return

  const content = await logseq.Editor.getEditingBlockContent()
  const stripped = stripSlashTrigger(content, trigger)
  if (stripped !== content) await logseq.Editor.updateBlock(blockUuid, stripped)

  await applyTags(blockUuid, audience)
}

export function registerCommands(): void {
  logseq.Editor.onInputSelectionEnd(async (event) => {
    const blockUuid = await editingBlock()
    if (blockUuid === null) return
    memory.remember({
      blockUuid,
      start: event.start,
      end: event.end,
      text: event.text,
      at: Date.now(),
    })
  })

  for (const [name, audience] of Object.entries(AUDIENCES)) {
    logseq.Editor.registerSlashCommand(name, () => tagNode(audience, name))
    logseq.App.registerCommandShortcut(
      { mode: 'editing', binding: FRAGMENT_BINDINGS[name] },
      () => concealFragment(audience),
      { label: `Curtain: conceal selection (${name})` },
    )
  }
}
