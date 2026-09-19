import '@logseq/libs'

/**
 * Curtain entry point.
 *
 * Deliberately inert: the host probes that lived here have served their
 * purpose and been removed (see docs/t0-findings.md). Phase 3 registers the
 * `:curtain` renderer and the payload store here.
 */
async function main(): Promise<void> {
  console.log('[curtain] ready')
}

logseq.ready(main).catch(console.error)
