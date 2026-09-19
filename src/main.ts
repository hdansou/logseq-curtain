import '@logseq/libs'
import { ensurePayloadProperty } from './store'

/**
 * Curtain entry point. Phase 3 registers the `:curtain` renderer here.
 */
async function main(): Promise<void> {
  await ensurePayloadProperty()
  console.log('[curtain] ready')
}

logseq.ready(main).catch(console.error)
