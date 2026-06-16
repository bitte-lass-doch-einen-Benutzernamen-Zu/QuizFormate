import { getSupabaseClient } from '../../../lib/supabase'
import type { LeagueChampion } from '../../morph-duell/data/leagueChampions'

const VOICE_BUCKET = 'voice-quiz-audio'
const COMMUNITY_DRAGON_ROOT =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-choose-vo'

export type VoiceQuizQuestion = {
  id: string
  championId: string
  championKey: string
  championName: string
  championTitle: string
  audioUrl: string
  sourceType: 'communitydragon' | 'upload'
  inQuiz: boolean
  quizPosition: number | null
  createdAt: string
}

type VoiceQuestionRow = {
  id: string
  champion_id: string
  champion_key: string
  champion_name: string
  champion_title: string
  audio_url: string | null
  audio_path: string | null
  source_type: 'communitydragon' | 'upload'
  in_quiz: boolean
  quiz_position: number | null
  created_at: string
}

export function getCommunityDragonVoiceUrl(championKey: string) {
  return `${COMMUNITY_DRAGON_ROOT}/${championKey}.ogg`
}

function mapQuestion(
  row: VoiceQuestionRow,
  publicUrl: (path: string) => string,
): VoiceQuizQuestion {
  return {
    id: row.id,
    championId: row.champion_id,
    championKey: row.champion_key,
    championName: row.champion_name,
    championTitle: row.champion_title,
    audioUrl:
      row.audio_url ?? (row.audio_path ? publicUrl(row.audio_path) : ''),
    sourceType: row.source_type,
    inQuiz: row.in_quiz,
    quizPosition: row.quiz_position,
    createdAt: row.created_at,
  }
}

export async function loadVoiceQuestions() {
  const client = await getSupabaseClient()
  const { data, error } = await client
    .from('voice_quiz_questions')
    .select(
      'id, champion_id, champion_key, champion_name, champion_title, audio_url, audio_path, source_type, in_quiz, quiz_position, created_at',
    )
    .order('created_at', { ascending: false })

  if (error) throw error
  const publicUrl = (path: string) =>
    client.storage.from(VOICE_BUCKET).getPublicUrl(path).data.publicUrl
  return (data as VoiceQuestionRow[]).map((row) =>
    mapQuestion(row, publicUrl),
  )
}

export async function addCommunityDragonVoice(champion: LeagueChampion) {
  const client = await getSupabaseClient()
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw authError ?? new Error('Keine aktive Admin-Sitzung.')
  }

  const { error } = await client.from('voice_quiz_questions').insert({
    owner_id: authData.user.id,
    champion_id: champion.id,
    champion_key: champion.key,
    champion_name: champion.name,
    champion_title: champion.title,
    audio_url: getCommunityDragonVoiceUrl(champion.key),
    source_type: 'communitydragon',
  })
  if (error) throw error
}

export async function uploadVoiceQuestion(
  champion: LeagueChampion,
  file: File,
) {
  const client = await getSupabaseClient()
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw authError ?? new Error('Keine aktive Admin-Sitzung.')
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'ogg'
  const path = `${authData.user.id}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await client.storage
    .from(VOICE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError

  const { error: insertError } = await client
    .from('voice_quiz_questions')
    .insert({
      owner_id: authData.user.id,
      champion_id: champion.id,
      champion_key: champion.key,
      champion_name: champion.name,
      champion_title: champion.title,
      audio_path: path,
      source_type: 'upload',
    })

  if (insertError) {
    await client.storage.from(VOICE_BUCKET).remove([path])
    throw insertError
  }
}

export async function saveVoiceQuiz(questions: VoiceQuizQuestion[]) {
  const client = await getSupabaseClient()
  const selected = questions
    .filter((question) => question.inQuiz)
    .sort(
      (left, right) =>
        (left.quizPosition ?? Number.MAX_SAFE_INTEGER) -
        (right.quizPosition ?? Number.MAX_SAFE_INTEGER),
    )

  const results = await Promise.all(
    questions.map((question) => {
      const position = selected.findIndex((item) => item.id === question.id)
      return client
        .from('voice_quiz_questions')
        .update({
          in_quiz: position >= 0,
          quiz_position: position >= 0 ? position : null,
        })
        .eq('id', question.id)
        .select('id')
        .single()
    }),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}
