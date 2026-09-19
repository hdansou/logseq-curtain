import { FLAG_NAMES, parseFlags, type Audience } from './flags'
import { formatMacro, spliceMacro, stripSlashTrigger } from './macro'
import { collectPayloads, newKey, putPayload, revealFragments } from './payloads'
import { extractInlineFragments, inlineFragments } from './inline'
import { createSelectionMemory } from './selection'
import { readBlockText, readPayloads, writePayloads } from './store'
import { applyTags } from './tags'
import { storageMode } from './settings'

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

  if (storageMode() === 'inline') {
    // The text stays in the macro. Nothing to store, so nothing can be
    // orphaned — but the text is in the block title and visible to search.
    await logseq.Editor.updateBlock(
      blockUuid,
      spliceMacro(content, selection.start, selection.end, formatMacro(selection.text, audience)),
    )
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

/**
 * Which blocks a node command acts on.
 *
 * A multi-block selection wins, so a range can be tagged in one action. Then
 * an explicit target (the block whose context menu was used), then whatever is
 * being edited.
 */
async function targetBlocks(explicit?: string): Promise<string[]> {
  const selected = await logseq.Editor.getSelectedBlocks()
  if (selected && selected.length > 0) return selected.map((block) => String(block.uuid))
  if (explicit !== undefined) return [explicit]
  const editing = await editingBlock()
  return editing === null ? [] : [editing]
}

async function tagBlocks(uuids: string[], audience: Audience): Promise<void> {
  for (const uuid of uuids) await applyTags(uuid, audience)
}

/** The slash path: strip the typed trigger, then tag. */
async function tagFromSlash(audience: Audience, trigger: string): Promise<void> {
  const blockUuid = await editingBlock()
  if (blockUuid !== null) {
    const content = await logseq.Editor.getEditingBlockContent()
    const stripped = stripSlashTrigger(content, trigger)
    if (stripped !== content) await logseq.Editor.updateBlock(blockUuid, stripped)
  }
  await tagBlocks(await targetBlocks(blockUuid ?? undefined), audience)
}

async function tagPage(pageName: string, audience: Audience): Promise<void> {
  // The page menu hands over a name, not a uuid.
  const page = await logseq.Editor.getPage(pageName)
  const uuid = (page as { uuid?: string } | null)?.uuid
  if (typeof uuid !== 'string') {
    logseq.UI.showMsg(`Curtain: could not resolve the page "${pageName}"`, 'error')
    return
  }
  await applyTags(uuid, audience)
}

/**
 * Remove the curtain entirely, leaving plain text.
 *
 * Distinct from converting between storage modes: those keep the fragment
 * concealed, this ends the concealment. Works in both modes, since
 * `revealFragments` treats a reference that names no payload as the text.
 *
 * Writes the restored title before clearing payloads, so a failure on the
 * second step leaves the text in both places rather than neither.
 */
async function unconceal(): Promise<void> {
  const uuids = await targetBlocks()
  let changed = 0

  for (const uuid of uuids) {
    const current = await readBlockText(uuid)
    if (current === null) continue
    const restored = revealFragments(current.title, current.payloads)
    if (restored.title === current.title) continue

    await logseq.Editor.updateBlock(uuid, restored.title)
    await writePayloads(uuid, restored.payloads)
    changed += 1
  }

  logseq.UI.showMsg(
    changed === 0 ? 'Curtain: nothing concealed here' : `Curtain: un-concealed ${changed} block(s)`,
    changed === 0 ? 'warning' : 'success',
  )
}

/**
 * Move a block's fragments between storage modes.
 *
 * Both directions write the destination before clearing the source, so a
 * failure on the second step leaves the text in both places rather than
 * neither.
 */
async function convertStorage(to: 'inline' | 'property'): Promise<void> {
  const uuids = await targetBlocks()
  let changed = 0

  for (const uuid of uuids) {
    const current = await readBlockText(uuid)
    if (current === null) continue

    if (to === 'inline') {
      const inlined = inlineFragments(current.title, current.payloads)
      if (inlined === current.title) continue
      await logseq.Editor.updateBlock(uuid, inlined)
      await writePayloads(uuid, collectPayloads(inlined, current.payloads))
    } else {
      const extracted = extractInlineFragments(current.title, current.payloads)
      if (!extracted.changed) continue
      await writePayloads(uuid, extracted.payloads)
      await logseq.Editor.updateBlock(uuid, extracted.title)
    }
    changed += 1
  }

  logseq.UI.showMsg(
    changed === 0
      ? `Curtain: nothing to move ${to === 'inline' ? 'into the macro' : 'into a property'}`
      : `Curtain: moved ${changed} block(s) ${to === 'inline' ? 'into the macro' : 'into a property'}`,
    changed === 0 ? 'warning' : 'success',
  )
}

/**
 * Copy the selected blocks with their concealed text restored.
 *
 * Copying normally yields the macro rather than the text, which makes a
 * concealed block useless to share. This leaves the block untouched — it is
 * the same restoration as `unconceal`, written to the clipboard instead of
 * back to the graph, so the two cannot drift apart.
 */
async function copyRevealed(): Promise<void> {
  const uuids = await targetBlocks()
  const lines: string[] = []

  for (const uuid of uuids) {
    const current = await readBlockText(uuid)
    if (current !== null) lines.push(revealFragments(current.title, current.payloads).title)
  }

  const text = lines.join('\n')
  if (text === '') {
    logseq.UI.showMsg('Curtain: nothing selected to copy', 'warning')
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    logseq.UI.showMsg(`Curtain: copied ${lines.length} block(s) with concealed text`, 'success')
  } catch {
    logseq.UI.showMsg('Curtain: could not reach the clipboard', 'error')
  }
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

  logseq.App.registerCommandPalette(
    { key: 'curtain-unconceal', label: 'Curtain: un-conceal (remove the curtain)' },
    () => unconceal(),
  )
  logseq.App.registerCommandPalette(
    { key: 'curtain-to-inline', label: 'Curtain: store concealed text in the macro (editable)' },
    () => convertStorage('inline'),
  )
  logseq.App.registerCommandPalette(
    { key: 'curtain-to-property', label: 'Curtain: store concealed text as a property (hidden)' },
    () => convertStorage('property'),
  )
  logseq.App.registerCommandPalette(
    { key: 'curtain-copy-revealed', label: 'Curtain: copy with concealed text' },
    () => copyRevealed(),
  )

  for (const [name, audience] of Object.entries(AUDIENCES)) {
    // Slash command → the node. Typing `/` replaces the selection, so it can
    // never act on a fragment.
    logseq.Editor.registerSlashCommand(name, () => tagFromSlash(audience, name))

    // Right-click a bullet, or a multi-block selection.
    logseq.Editor.registerBlockContextMenuItem(`Curtain: ${name}`, async ({ uuid }) => {
      await tagBlocks(await targetBlocks(String(uuid)), audience)
    })

    // The page ••• menu, for the page and journal cases.
    logseq.App.registerPageMenuItem(`Curtain: ${name}`, ({ page }) => {
      void tagPage(page, audience)
    })

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
