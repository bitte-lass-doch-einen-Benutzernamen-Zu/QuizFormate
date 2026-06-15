# Supabase-Einrichtung

1. Unter <https://supabase.com/dashboard> ein kostenloses Projekt erstellen.
2. Unter **Authentication > Providers > Anonymous Sign-Ins** anonyme Logins
   aktivieren.
3. Alle Dateien unter `supabase/migrations` in aufsteigender Reihenfolge im
   **SQL Editor** ausführen. Bei einer eingeloggten und verknüpften
   Supabase-CLI genügt stattdessen:

```bash
npx supabase db push
```
4. Unter **Authentication > Users** einen Benutzer mit einer echten oder
   internen E-Mail und dem gewünschten Admin-Passwort erstellen. In der App
   meldet sich der Host trotzdem mit dem Benutzernamen `admin` an.
5. Im SQL Editor dessen Rolle setzen:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'DEINE_EMAIL'
);
```

6. Im Supabase-Dialog **Connect** die Project URL und den Publishable Key
   kopieren. Niemals den Secret Key im Browser oder in Vercel verwenden.
7. Lokal eine `.env.local` mit diesen Werten erstellen:

```dotenv
VITE_SUPABASE_URL=https://DEIN_PROJEKT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_ADMIN_EMAIL=E-MAIL_DES_SUPABASE_ADMIN_USERS
```

8. Dieselben Variablen in Vercel unter **Project Settings > Environment
   Variables** für Production, Preview und Development hinterlegen.

## Gastkonten aufräumen

Ein abgelaufener Spieleabend entzieht Gästen automatisch den Zugriff. Supabase
löscht anonyme Auth-Datensätze nicht automatisch. Für gelegentliche Abende
reicht es, diese Abfrage regelmäßig im SQL Editor auszuführen:

```sql
delete from auth.users
where is_anonymous is true
  and created_at < now() - interval '7 days';
```

Vor einer öffentlichen Freigabe sollte unter **Authentication > Bot and Abuse
Protection** zusätzlich Cloudflare Turnstile aktiviert werden.

## Live-Buzzer

Die Migration `202606150001_live_buzzer.sql` legt den gemeinsamen
Buzzer-Zustand, die Realtime-Freigabe und die serverseitigen Funktionen an.
Die Gewinnerentscheidung geschieht atomar in PostgreSQL; Browser-Zeitstempel
werden dafür nicht verwendet.
