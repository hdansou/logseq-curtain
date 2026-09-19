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

async function editingBlock(): Promise<string | null> {
  const uuid = await logseq.Editor.checkEditing()
  return typeof uuid === 'string' ? uuid : null
}

/**
 * Read a block's current text.
 *
 * Prefers the editing buffer, which is what the remembered offsets refer to
 * and may hold unsaved edits. Falls back to the stored block, because opening
 * the command palette can end the editing session while the selection is
 * still the one the user means.
 */
async function blockContent(blockUuid: string): Promise<string | null> {
  if ((await editingBlock()) === blockUuid) return logseq.Editor.getEditingBlockContent()
  const block = await logseq.Editor.getBlock(blockUuid)
  const text = (block as { title?: string; content?: string } | null)?.title
  return text ?? (block as { content?: string } | null)?.content ?? null
}

/** Move the selected text into the payload property, leaving the macro behind. */
async function concealFragment(audience: Audience): Promise<void> {
  const pending = memory.peek()
  if (pending === null) {
    logseq.UI.showMsg('Curtain: select some text in a block first', 'warning')
    return
  }

  const content = await blockContent(pending.blockUuid)
  if (content === null) return

  // If another block is being edited the user has moved on; otherwise act on
  // the remembered block even though editing may have ended.
  const editing = await editingBlock()
  const blockUuid = editing ?? pending.blockUuid

  const selection = memory.consume({ blockUuid, content, now: Date.now() })
  if (selection === null) {
    logseq.UI.showMsg('Curtain: that selection is no longer valid — select again', 'warning')
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
    // Slash command → the node. Typing `/` replaces the selection, so it can
    // never act on a fragment.
    logseq.Editor.registerSlashCommand(name, () => tagNode(audience, name))

    // Palette entry → the fragment. Opening the palette does not type into
    // the block, so the selection survives where a slash command destroys it.
    //
    // Deliberately ships with NO default keybinding. Two attempts at picking a
    // "free" chord both collided — the second with something outside Logseq's
    // own config entirely (a system shortcut or another plugin), which cannot
    // be enumerated from here. Logseq's own config uses `:binding []` for the
    // same reason, and plugin commands are rebindable under
    // Settings → Keymap → Plugins.
    logseq.App.registerCommandPalette(
      { key: `curtain-fragment-${name}`, label: `Curtain: conceal selected text (${name})` },
      () => concealFragment(audience),
    )
  }
}
