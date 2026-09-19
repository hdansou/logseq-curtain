import '@logseq/libs'
import { runProbes, type ProbeResult } from './probes'

const RESULTS_PAGE = 'Curtain-Probe-Results'

/**
 * Write results into the graph as well as the console, so they can be read
 * back over the CLI without anyone copying console output by hand.
 */
async function recordResults(results: ProbeResult[]): Promise<void> {
  const stamp = new Date().toISOString()
  for (const result of results) {
    console.log(`[curtain-probe] ${result.id} ok=${result.ok} — ${result.detail}`)
  }
  try {
    await logseq.Editor.createPage(RESULTS_PAGE, {}, { createFirstBlock: false, redirect: false })
    for (const result of results) {
      await logseq.Editor.appendBlockInPage(
        RESULTS_PAGE,
        `PROBE ${result.id} ok=${result.ok} at ${stamp} :: ${result.question} :: ${result.detail}`,
      )
    }
  } catch (error) {
    console.error('[curtain-probe] could not write results to the graph:', error)
  }
}

async function main(): Promise<void> {
  const results = await runProbes()
  await recordResults(results)
  const failed = results.filter((r) => !r.ok).length
  logseq.UI.showMsg(
    failed === 0
      ? `Curtain probes: ${results.length}/${results.length} answered yes — see ${RESULTS_PAGE}`
      : `Curtain probes: ${failed} of ${results.length} answered no — see ${RESULTS_PAGE}`,
    failed === 0 ? 'success' : 'warning',
  )
}

logseq.ready(main).catch(console.error)
