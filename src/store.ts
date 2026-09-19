import {
  PAYLOAD_PROPERTY_NAME,
  parsePayloads,
  readRawPayload,
  serialisePayloads,
  type PayloadMap,
} from './payloads'

/**
 * Host binding for the payload store.
 *
 * Kept deliberately thin: every decision lives in `payloads.ts`, which is
 * pure and tested. This module only moves strings between there and the host,
 * so there is very little here that a test could not reach but should.
 */

/**
 * Declare the payload property, hidden by default.
 *
 * T2.1 confirmed `hide: true` reaches `:logseq.property/hide?`, which keeps
 * the property out of the block's property area. That conceals the row in the
 * UI only — it is unrelated to concealing a node from any reader, which T0
 * ruled out.
 */
export async function ensurePayloadProperty(): Promise<void> {
  await logseq.Editor.upsertProperty(PAYLOAD_PROPERTY_NAME, { type: 'string', hide: true })
}

export async function readPayloads(blockUuid: string): Promise<PayloadMap> {
  return parsePayloads(readRawPayload(await logseq.Editor.getBlock(blockUuid)))
}

export async function writePayloads(blockUuid: string, payloads: PayloadMap): Promise<void> {
  await logseq.Editor.upsertBlockProperty(
    blockUuid,
    PAYLOAD_PROPERTY_NAME,
    serialisePayloads(payloads),
  )
}
