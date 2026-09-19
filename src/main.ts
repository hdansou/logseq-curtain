import '@logseq/libs'
import { registerCommands } from './commands'
import { registerNodeConcealment } from './nodes'
import { registerRenderer } from './renderer'
import { ensurePayloadProperty, registerPayloadCollection } from './store'

async function main(): Promise<void> {
  await ensurePayloadProperty()
  registerRenderer()
  registerCommands()
  await registerNodeConcealment()
  registerPayloadCollection()
  console.log('[curtain] ready')
}

logseq.ready(main).catch(console.error)
