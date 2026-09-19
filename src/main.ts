import '@logseq/libs'
import { registerCommands } from './commands'
import { ensurePayloadProperty } from './store'

async function main(): Promise<void> {
  await ensurePayloadProperty()
  registerCommands()
  console.log('[curtain] ready')
}

logseq.ready(main).catch(console.error)
