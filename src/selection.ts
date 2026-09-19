/**
 * The remembered text selection.
 *
 * There is no "get current selection" API: `Editor.onInputSelectionEnd` is an
 * event carrying `{ start, end, text }`, and `BlockCursorPosition` exposes only
 * a caret offset with no range. So a selection has to be remembered when it
 * happens and used later — which means it can go stale between the two.
 *
 * Every staleness rule lives in `isSelectionUsable`, so the risky part of the
 * design is the tested part rather than logic spread through event handlers.
 */

/** A selection older than this is treated as history, not intent. */
export const SELECTION_STALE_AFTER_MS = 120_000

export type RememberedSelection = {
  blockUuid: string
  start: number
  end: number
  text: string
  /** When the selection was made, for the staleness check. */
  at: number
}

export type EditingContext = {
  blockUuid: string
  content: string
  now: number
}

/**
 * Is a remembered selection still safe to act on?
 *
 * The load-bearing rule is the content check: if the remembered offsets no
 * longer slice to the remembered text, the user has edited and the offsets
 * mean something else now. Re-deriving truth from current content catches
 * every edit without having to observe any edit.
 */
export function isSelectionUsable(
  remembered: RememberedSelection | null,
  context: EditingContext,
): boolean {
  if (remembered === null) return false

  // The user moved on to another block.
  if (remembered.blockUuid !== context.blockUuid) return false

  // A degenerate or out-of-bounds range. Checked before slicing because
  // slice() truncates silently instead of throwing, so an end past the content
  // length could otherwise satisfy the content check by accident.
  const { start, end, text } = remembered
  if (!Number.isInteger(start) || !Number.isInteger(end)) return false
  if (start < 0 || end > context.content.length || start >= end) return false

  // Nothing meaningful to conceal.
  if (text.trim() === '') return false

  // The edit check.
  if (context.content.slice(start, end) !== text) return false

  // Old enough to be history rather than intent.
  return context.now - remembered.at <= SELECTION_STALE_AFTER_MS
}

export type SelectionMemory = {
  remember: (selection: RememberedSelection) => void
  /**
   * Take the remembered selection if it is still usable.
   *
   * Always clears, usable or not. That makes "already used" impossible by
   * construction rather than something to check, and stops a rejected
   * selection lingering to be reconsidered in a later context.
   */
  consume: (context: EditingContext) => RememberedSelection | null
}

export function createSelectionMemory(): SelectionMemory {
  let remembered: RememberedSelection | null = null

  return {
    remember(selection) {
      remembered = selection
    },
    consume(context) {
      const result = isSelectionUsable(remembered, context) ? remembered : null
      remembered = null
      return result
    },
  }
}
