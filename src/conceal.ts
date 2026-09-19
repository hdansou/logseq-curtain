/**
 * Closing leak surface #2 for node-level concealment.
 *
 * `.ls-block` carries `data-block-title`, which holds the raw `:block/title`.
 * For an inline fragment that is harmless — the payload lives in a property,
 * so the attribute holds only the macro. For a node tagged `#spoiler` the
 * block's own title *is* the concealed content, so the attribute hands it to
 * any agent reading the DOM while the pixels show nothing.
 *
 * T2.2 confirmed a plugin can reach `parent.document` and rewrite this.
 */

/** The minimal DOM surface needed, so this stays testable without a DOM. */
export type AttributeTarget = {
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
}

export const BLOCK_TITLE_ATTRIBUTE = 'data-block-title'
export const CONCEALED_TITLE = '[concealed by curtain]'

/**
 * Replace a block's title attribute.
 *
 * Returns whether anything changed. That matters: a MutationObserver watching
 * attributes re-fires on its own writes, so reporting "no change" when already
 * concealed is what keeps it from looping.
 */
export function concealBlockTitle(element: AttributeTarget, placeholder: string): boolean {
  const current = element.getAttribute(BLOCK_TITLE_ATTRIBUTE)
  if (current === null || current === placeholder) return false
  element.setAttribute(BLOCK_TITLE_ATTRIBUTE, placeholder)
  return true
}
