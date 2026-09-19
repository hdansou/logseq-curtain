import '@logseq/libs'
import { registerCommands } from './commands'
import { SETTINGS } from './settings'
import { registerNodeConcealment } from './nodes'
import { registerRenderer } from './renderer'
import { ensurePayloadProperty, registerPayloadCollection } from './store'

async function main(): Promise<void> {
  logseq.useSettingsSchema(SETTINGS)
  await ensurePayloadProperty()
  registerRenderer()
  registerCommands()
  await registerNodeConcealment()
  registerPayloadCollection()
  console.log('[curtain] ready')
}

logseq.ready(main).catch(console.error)
