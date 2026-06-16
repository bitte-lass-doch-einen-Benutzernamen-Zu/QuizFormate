import { getSupabaseClient } from '../../../lib/supabase'

export type MorphDifficulty = 'easy' | 'medium' | 'hard'

export type GeneratedMorph = {
  id: string
  imageUrl: string
  difficulty: MorphDifficulty
  firstChampion: {
    id: string
    name: string
  }
  secondChampion: {
    id: string
    name: string
  }
}

export type SavedMorph = GeneratedMorph & {
  createdAt: string
  inQuiz: boolean
  quizPosition: number | null
  imagePath: string
  imageThumbUrl: string
}

type MorphGenerationRow = {
  id: string
  first_champion_id: string
  first_champion_name: string
  second_champion_id: string
  second_champion_name: string
  image_path: string
  difficulty: MorphDifficulty
  in_quiz: boolean
  quiz_position: number | null
  created_at: string
}

const MORPH_BUCKET = 'morph-images'

export async function hasMorphOpenAIKey() {
  const client = await getSupabaseClient()
  const { data, error } = await client.rpc('has_morph_openai_key')
  if (error) throw error
  return data === true
}

export async function setMorphOpenAIKey(apiKey: string) {
  const client = await getSupabaseClient()
  const { error } = await client.rpc('set_morph_openai_key', {
    api_key: apiKey.trim(),
  })
  if (error) throw error
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
  difficulty: MorphDifficulty,
) {
  const client = await getSupabaseClient()
  const { data, error } = await client.functions.invoke<GeneratedMorph>(
    'generate-champion-morph',
    {
      body: {
        firstChampionId,
        secondChampionId,
        difficulty,
      },
    },
  )

  if (error) throw new Error(await readFunctionError(error))
  if (!data?.imageUrl) {
    throw new Error('Der Server hat kein generiertes Bild zurückgegeben.')
  }
  return data
}

export async function loadSavedMorphs() {
  const client = await getSupabaseClient()
  const { data, error } = await client
    .from('morph_generations')
    .select(
      'id, first_champion_id, first_champion_name, second_champion_id, second_champion_name, image_path, difficulty, in_quiz, quiz_position, created_at',
    )
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data as MorphGenerationRow[]).map((row): SavedMorph => {
    const bucket = client.storage.from(MORPH_BUCKET)
    return {
      id: row.id,
      imagePath: row.image_path,
      imageUrl: bucket.getPublicUrl(row.image_path).data.publicUrl,
      imageThumbUrl: bucket.getPublicUrl(row.image_path, {
        transform: { width: 420, quality: 55 },
      }).data.publicUrl,
      difficulty: row.difficulty,
      firstChampion: {
        id: row.first_champion_id,
        name: row.first_champion_name,
      },
      secondChampion: {
        id: row.second_champion_id,
        name: row.second_champion_name,
      },
      createdAt: row.created_at,
      inQuiz: row.in_quiz,
      quizPosition: row.quiz_position,
    }
  })
}

export async function deleteSavedMorph(morph: SavedMorph) {
  const client = await getSupabaseClient()
  const { error } = await client
    .from('morph_generations')
    .delete()
    .eq('id', morph.id)
  if (error) throw error
  await client.storage.from(MORPH_BUCKET).remove([morph.imagePath])
}

export async function saveMorphQuiz(morphs: SavedMorph[]) {
  const client = await getSupabaseClient()
  const selectedMorphs = morphs
    .filter((morph) => morph.inQuiz)
    .sort(
      (left, right) =>
        (left.quizPosition ?? Number.MAX_SAFE_INTEGER) -
        (right.quizPosition ?? Number.MAX_SAFE_INTEGER),
    )

  const updates = morphs.map((morph) => {
    const position = selectedMorphs.findIndex((item) => item.id === morph.id)
    return client
      .from('morph_generations')
      .update({
        in_quiz: position >= 0,
        quiz_position: position >= 0 ? position : null,
      })
      .eq('id', morph.id)
  })

  const results = await Promise.all(updates)
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}
