export type QuizQuestion = {
  id: string
  category: string
  points: number
  question: string
  answer: string
  image?: string
  audio?: string
}

export type QuizCategory = {
  id: string
  title: string
  color: string
  questions: QuizQuestion[]
}

export type QuizBoard = {
  id: string
  title: string
  subtitle: string
  categories: QuizCategory[]
}

type QuestionInput = Omit<QuizQuestion, 'id' | 'category' | 'points'>

const pointSteps = [100, 200, 300, 500]

const createCategory = (
  boardId: string,
  id: string,
  title: string,
  color: string,
  multiplier: number,
  questions: QuestionInput[],
): QuizCategory => ({
  id: `${boardId}-${id}`,
  title,
  color,
  questions: questions.map((question, index) => ({
    ...question,
    id: `${boardId}-${id}-${index + 1}`,
    category: title,
    points: pointSteps[index] * multiplier,
  })),
})

const boardOne: QuizBoard = {
  id: 'board-1',
  title: 'Board 1',
  subtitle: 'Hauptrunde',
  categories: [
    createCategory('board-1', 'gaming', 'Gaming', '#ff4ecd', 1, [
      { question: 'Wie heißt der Klempner von Nintendo?', answer: 'Mario.' },
      { question: 'Wie viele verschiedene Champions gibt es aktuell in League of Legends?', answer: 'Ca. 170.' },
      { question: 'Wie heißt die Stadt von GTA V?', answer: 'Los Santos.' },
      { question: 'Wie viele aktive Spieler hat Steam gleichzeitig an einem Rekordtag erreicht?', answer: 'Ca. 40 Millionen.' },
    ]),
    createCategory('board-1', 'school', 'Zurück in die Schule', '#00f5d4', 1, [
      { question: 'Wie viele Kontinente gibt es?', answer: '7.' },
      { question: 'Welches chemische Symbol hat Gold?', answer: 'Au.' },
      { question: 'Wie heißt der längste Fluss Europas?', answer: 'Wolga.' },
      { question: 'Wie viele Knochen besitzt ein erwachsener Mensch?', answer: '206.' },
    ]),
    createCategory('board-1', 'countries', 'Länder', '#ffb703', 1, [
      { question: 'Was ist die Hauptstadt von Spanien?', answer: 'Madrid.' },
      { question: 'Welches Land hat die Hauptstadt Budapest?', answer: 'Ungarn.' },
      { question: 'Welches Land hat die meisten Einwohner Europas?', answer: 'Russland.' },
      { question: 'Welches Land besitzt die längste Küstenlinie der Erde?', answer: 'Kanada.' },
    ]),
    createCategory('board-1', 'people', 'Wer ist das?', '#a78bfa', 1, [
      { question: 'Wer ist auf diesem Bild zu sehen?', answer: 'Cristiano Ronaldo.', image: '/images/questions/Ronaldo.jpg' },
      { question: 'Wer ist auf diesem Bild zu sehen?', answer: 'Emma Watson.', image: '/images/questions/Emma Watson.jpg' },
      { question: 'Wer ist auf diesem Bild zu sehen?', answer: 'Jensen Huang.', image: '/images/questions/JensenHuang.jpg' },
      { question: 'Wer ist auf diesem Bild zu sehen?', answer: 'Jamieson Price.', image: '/images/questions/Jamieson Price.jpg' },
    ]),
    createCategory('board-1', 'brands', 'Marken & Logos', '#4cc9f0', 1, [
      { question: 'Zu welcher Marke gehört dieses Logo?', answer: 'McDonald’s.', image: '/images/questions/McDonalds.png' },
      { question: 'Zu welcher Marke gehört dieses Logo?', answer: 'Nike.', image: '/images/questions/Nike.png' },
      { question: 'Zu welcher Marke gehört dieses Logo?', answer: 'Discord.', image: '/images/questions/DiscordLogo.png' },
      { question: 'Zu welcher Marke gehört dieses Logo?', answer: 'Nvidia.', image: '/images/questions/NvidiaLogo.png' },
    ]),
    createCategory('board-1', 'food', 'Essen & Trinken', '#72ef36', 1, [
      { question: 'Aus welchem Land stammt die Pizza?', answer: 'Italien.' },
      { question: 'Welche Frucht ist die Hauptzutat von Guacamole?', answer: 'Avocado.' },
      { question: 'Welches alkoholische Getränk wird hauptsächlich aus Wacholderbeeren hergestellt?', answer: 'Gin.' },
      { question: 'Welches Gewürz sorgt hauptsächlich für die gelbe Farbe von Curry?', answer: 'Kurkuma.' },
    ]),
  ],
}

