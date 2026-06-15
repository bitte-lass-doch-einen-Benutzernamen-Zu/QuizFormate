const DATA_DRAGON_ROOT = 'https://ddragon.leagueoflegends.com'

type DataDragonChampion = {
  id: string
  key: string
  name: string
  title: string
  image: {
    full: string
  }
  tags: string[]
}

type ChampionResponse = {
  data: Record<string, DataDragonChampion>
}

export type LeagueChampion = {
  id: string
  key: string
  name: string
  title: string
  roles: string[]
  square: string
  splash: string
  loading: string
}

export async function loadLeagueChampions(): Promise<{
  version: string
  champions: LeagueChampion[]
}> {
  const versionResponse = await fetch(`${DATA_DRAGON_ROOT}/api/versions.json`)
  if (!versionResponse.ok) {
    throw new Error('Die aktuelle Data-Dragon-Version konnte nicht geladen werden.')
  }

  const versions = (await versionResponse.json()) as string[]
  const version = versions[0]
  if (!version) {
    throw new Error('Data Dragon hat keine gültige Version zurückgegeben.')
  }

  const championsResponse = await fetch(
    `${DATA_DRAGON_ROOT}/cdn/${version}/data/de_DE/champion.json`,
  )
  if (!championsResponse.ok) {
    throw new Error('Die League-Champions konnten nicht geladen werden.')
  }

  const payload = (await championsResponse.json()) as ChampionResponse
  const champions = Object.values(payload.data)
    .map((champion) => ({
      id: champion.id,
      key: champion.key,
      name: champion.name,
      title: champion.title,
      roles: champion.tags,
      square: `${DATA_DRAGON_ROOT}/cdn/${version}/img/champion/${champion.image.full}`,
      splash: `${DATA_DRAGON_ROOT}/cdn/img/champion/splash/${champion.id}_0.jpg`,
      loading: `${DATA_DRAGON_ROOT}/cdn/img/champion/loading/${champion.id}_0.jpg`,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'de'))

  return { version, champions }
}
