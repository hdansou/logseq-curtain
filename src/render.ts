/**
 * The concealed fragment's markup.
 *
 * Kept pure and separate from the renderer wiring so the guarantee that
 * matters can be unit-tested: **concealed markup must not contain the
 * payload.** If it does, every browser-driving agent reads the text straight
 * out of the DOM regardless of what the pixels show.
 */
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ESCAPES[char])

export const CONCEALED_PLACEHOLDER = '•••'

export function renderCurtain(options: {
  slot: string
  key: string
  concealed: boolean
  text: string
}): string {
  const { slot, key, concealed, text } = options
  const attrs =
    `class="curtain ${concealed ? 'curtain--concealed' : 'curtain--revealed'}" ` +
    `data-curtain-key="${escapeHtml(key)}" ` +
    `data-curtain-slot="${escapeHtml(slot)}" ` +
    `data-on-click="toggleCurtain" ` +
    `role="button" tabindex="0"`

  // The payload is interpolated only on the revealed branch. There is no
  // hidden-but-present variant: concealed markup never carries the text.
  return concealed
    ? `<span ${attrs}>${CONCEALED_PLACEHOLDER}</span>`
    : `<span ${attrs}>${escapeHtml(text)}</span>`
}
