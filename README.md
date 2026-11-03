# 🎬 CineLog

**Your movies. Your memories. Your people.**

CineLog is a cross-platform movie tracker and social movie diary: a responsive **Next.js website** and a native **React Native / Expo app**. Both run on **one Supabase backend**: the same auth, the same Postgres database, the same Realtime channels. Sign in on either one and you see the same watchlist, diary, friends, messages and profile.

---

## Architecture

```
cinelog/
├── packages/shared/          # @cinelog/shared — used by BOTH apps
│   └── src/
│       ├── api.ts            # all data access + business logic (auth, watchlist, diary, friends, chat, recs, notifications, realtime)
│       ├── tmdb.ts           # reusable TMDB service (calls the tmdb Edge Function; image URL helpers)
│       ├── stats.ts          # statistics engine (pure functions, unit-tested)
│       ├── dates.ts          # local-date helpers (week = Mon–Sun)
│       ├── validation.ts     # input validation shared by forms
│       ├── theme.ts          # design tokens (colours, fonts, radii)
│       └── types.ts          # row types
├── apps/web/                 # Next.js 15 (App Router) + Tailwind + Recharts
│   └── src/app/(auth)/…      # login, signup, forgot/reset password
│       src/app/(app)/…       # home, watchlist, diary, stats, friends, messages, profile, u/[username], settings, notifications
├── apps/mobile/              # Expo SDK 54 + Expo Router (native UI, no WebView)
│   └── app/(auth)/…, app/(tabs)/…, chat/[id], stats, profile, settings, notifications, user/[username]
└── supabase/
    ├── migrations/20261103000000_init.sql   # schema, RLS, RPCs, triggers, storage, realtime
    ├── functions/tmdb/                      # TMDB proxy (API key stays server-side)
    ├── functions/username-login/            # username → email lookup with the service role (server-side only)
    └── tests/rls.test.mjs                   # end-to-end DB/RLS test on real Postgres (PGlite)
```

**Why it's built this way**
- **One source of business logic.** Every screen on web and mobile calls `createCineLogApi(supabase)`, so rules like duplicate prevention and recommendation linking behave the same everywhere.
- **The database enforces the rules, not the UI.** Multi-step actions (mark as watched, add from recommendation, friend requests, recommendations in chat) are `SECURITY DEFINER` RPCs that run as one transaction. Clients can only write the columns they're allowed to (column-level grants), and RLS decides which rows they can see.
- **No secrets reach the client.** The TMDB key and the service-role key live only in Edge Function secrets. The apps ship only the public anon key.

---

## Feature map

| Area | What's implemented |
|---|---|
| Auth | Sign up (username + email + password, live username check), login with **email or username**, forgot / reset password (PKCE links on web, `cinelog://` deep links on mobile), logout, persistent sessions (cookies on web, AsyncStorage on mobile), change password |
| Profiles | Auto-created on sign-up, unique case-insensitive usernames, avatar upload to Supabase Storage (2 MB, jpg/png/webp, each user limited to their own folder), bio, display name, privacy **Public / Friends only / Private**, "share my diary" switch |
| Dashboard | Welcome, totals (watched, watchlist, this month, recommendations waiting), recently watched, recently added, friends' activity, recommendations from friends, Quick Add |
| Watchlist | TMDB search (poster, year, genres, overview), add / remove, statuses Want to Watch / Currently Watching / **Watched** (selecting it opens the diary form), filter, search, sort (recent / title / release), "Recommended by @user" tag, duplicates blocked by a DB unique constraint |
| Diary | Mark as Watched → **atomic move** to `watch_history` with today's date, title, TMDB id and poster; editable date, 1–5 stars, personal note; rewatches stored as separate entries; All / week / month / year / pick a month; search; sort by date; **grid, timeline and calendar** views |
| Statistics | Total, week, month, year, most-watched genres (donut), monthly activity, yearly activity, average rating, longest + current streak, time watched; week / month / year / all-time filters. All computed from real diary rows |
| Friends | Search by username, profiles, send / accept / reject / cancel / remove, tabs for My Friends / Received / Sent / Find, sending a request back to someone who already asked you accepts it, activity respects privacy through RLS |
| Messenger | 1:1 conversations between friends, Supabase Realtime delivery, emoji picker, timestamps, unread counts, read receipts ("Seen"), last-message previews, online status (Realtime Presence plus a last-seen heartbeat as fallback), pagination of older messages |
| Recommendations | "Recommend a Movie" in every chat → TMDB search → optional note → special movie card in the thread → recipient taps **Add to Watchlist** → watchlist row linked to the sender and the recommendation, sender notified, "Already in your watchlist" if it's a duplicate |
| Notifications | Friend requests, accepted requests, new messages (one per conversation, cleared when you read it), recommendations, "added your recommendation to their watchlist". Unread badge updates live |

---

## 1 · Supabase setup

