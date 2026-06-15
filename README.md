# Quiz Duell

Lokale Quizshow-Web-App für Freunde, gebaut mit React, Vite und TypeScript. Das Spiel läuft vollständig im Browser und benötigt kein Backend.

## Funktionen

- Format-Startseite mit Quizduell, Morphduell und geplanten Formaten
- Atomarer Live-Buzzer mit vollständiger Reihenfolge aller Teilnehmer
- Realtime-Schalter für Buzzer und Texteingaben
- Live-Textantworten der Gäste für die Spielleitung
- Teilnehmerverwaltung mit Entfernen und individuellem Interaktions-Reset
- Gemeinsamer aktiver Raum mit persönlichen Einmal-Invite-Codes
- 2 Quizboards mit insgesamt 12 Kategorien und 48 Fragen
- Board 1: `100`, `200`, `300` und `500` Punkte
- Board 2: doppelte Punkte mit `200`, `400`, `600` und `1000`
- Klickbare Punktefelder und Frage-Modal
- Wertung über `Richtig`, `Falsch` und `Schließen`
- Automatischer Wechsel des aktiven Teams
- Frei konfigurierbare Teams mit Mitgliederlisten
- Manuelle Punktevergabe in 25er-Schritten
- Bei falschen Antworten wird die Hälfte des Fragenwerts abgezogen
- Einzelne gespielte Fragen können wieder freigegeben werden
- Synchronisierte Regieansicht unter `/answers`
- Punktestände und Spielfortschritt werden im Browser gespeichert
- Reset-Funktion für eine neue Runde
- Responsive Neon-/Gaming-Oberfläche für Desktop und Beamer

## Start in WebStorm

1. Projektordner in WebStorm öffnen.
2. Das integrierte Terminal öffnen.
3. Abhängigkeiten installieren:

```bash
npm install
```

4. Entwicklungsserver starten:

```bash
npm run dev
```

5. Die von Vite angezeigte lokale Adresse öffnen, normalerweise `http://localhost:5173`.

## Produktions-Build

```bash
npm run build
```

Der fertige Build wird im Ordner `dist` erstellt.

## Fragen bearbeiten

Alle Kategorien, Fragen und Antworten des Quizduells stehen in:

```text
src/formats/quiz-duell/data/questions.ts
```

Bilder und Audiodateien werden unter `public/images/questions` abgelegt.
Über die optionalen Felder `image` und `audio` können sie einer Frage
zugeordnet werden.

Jede Kategorie enthält vier Fragen. Board 1 verwendet `100`, `200`, `300`
und `500` Punkte. Auf Board 2 werden diese Werte verdoppelt.

## Lokaler Spielstand

Die App speichert Punkte, Teams und gespielte Felder im `localStorage` des Browsers. Über `Reset` wird ein neues Spiel gestartet.

Die Lösungsansicht kann parallel in einem zweiten Tab oder Fenster unter
`http://localhost:5173/answers` geöffnet werden. Sie folgt der auf dem
Quizboard geöffneten Frage automatisch.

## Projektstruktur

```text
src/
├── app/                         # Zentrale Routen aller Formate
├── formats/
│   └── quiz-duell/
│       ├── components/          # Board, Scoreboard und Dialoge
│       ├── data/                # Fragen und Kategorien
│       ├── hooks/               # Spiellogik und Aktionen
│       ├── pages/               # Quiz- und Regieansicht
│       ├── state/               # Persistenter Spielzustand
│       └── styles/              # Formatspezifische Styles
├── App.tsx
├── index.css                    # Globale Basis-Styles
└── main.tsx
```

Weitere Quizformate können als eigener Ordner unter `src/formats` ergänzt
und anschließend in `src/app/routes.tsx` registriert werden.

## Anmeldung und Einladungen

Die App unterstützt einen dauerhaften Admin-Login und temporäre Gastzugänge:

- Admins melden sich mit Benutzername und Passwort an und steuern die Formate.
- Gäste treten mit Name und zeitlich begrenztem Invite-Code bei.
- Gäste erhalten ausschließlich die Viewer-Rolle.
- Rollen und Zugriffe werden serverseitig über Supabase Row Level Security
  geprüft.

Die Einrichtung ist unter [`supabase/README.md`](supabase/README.md)
beschrieben.