const boardTwo: QuizBoard = {
  id: 'board-2',
  title: 'Board 2',
  subtitle: 'Doppelte Punkte',
  categories: [
    createCategory('board-2', 'league', 'League of Legends', '#00f5d4', 2, [
      { question: 'Wie heißt die Standardkarte von League of Legends?', answer: "Summoner's Rift." },
      { question: 'Welcher Champion trägt den Titel „The River King“?', answer: 'Tahm Kench.' },
      { question: 'Wann war der Release von League of Legends? (Jahr)', answer: '2009.' },
      { question: 'Welcher Champion wurde als erster nach dem offiziellen Release von League of Legends veröffentlicht?', answer: 'Xin Zhao.' },
    ]),
    createCategory('board-2', 'animals', 'Tierwelt', '#ff6b93', 2, [
      { question: 'Welches Tier wird als König der Tiere bezeichnet?', answer: 'Löwe.' },
      { question: 'Welches Säugetier kann als einziges aktiv fliegen?', answer: 'Fledermaus.' },
      { question: 'Wie schwer wird ein ausgewachsener Blauwal ungefähr?', answer: 'Ca. 150 Tonnen.' },
      { question: 'Wie viele Arten von Ameisen gibt es weltweit ungefähr?', answer: 'Über 14.000.' },
    ]),
    createCategory('board-2', 'flags', 'Flaggen', '#a78bfa', 2, [
      { question: 'Zu welchem Land gehört diese Flagge?', answer: 'Kanada.', image: '/images/questions/Kanada.png' },
      { question: 'Zu welchem Land gehört diese Flagge?', answer: 'Nordkorea.', image: '/images/questions/NordkoreaFlagge.png' },
      { question: 'Zu welchem Land gehört diese Flagge?', answer: 'Elfenbeinküste.', image: '/images/questions/Elfenbeinküste.png' },
      { question: 'Zu welchem Land gehört diese Flagge?', answer: 'Bhutan.', image: '/images/questions/Bhutan.png' },
    ]),
    createCategory('board-2', 'abbreviations', 'Abkürzungen', '#ffb703', 2, [
      { question: 'Wofür steht die Abkürzung „GG“?', answer: 'Grundgesetz.' },
      { question: 'Wofür steht die Abkürzung „CEO“?', answer: 'Chief Executive Officer.' },
      { question: 'Wofür steht die Abkürzung „z. Zt.“?', answer: 'Zur Zeit.' },
      { question: 'Wofür steht die Abkürzung „AAMOF“?', answer: 'As a matter of fact.' },
    ]),
    createCategory('board-2', 'languages', 'Sprachen', '#4cc9f0', 2, [
      { question: 'Welche Sprache ist in diesem Audioclip zu hören?', answer: 'Englisch.', audio: '/images/questions/English.mp3' },
      { question: 'Welche Sprache ist in diesem Audioclip zu hören?', answer: 'Spanisch.', audio: '/images/questions/Spanish.mp3' },
      { question: 'Welche Sprache ist in diesem Audioclip zu hören?', answer: 'Polnisch.', audio: '/images/questions/Polnisch.mp3' },
      { question: 'Welche Sprache ist in diesem Audioclip zu hören?', answer: 'Finnisch.', audio: '/images/questions/Finnish.mp3' },
    ]),
    createCategory('board-2', 'extreme', 'Allgemeinwissen Extrem', '#72ef36', 2, [
      { question: 'Welcher Planet ist der Sonne am nächsten?', answer: 'Merkur.' },
      { question: 'Welches chemische Element hat das Symbol Fe?', answer: 'Eisen.' },
      { question: 'Welcher Planet besitzt aktuell die meisten bekannten Monde?', answer: 'Saturn.' },
      { question: 'Welches Land besitzt die meisten Zeitzonen der Welt?', answer: 'Frankreich, durch seine Überseegebiete.' },
    ]),
  ],
}

export const boards: QuizBoard[] = [boardOne, boardTwo]
export const allQuestions = boards.flatMap((board) =>
  board.categories.flatMap((category) => category.questions),
)