1. Create a project at [supabase.com](https://supabase.com) and note the **Project URL** and **anon public key** (Settings → API).
2. Install the CLI and link the project:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   ```
3. **Run the migration** (creates all 10 tables, enums, indexes, RLS policies, RPCs, triggers, the `avatars` bucket and Realtime publication):
   ```bash
   supabase db push
   ```
   Or paste `supabase/migrations/20261103000000_init.sql` into the SQL editor and run it.
4. **Auth settings** (Authentication → URL Configuration):
   - Site URL: your web URL (e.g. `http://localhost:3000`, later your Vercel domain)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://YOUR-DOMAIN/auth/callback`, `cinelog://reset-password`, `cinelog://auth-callback`
   - Email confirmations can stay on. The sign-up screens handle the "check your inbox" step.
5. Realtime is enabled by the migration for `messages`, `notifications`, `conversation_members` and `friendships`. Supabase Realtime still applies RLS, so users only receive their own rows.

### Database tables
`profiles` · `movies` (TMDB cache) · `watchlist` · `watch_history` · `friendships` · `conversations` · `conversation_members` · `messages` · `movie_recommendations` · `notifications`

All primary keys are UUIDs, with foreign keys throughout. Key constraints:
- `watchlist (user_id, movie_id)` unique: no duplicate active entries.
- `friendships` unique on the unordered pair: only one relationship between two people.
- `conversations.direct_key` unique: one DM thread per pair.
- Rating `1–5`, watched date can't be in the future, length limits on bio, note and message.
- Indexes on username (trigram, for search), title (trigram), `(user_id, watched_on)`, `(conversation_id, created_at)`, unread notifications and more.

### Security model (summary)
- RLS is on for every table. Profiles are readable by signed-in users (needed for friend search). **Watchlist and diary** are readable only through `can_view_activity()`, which checks your privacy level, your diary-sharing switch and the friendship.
- Messages, members and conversations can only be read by **conversation members**. Users can only insert text messages, as themselves, into conversations they belong to.
- Writes are limited by column-level `GRANT`s: for example, a client can change a watchlist row's `status` but can't fake `recommended_by`.
- `username-login` resolves usernames with the service role inside the Edge Function and always returns the same generic error, so it can't be used to discover which users exist.

---

## 2 · TMDB setup

1. Create an account at [themoviedb.org](https://www.themoviedb.org/), then go to Settings → API and copy the **API Read Access Token** (v4). A v3 API key also works.
2. Store it as an Edge Function secret. Never put it in an app `.env`:
   ```bash
   supabase secrets set TMDB_READ_TOKEN=eyJhbGciOi...
   # or: supabase secrets set TMDB_API_KEY=xxxxxxxx
   ```
3. Deploy the functions:
   ```bash
   supabase functions deploy tmdb
   supabase functions deploy username-login --no-verify-jwt
   ```
   `tmdb` requires a signed-in user's JWT. `username-login` is public because it runs before login.

Supported actions: `search`, `details`, `trending`, `genres`. Posters and backdrops load from TMDB's image CDN (`image.tmdb.org`) at the size each screen needs (w92 to w500). This product uses the TMDB API but is not endorsed or certified by TMDB.

---

## 3 · Run locally

```bash
npm install                       # installs all workspaces
cp .env.example apps/web/.env.local      # fill in NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
cp apps/mobile/.env.example apps/mobile/.env   # fill in EXPO_PUBLIC_SUPABASE_URL / ANON_KEY

npm run dev:web                   # http://localhost:3000
npm run dev:mobile                # Expo — press i / a, or scan with Expo Go
```
For mobile, run `cd apps/mobile && npx expo install --fix` once to pin native module versions to your Expo SDK.

### Tests
```bash
npm test                                   # shared logic: stats, streaks, date ranges, calendar, validation (vitest)
cd supabase/tests && npm i && npm test     # applies the real migration to Postgres (PGlite) and walks the whole journey as 3 users
```
The DB test checks sign-up → profile trigger, duplicate prevention, mark as watched, rewatches, privacy (friends-only / private), friend-request flow, messaging access, unread counts and read receipts, recommendation → watchlist linking and notifications, and storage folder rules, including **12 blocked-access cases** (spoofing a sender, reading another user's messages, forging `recommended_by`, and so on).

---

## 4 · Deployment

**Database / functions:** `supabase db push` and `npm run functions:deploy` (needs the secrets above).

**Web (Vercel):**
1. Import the repo and set the **Root Directory** to `apps/web`. Vercel detects Next.js and the npm workspace.
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL=https://your-domain`.
3. Add `https://your-domain/auth/callback` to the Supabase redirect URLs.

**Mobile (EAS):**
```bash
cd apps/mobile
npm i -g eas-cli && eas login
eas build:configure
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://...
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value ...
eas build -p android     # or -p ios
eas submit               # store submission
```

---

## Environment variables

| Variable | Where | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | public (protected by RLS) |
| `NEXT_PUBLIC_SITE_URL` | web | public |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | public (protected by RLS) |
| `TMDB_READ_TOKEN` / `TMDB_API_KEY` | Supabase function secrets | **secret** |
| `SUPABASE_SERVICE_ROLE_KEY` | injected into Edge Functions automatically | **secret, never in an app** |

---

## Status & honest notes
- No live Supabase project or TMDB key was connected while building this. The integrations are complete and follow the setup steps above; nothing is mocked.
- Verified while building: the migration plus the full RLS journey on real Postgres (all checks pass), 20 unit tests for the shared logic, TypeScript strict mode and a production `next build` of the web app.
- The mobile app hasn't been run on a device yet. Run `npx expo install --fix` for your installed SDK before the first launch.
- Push notifications (APNs/FCM) aren't included. In-app notifications update in real time.
