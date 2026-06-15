export type MorphQuestion = {
  id: string
  championIds: [string, string]
  image: string
  hints: string[]
}

export const morphQuestions: MorphQuestion[] = [
  {
    id: 'aatrox-cassiopeia',
    championIds: ['Aatrox', 'Cassiopeia'],
    image: '/images/morph-duell/aatrox-cassiopeia.png',
    hints: [
      'Eine dämonische Kriegergestalt trifft auf eine giftige Schlange.',
      'Gesucht sind ein Darkin und eine Noxianerin.',
      'Rote Blutmagie und grünes Gift prägen den Morph.',
    ],
  },
]

export function findMorphQuestion(championIds: string[]) {
  if (championIds.length !== 2) return null
  return (
    morphQuestions.find(
      (question) =>
        question.championIds.every((id) => championIds.includes(id)),
    ) ?? null
  )
}
