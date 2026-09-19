import type { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin.user'

export type StorageMode = 'property' | 'inline'

export const SETTINGS: SettingSchemaDesc[] = [
  {
    key: 'storageMode',
    type: 'enum',
    enumChoices: ['property', 'inline'],
    enumPicker: 'radio',
    title: 'Where new concealed text is stored',
    description:
      'property — the text lives in a hidden property and the macro holds a short id. Strongest: the text is not in the block title, so it stays out of search, exports and the graph view. inline — the text lives in the macro itself. Readable and editable in place, and it copies natively, but it IS in the block title, so search and exports can see it. Commas are normalised in this mode.',
    default: 'property',
  },
  {
    key: 'revealNodesOnHover',
    type: 'boolean',
    title: 'Reveal spoilered nodes on hover',
    description:
      'Hovering a blurred node reveals it. Convenient day to day. Turn it off, or use "Curtain: lock" before sharing your screen, when an accidental mouse-over would show something you did not mean to.',
    default: true,
  },
]

export const storageMode = (): StorageMode =>
  logseq.settings?.storageMode === 'inline' ? 'inline' : 'property'

/**
 * Session lock, set by the "Curtain: lock" command.
 *
 * Separate from the setting because the need is momentary — about to share a
 * screen — and reaching into plugin settings for that is friction at exactly
 * the wrong time. A lock also re-conceals whatever is already revealed, which
 * toggling the setting alone would not do.
 */
let locked = false

export const isLocked = (): boolean => locked
export const setLocked = (value: boolean): void => {
  locked = value
}

/** Hover reveals only when enabled *and* not locked. */
export const revealOnHover = (): boolean =>
  !locked && logseq.settings?.revealNodesOnHover !== false
