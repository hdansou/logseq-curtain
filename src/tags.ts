import { FLAG_NAMES, type Audience, type FlagName } from './flags'

/**
 * Tag application. Tag names are the flag names, so the vocabulary cannot
 * drift between the inline and node forms.
 *
 * Uuids are cached because entity ids are stable for the session and every
 * command would otherwise re-resolve them.
 */
const tagUuidCache = new Map<FlagName, string>()

async function ensureTagUuid(name: FlagName): Promise<string> {
  const cached = tagUuidCache.get(name)
  if (cached !== undefined) return cached

  const tag = (await logseq.Editor.getTag(name)) ?? (await logseq.Editor.createTag(name))
  if (!tag?.uuid) throw new Error(`Curtain: could not resolve or create the #${name} tag`)

  const uuid = String(tag.uuid)
  tagUuidCache.set(name, uuid)
  return uuid
}

/** Apply every tag the audience calls for. `addTag` does not exist. */
export async function applyTags(blockUuid: string, audience: Audience): Promise<void> {
  for (const name of FLAG_NAMES) {
    if (!audience[name]) continue
    await logseq.Editor.addBlockTag(blockUuid, await ensureTagUuid(name))
  }
}
