import type { SettingSchemaDesc } from '@logseq/libs/dist/LSPlugin.user'

export const SETTINGS: SettingSchemaDesc[] = [
  {
    key: 'revealNodesOnHover',
    type: 'boolean',
    title: 'Reveal spoilered nodes on hover',
    description:
      'When off, a spoilered node stays blurred until you click it. Off is the safer default for screen sharing: a stray mouse-over cannot reveal it.',
    default: false,
  },
]

export const revealOnHover = (): boolean => logseq.settings?.revealNodesOnHover === true
