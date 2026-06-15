import { getSupabaseClient } from '../../../lib/supabase'

export type GeneratedMorph = {
  imageUrl: string
  firstChampion: {
    id: string
    name: string
  }
  secondChampion: {
    id: string
    name: string
  }
}

async function readFunctionError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return 'Die KI-Fusion ist fehlgeschlagen.'
  }

  const functionError = error as {
    message?: string
    context?: Response
  }
  if (functionError.context) {
    try {
      const payload = await functionError.context.clone().json() as {
        error?: unknown
      }
      if (typeof payload.error === 'string') return payload.error
    } catch {
      // Supabase may return a response without a JSON body.
    }
  }

  return functionError.message ?? 'Die KI-Fusion ist fehlgeschlagen.'
}

export async function generateMorph(
  firstChampionId: string,
  secondChampionId: string,
) {
  const client = await getSupabaseClient()
  const { data, error } = await client.functions.invoke<GeneratedMorph>(
    'generate-champion-morph',
    {
      body: {
        firstChampionId,
        secondChampionId,
      },
    },
  )

  if (error) throw new Error(await readFunctionError(error))
  if (!data?.imageUrl) {
    throw new Error('Der Server hat kein generiertes Bild zurückgegeben.')
  }
  return data
}
