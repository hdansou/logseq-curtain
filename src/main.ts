import '@logseq/libs'
import { registerCommands } from './commands'
import { registerRenderer } from './renderer'
import { ensurePayloadProperty } from './store'

async function main(): Promise<void> {
  await ensurePayloadProperty()
  registerRenderer()
  registerCommands()
  console.log('[curtain] ready')
}

logseq.ready(main).catch(console.error)
