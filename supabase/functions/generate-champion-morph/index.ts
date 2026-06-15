import { createClient } from 'npm:@supabase/supabase-js@2'

const DATA_DRAGON_ROOT = 'https://ddragon.leagueoflegends.com'
const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/edits'
const MORPH_BUCKET = 'morph-images'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

type Champion = {
  id: string
  name: string
  title: string
}

type DataDragonResponse = {
  data: Record<string, Champion>
}

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string
  }>
  error?: {
    message?: string
  }
}

type MorphDifficulty = 'easy' | 'medium' | 'hard'

const difficultyPrompts: Record<MorphDifficulty, string[]> = {
  easy: [
    'Keep several iconic and recognizable visual traits from both source characters.',
    'Preserve their signature color families, characteristic facial details, and at least one recognizable armor or magical motif from each reference.',
    'The two source identities should be discoverable quickly by experienced players.',
  ],
  medium: [
    'Transform the face, hairstyle, silhouette, and costume into a genuinely new design instead of copying either source directly.',
    'Use recognizable traits from both references only as blended details; avoid reproducing either original face, exact outfit, or complete weapon.',
    'Change some signature colors and reinterpret iconic motifs so identification requires careful observation.',
  ],
  hard: [
    'Make the source identities deliberately subtle and difficult to recognize while still incorporating balanced visual DNA from both references.',
    'Do not reproduce either original face, hairstyle, exact outfit, full weapon, signature pose, or obvious color palette.',
    'Hide secondary traits from each reference inside a new face, new silhouette, unfamiliar costume, altered materials, and a substantially different color scheme.',
    'Avoid the single most iconic feature of each character. The answer should require expert knowledge and close inspection.',
  ],
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function loadChampions() {
  const versionsResponse = await fetch(`${DATA_DRAGON_ROOT}/api/versions.json`)
  if (!versionsResponse.ok) {
    throw new Error('Data Dragon konnte nicht geladen werden.')
  }

  const versions = (await versionsResponse.json()) as string[]
  const version = versions[0]
  if (!version) {
    throw new Error('Data Dragon hat keine Version zurückgegeben.')
  }

  const championsResponse = await fetch(
    `${DATA_DRAGON_ROOT}/cdn/${version}/data/de_DE/champion.json`,
  )
  if (!championsResponse.ok) {
    throw new Error('Die Champion-Liste konnte nicht geladen werden.')
  }

  const payload = (await championsResponse.json()) as DataDragonResponse
  return payload.data
}

async function loadImage(championId: string) {
  const imageUrl =
    `${DATA_DRAGON_ROOT}/cdn/img/champion/splash/${championId}_0.jpg`
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Das Referenzbild für ${championId} konnte nicht geladen werden.`)
  }
  return response.blob()
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Nur POST-Anfragen sind erlaubt.' }, 405)
  }

  try {
    let openAIKey = Deno.env.get('OPENAI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = request.headers.get('Authorization')

    if (!supabaseUrl || !serviceRoleKey || !authorization) {
      return jsonResponse({ error: 'Nicht autorisiert.' }, 401)
    }

    const accessToken = authorization.replace(/^Bearer\s+/i, '')
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    const { data: userData, error: userError } =
      await supabase.auth.getUser(accessToken)

    if (userError || !userData.user) {
      return jsonResponse({ error: 'Die Sitzung ist ungültig.' }, 401)
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profileError || profile?.role !== 'admin') {
      return jsonResponse(
        { error: 'Nur Admins dürfen Morph-Bilder generieren.' },
        403,
      )
    }
    if (!openAIKey) {
      const { data: storedKey, error: storedKeyError } = await supabase
        .rpc('get_morph_openai_key')
      if (storedKeyError) {
        console.error('Could not read OpenAI key from Vault', storedKeyError)
      } else if (typeof storedKey === 'string') {
        openAIKey = storedKey
      }
    }
    if (!openAIKey) {
      return jsonResponse(
        {
          code: 'OPENAI_NOT_CONFIGURED',
          error: 'Richte zuerst den OpenAI API-Zugang ein.',
        },
        503,
      )
    }

    const payload = await request.json() as {
      firstChampionId?: unknown
      secondChampionId?: unknown
      difficulty?: unknown
    }
    const difficulty = payload.difficulty
    if (
      typeof payload.firstChampionId !== 'string' ||
      typeof payload.secondChampionId !== 'string' ||
      payload.firstChampionId === payload.secondChampionId ||
      (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard')
    ) {
      return jsonResponse(
        { error: 'Bitte wähle zwei Champions und eine gültige Schwierigkeit aus.' },
        400,
      )
    }

    const champions = await loadChampions()
    const firstChampion = champions[payload.firstChampionId]
    const secondChampion = champions[payload.secondChampionId]
    if (!firstChampion || !secondChampion) {
      return jsonResponse({ error: 'Mindestens ein Champion ist ungültig.' }, 400)
    }

    const { data: recentGeneration } = await supabase
      .from('morph_generations')
      .select('created_at')
      .eq('owner_id', userData.user.id)
      .gte('created_at', new Date(Date.now() - 15_000).toISOString())
      .limit(1)
      .maybeSingle()

    if (recentGeneration) {
      return jsonResponse(
        { error: 'Bitte warte kurz, bevor du das nächste Bild generierst.' },
        429,
      )
    }

    const [firstImage, secondImage] = await Promise.all([
      loadImage(firstChampion.id),
      loadImage(secondChampion.id),
    ])

    const form = new FormData()
    form.append('model', 'gpt-image-2')
    form.append('image[]', firstImage, `${firstChampion.id}.jpg`)
    form.append('image[]', secondImage, `${secondChampion.id}.jpg`)
    form.append('quality', 'low')
    form.append('size', '1024x1024')
    form.append('output_format', 'webp')
    form.append(
      'prompt',
      [
        `Create one coherent League of Legends style character that visually fuses ${firstChampion.name} and ${secondChampion.name} from the two reference images.`,
        'The result must look like a single new person or creature, not two characters standing together.',
        'Blend the most recognizable facial features, silhouette, armor, colors, materials, and magical traits from both references evenly.',
        ...difficultyPrompts[difficulty],
        'Use a clean and simple League of Legends character concept-art style, not cinematic splash art.',
        'Show one centered character from the waist or chest up, facing mostly forward, large in frame and clearly separated from the background.',
        'Use a completely uniform pure black background (#000000) with no scenery, environment, floor, horizon, gradient, texture, smoke, particles, aura, props, or decorative elements.',
        'Use simple neutral studio lighting. Avoid dramatic rim lighting, lens effects, action poses, excessive detail, epic scale, and cinematic composition.',
        'The character must be the only visible subject and occupy most of the square image.',
        'Do not add text, logos, labels, borders, split screens, collages, extra characters, or duplicated bodies.',
      ].join(' '),
    )

    const imageResponse = await fetch(OPENAI_IMAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAIKey}`,
      },
      body: form,
    })
    const imagePayload = (await imageResponse.json()) as OpenAIImageResponse
    const encodedImage = imagePayload.data?.[0]?.b64_json
    if (!imageResponse.ok || !encodedImage) {
      console.error('OpenAI image edit failed', imageResponse.status, imagePayload)
      return jsonResponse(
        {
          error:
            imagePayload.error?.message ??
            'Das KI-Bild konnte nicht generiert werden.',
        },
        502,
      )
    }

    const pairName = [firstChampion.id, secondChampion.id]
      .sort()
      .join('-')
      .toLowerCase()
    const imagePath =
      `${userData.user.id}/${pairName}-${crypto.randomUUID()}.webp`
    const imageBytes = decodeBase64(encodedImage)
    const { error: uploadError } = await supabase.storage
      .from(MORPH_BUCKET)
      .upload(imagePath, imageBytes, {
        contentType: 'image/webp',
        upsert: false,
      })

    if (uploadError) {
      console.error('Morph upload failed', uploadError)
      return jsonResponse(
        { error: 'Das generierte Bild konnte nicht gespeichert werden.' },
        500,
      )
    }

    const { error: insertError } = await supabase
      .from('morph_generations')
      .insert({
        owner_id: userData.user.id,
        first_champion_id: firstChampion.id,
        first_champion_name: firstChampion.name,
        second_champion_id: secondChampion.id,
        second_champion_name: secondChampion.name,
        difficulty,
        image_path: imagePath,
      })

    if (insertError) {
      await supabase.storage.from(MORPH_BUCKET).remove([imagePath])
      console.error('Morph metadata insert failed', insertError)
      return jsonResponse(
        { error: 'Die generierte Quizkarte konnte nicht gespeichert werden.' },
        500,
      )
    }

    const { data: publicImage } = supabase.storage
      .from(MORPH_BUCKET)
      .getPublicUrl(imagePath)

    return jsonResponse({
      imageUrl: publicImage.publicUrl,
      difficulty,
      firstChampion: {
        id: firstChampion.id,
        name: firstChampion.name,
      },
      secondChampion: {
        id: secondChampion.id,
        name: secondChampion.name,
      },
    })
  } catch (error) {
    console.error('Champion morph generation failed', error)
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Die KI-Fusion ist fehlgeschlagen.',
      },
      500,
    )
  }
})
