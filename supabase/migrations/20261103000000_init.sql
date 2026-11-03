-- ═══════════════════════════════════════════════════════════════════════════
-- CineLog — initial schema
-- Tables, enums, indexes, constraints, RLS, RPCs, triggers, storage, realtime.
-- Every client (web + mobile) talks to this one schema through the anon key
-- plus the signed-in user's JWT. The service-role key is used only inside the
-- username-login Edge Function.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists citext;
create extension if not exists pg_trgm;

-- ───────────────────────────── Enums ─────────────────────────────
create type public.privacy_level      as enum ('public', 'friends', 'private');
create type public.watchlist_status   as enum ('want_to_watch', 'currently_watching');
create type public.friendship_status  as enum ('pending', 'accepted');
create type public.message_kind       as enum ('text', 'recommendation');
create type public.notification_type  as enum (
  'friend_request', 'friend_accepted', 'message', 'recommendation', 'recommendation_added'
);

-- ───────────────────────────── Helpers ─────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ───────────────────────────── 1. profiles ─────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      citext not null unique
                check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  display_name  text check (char_length(display_name) <= 50),
  bio           text check (char_length(bio) <= 280),
  avatar_url    text,
  privacy       public.privacy_level not null default 'friends',
  show_diary    boolean not null default true,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index profiles_username_trgm on public.profiles using gin ((username::text) gin_trgm_ops);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ───────────────────────────── 2. movies (TMDB cache) ─────────────────────────────
create table public.movies (
  id             uuid primary key default gen_random_uuid(),
  tmdb_id        integer not null unique,
  title          text not null,
  release_date   date,
  poster_path    text,
  backdrop_path  text,
  overview       text,
  genres         text[] not null default '{}',
  runtime        integer,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index movies_title_trgm on public.movies using gin (title gin_trgm_ops);
create trigger movies_touch before update on public.movies
  for each row execute function public.touch_updated_at();

-- ───────────────────────────── 9. movie_recommendations (declared early for FKs) ─────
create table public.movie_recommendations (
  id               uuid primary key default gen_random_uuid(),
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  recipient_id     uuid not null references public.profiles (id) on delete cascade,
  movie_id         uuid not null references public.movies (id) on delete cascade,
  conversation_id  uuid,
  message          text check (char_length(message) <= 500),
  watchlist_id     uuid,
  accepted_at      timestamptz,
  created_at       timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index recs_recipient_idx on public.movie_recommendations (recipient_id, created_at desc);
create index recs_sender_idx    on public.movie_recommendations (sender_id, created_at desc);

-- ───────────────────────────── 3. watchlist ─────────────────────────────
create table public.watchlist (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  movie_id           uuid not null references public.movies (id) on delete cascade,
  status             public.watchlist_status not null default 'want_to_watch',
  recommended_by     uuid references public.profiles (id) on delete set null,
  recommendation_id  uuid references public.movie_recommendations (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- duplicate prevention: one active entry per movie per user
  unique (user_id, movie_id)
);
create index watchlist_user_created_idx on public.watchlist (user_id, created_at desc);
create trigger watchlist_touch before update on public.watchlist
  for each row execute function public.touch_updated_at();

alter table public.movie_recommendations
  add constraint recs_watchlist_fk foreign key (watchlist_id)
  references public.watchlist (id) on delete set null;

-- ───────────────────────────── 4. watch_history (diary) ─────────────────────────────
-- Multiple rows per movie are allowed: every rewatch is its own entry.
create table public.watch_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  movie_id        uuid not null references public.movies (id) on delete restrict,
  -- denormalised snapshot so the diary survives any cache change
  tmdb_id         integer not null,
  title           text not null,
  poster_path     text,
  watched_on      date not null default current_date,
  rating          smallint check (rating between 1 and 5),
  note            text check (char_length(note) <= 4000),
  recommended_by  uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (watched_on <= current_date + 1)
);
create index history_user_date_idx  on public.watch_history (user_id, watched_on desc);
create index history_user_movie_idx on public.watch_history (user_id, movie_id);
create index history_created_idx    on public.watch_history (created_at desc);
create trigger history_touch before update on public.watch_history
  for each row execute function public.touch_updated_at();

-- ───────────────────────────── 5. friendships ─────────────────────────────
create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        public.friendship_status not null default 'pending',
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (requester_id <> addressee_id)
);
-- one relationship per unordered pair
create unique index friendships_pair_uniq on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

-- ───────────────────────────── 7. conversations ─────────────────────────────
create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  direct_key       text not null unique,            -- 'uuidA:uuidB' sorted, one DM per pair
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now()
);

-- ───────────────────────────── 8. conversation_members ─────────────────────────────
create table public.conversation_members (
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  last_read_at     timestamptz not null default to_timestamp(0),
  joined_at        timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index members_user_idx on public.conversation_members (user_id);

-- ───────────────────────────── 6. messages ─────────────────────────────
create table public.messages (
  id                 uuid primary key default gen_random_uuid(),
  conversation_id    uuid not null references public.conversations (id) on delete cascade,
  sender_id          uuid not null references public.profiles (id) on delete cascade,
  kind               public.message_kind not null default 'text',
  body               text check (char_length(body) <= 4000),
  recommendation_id  uuid references public.movie_recommendations (id) on delete set null,
  created_at         timestamptz not null default now(),
  check ((kind = 'text' and body is not null and char_length(btrim(body)) > 0)
      or (kind = 'recommendation' and recommendation_id is not null))
);
create index messages_conv_created_idx on public.messages (conversation_id, created_at desc);

alter table public.movie_recommendations
  add constraint recs_conversation_fk foreign key (conversation_id)
  references public.conversations (id) on delete set null;

-- ───────────────────────────── 10. notifications ─────────────────────────────
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete cascade,
  type        public.notification_type not null,
  entity_id   uuid,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ═══════════════════════════ Access helper functions ═══════════════════════════
-- SECURITY DEFINER so policies can call them without recursive RLS evaluation.

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

-- Can `viewer` see `owner`'s activity (watchlist, diary)?
create or replace function public.can_view_activity(owner uuid, viewer uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select owner = viewer or exists (
    select 1 from profiles p
    where p.id = owner and p.show_diary
      and (p.privacy = 'public' or (p.privacy = 'friends' and are_friends(owner, viewer)))
  );
$$;

create or replace function public.is_conversation_member(conv uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members where conversation_id = conv and user_id = uid);
$$;

-- ═══════════════════════════ Row Level Security ═══════════════════════════
alter table public.profiles              enable row level security;
alter table public.movies                enable row level security;
alter table public.watchlist             enable row level security;
alter table public.watch_history         enable row level security;
alter table public.friendships           enable row level security;
alter table public.conversations         enable row level security;
alter table public.conversation_members  enable row level security;
alter table public.messages              enable row level security;
alter table public.movie_recommendations enable row level security;
alter table public.notifications         enable row level security;

-- profiles: basic identity is discoverable by signed-in users (needed for friend search);
-- activity is gated separately by can_view_activity().
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- inserts happen only through the handle_new_user trigger.

-- movies: shared read-only cache; writes go through upsert_movie().
create policy "movies readable" on public.movies for select to authenticated using (true);

-- watchlist
create policy "watchlist visible per privacy" on public.watchlist
  for select to authenticated using (public.can_view_activity(user_id));
create policy "watchlist insert own" on public.watchlist
  for insert to authenticated with check (user_id = auth.uid() and recommendation_id is null and recommended_by is null);
create policy "watchlist update own" on public.watchlist
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "watchlist delete own" on public.watchlist
  for delete to authenticated using (user_id = auth.uid());

-- watch_history
create policy "history visible per privacy" on public.watch_history
  for select to authenticated using (public.can_view_activity(user_id));
create policy "history insert own" on public.watch_history
  for insert to authenticated with check (user_id = auth.uid());
create policy "history update own" on public.watch_history
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "history delete own" on public.watch_history
  for delete to authenticated using (user_id = auth.uid());

-- friendships: only the two parties see a row; state changes go through RPCs,
-- but either party may delete (reject / cancel / unfriend).
create policy "friendships visible to parties" on public.friendships
  for select to authenticated using (auth.uid() in (requester_id, addressee_id));
create policy "friendships delete by party" on public.friendships
  for delete to authenticated using (auth.uid() in (requester_id, addressee_id));

-- conversations / members / messages: members only.
create policy "conversations visible to members" on public.conversations
  for select to authenticated using (public.is_conversation_member(id));
create policy "members visible to co-members" on public.conversation_members
  for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "messages readable by members" on public.messages
  for select to authenticated using (public.is_conversation_member(conversation_id));
create policy "members send text messages" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and kind = 'text' and public.is_conversation_member(conversation_id)
  );

-- recommendations: sender + recipient only; created via send_recommendation().
create policy "recs visible to parties" on public.movie_recommendations
  for select to authenticated using (auth.uid() in (sender_id, recipient_id));

-- notifications: own only.
create policy "own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ═══════════════════════════ Auth → profile trigger ═══════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  final  text;
begin
  if wanted !~ '^[a-z0-9_]{3,20}$' then
    wanted := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  final := wanted;
  -- the sign-up form checks availability first; this only resolves a race.
  if exists (select 1 from profiles where username = final) then
    final := left(wanted, 15) || '_' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;
  insert into profiles (id, username, display_name)
  values (new.id, final, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════ Notification helper ═══════════════════════════
create or replace function public.notify(
  p_user uuid, p_actor uuid, p_type public.notification_type, p_entity uuid, p_data jsonb default '{}'::jsonb
) returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, actor_id, type, entity_id, data)
  values (p_user, p_actor, p_type, p_entity, coalesce(p_data, '{}'::jsonb));
$$;
revoke execute on function public.notify(uuid, uuid, public.notification_type, uuid, jsonb) from public, anon, authenticated;

-- ═══════════════════════════ RPCs ═══════════════════════════

-- Public, rate-insensitive availability check for the sign-up form.
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_username ~ '^[a-zA-Z0-9_]{3,20}$'
     and not exists (select 1 from profiles where username = p_username::citext);
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Cache a TMDB movie and return our uuid. Only whitelisted columns are writable.
create or replace function public.upsert_movie(
  p_tmdb_id int, p_title text, p_release_date date default null,
  p_poster_path text default null, p_backdrop_path text default null,
  p_overview text default null, p_genres text[] default '{}', p_runtime int default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_tmdb_id is null or p_tmdb_id <= 0 or coalesce(btrim(p_title), '') = '' then
    raise exception 'invalid movie';
  end if;
  insert into movies (tmdb_id, title, release_date, poster_path, backdrop_path, overview, genres, runtime)
  values (p_tmdb_id, left(p_title, 300), p_release_date, p_poster_path, p_backdrop_path,
          left(p_overview, 4000), coalesce(p_genres, '{}'), p_runtime)
  on conflict (tmdb_id) do update set
    title         = excluded.title,
    release_date  = coalesce(excluded.release_date, movies.release_date),
    poster_path   = coalesce(excluded.poster_path, movies.poster_path),
    backdrop_path = coalesce(excluded.backdrop_path, movies.backdrop_path),
    overview      = coalesce(excluded.overview, movies.overview),
    genres        = case when cardinality(excluded.genres) > 0 then excluded.genres else movies.genres end,
    runtime       = coalesce(excluded.runtime, movies.runtime)
  returning id into v_id;
  return v_id;
end $$;

-- Add to watchlist with duplicate prevention; optionally from a recommendation.
-- Returns {"status": "added" | "exists", "watchlist_id": uuid}
create or replace function public.add_to_watchlist(
  p_movie_id uuid,
  p_status public.watchlist_status default 'want_to_watch',
  p_recommendation_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_rec movie_recommendations;
  v_existing uuid;
  v_new uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  if p_recommendation_id is not null then
    select * into v_rec from movie_recommendations where id = p_recommendation_id;
    if not found or v_rec.recipient_id <> v_uid then raise exception 'recommendation not found'; end if;
    p_movie_id := v_rec.movie_id;
  end if;

  select id into v_existing from watchlist where user_id = v_uid and movie_id = p_movie_id;
  if v_existing is not null then
    return jsonb_build_object('status', 'exists', 'watchlist_id', v_existing);
  end if;

  insert into watchlist (user_id, movie_id, status, recommended_by, recommendation_id)
  values (v_uid, p_movie_id, p_status, v_rec.sender_id, v_rec.id)
  returning id into v_new;

  if v_rec.id is not null then
    update movie_recommendations set watchlist_id = v_new, accepted_at = now() where id = v_rec.id;
    perform notify(v_rec.sender_id, v_uid, 'recommendation_added', v_rec.id,
      jsonb_build_object('movie_id', v_rec.movie_id,
                         'title', (select title from movies where id = v_rec.movie_id)));
  end if;

  return jsonb_build_object('status', 'added', 'watchlist_id', v_new);
end $$;

-- Atomically: create diary entry (dated today unless given) and remove from watchlist.
create or replace function public.mark_as_watched(
  p_watchlist_id uuid, p_watched_on date default current_date,
  p_rating smallint default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_w watchlist;
  v_m movies;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_w from watchlist where id = p_watchlist_id and user_id = v_uid for update;
  if not found then raise exception 'watchlist entry not found'; end if;
  select * into v_m from movies where id = v_w.movie_id;

  insert into watch_history (user_id, movie_id, tmdb_id, title, poster_path, watched_on, rating, note, recommended_by)
  values (v_uid, v_m.id, v_m.tmdb_id, v_m.title, v_m.poster_path,
          coalesce(p_watched_on, current_date), p_rating, nullif(btrim(p_note), ''), v_w.recommended_by)
  returning id into v_id;

  delete from watchlist where id = v_w.id;
  return v_id;
end $$;

-- Log a watch directly (rewatch / quick add) without a watchlist entry.
create or replace function public.log_watch(
  p_movie_id uuid, p_watched_on date default current_date,
  p_rating smallint default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_m movies; v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_m from movies where id = p_movie_id;
  if not found then raise exception 'movie not found'; end if;
  insert into watch_history (user_id, movie_id, tmdb_id, title, poster_path, watched_on, rating, note)
  values (v_uid, v_m.id, v_m.tmdb_id, v_m.title, v_m.poster_path,
          coalesce(p_watched_on, current_date), p_rating, nullif(btrim(p_note), ''))
  returning id into v_id;
  -- watching it also clears it from the active watchlist
  delete from watchlist where user_id = v_uid and movie_id = p_movie_id;
  return v_id;
end $$;

-- Friend requests
create or replace function public.send_friend_request(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_f friendships;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_user_id = v_uid then raise exception 'you cannot befriend yourself'; end if;
  if not exists (select 1 from profiles where id = p_user_id) then raise exception 'user not found'; end if;

  select * into v_f from friendships
  where least(requester_id, addressee_id) = least(v_uid, p_user_id)
    and greatest(requester_id, addressee_id) = greatest(v_uid, p_user_id);

  if found then
    if v_f.status = 'accepted' then return jsonb_build_object('status', 'already_friends'); end if;
    if v_f.requester_id = v_uid then return jsonb_build_object('status', 'already_sent'); end if;
    -- they had already asked me: sending back means accepting
    update friendships set status = 'accepted', responded_at = now() where id = v_f.id;
    perform notify(v_f.requester_id, v_uid, 'friend_accepted', v_f.id);
    return jsonb_build_object('status', 'accepted', 'id', v_f.id);
  end if;

  insert into friendships (requester_id, addressee_id) values (v_uid, p_user_id) returning * into v_f;
  perform notify(p_user_id, v_uid, 'friend_request', v_f.id);
  return jsonb_build_object('status', 'sent', 'id', v_f.id);
end $$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_f friendships;
begin
  select * into v_f from friendships where id = p_request_id and addressee_id = v_uid and status = 'pending';
  if not found then raise exception 'request not found'; end if;
  if p_accept then
    update friendships set status = 'accepted', responded_at = now() where id = v_f.id;
    perform notify(v_f.requester_id, v_uid, 'friend_accepted', v_f.id);
  else
    delete from friendships where id = v_f.id;
  end if;
  delete from notifications where user_id = v_uid and type = 'friend_request' and entity_id = v_f.id;
end $$;

-- Direct conversation between friends (idempotent).
create or replace function public.get_or_create_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_key text; v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_other = v_uid then raise exception 'invalid recipient'; end if;
  if not are_friends(v_uid, p_other) then raise exception 'you can only message friends'; end if;
  v_key := least(v_uid, p_other)::text || ':' || greatest(v_uid, p_other)::text;
  select id into v_id from conversations where direct_key = v_key;
  if v_id is null then
    insert into conversations (direct_key) values (v_key)
    on conflict (direct_key) do update set direct_key = excluded.direct_key
    returning id into v_id;
    insert into conversation_members (conversation_id, user_id)
    values (v_id, v_uid), (v_id, p_other) on conflict do nothing;
  end if;
  return v_id;
end $$;

-- Recommend a movie inside a conversation → creates rec + special message.
create or replace function public.send_recommendation(
  p_conversation_id uuid, p_movie_id uuid, p_message text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_other uuid; v_rec uuid; v_msg uuid;
begin
  if not is_conversation_member(p_conversation_id, v_uid) then raise exception 'not a member'; end if;
  select user_id into v_other from conversation_members
  where conversation_id = p_conversation_id and user_id <> v_uid limit 1;
  if v_other is null then raise exception 'no recipient'; end if;
  if not exists (select 1 from movies where id = p_movie_id) then raise exception 'movie not found'; end if;

  insert into movie_recommendations (sender_id, recipient_id, movie_id, conversation_id, message)
  values (v_uid, v_other, p_movie_id, p_conversation_id, nullif(btrim(left(p_message, 500)), ''))
  returning id into v_rec;

  insert into messages (conversation_id, sender_id, kind, body, recommendation_id)
  values (p_conversation_id, v_uid, 'recommendation', nullif(btrim(left(p_message, 500)), ''), v_rec)
  returning id into v_msg;

  perform notify(v_other, v_uid, 'recommendation', v_rec,
    jsonb_build_object('movie_id', p_movie_id, 'conversation_id', p_conversation_id,
                       'title', (select title from movies where id = p_movie_id)));
  return v_msg;
end $$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language sql security definer set search_path = public as $$
  update conversation_members set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = auth.uid();
  update notifications set read_at = now()
  where user_id = auth.uid() and type = 'message' and read_at is null and entity_id = p_conversation_id;
$$;

-- Conversation list with last message preview + unread count.
create or replace function public.get_conversations()
returns table (
  conversation_id uuid, other_id uuid, other_username text, other_avatar_url text,
  other_last_seen_at timestamptz, last_message_at timestamptz,
  last_message_body text, last_message_kind public.message_kind, last_message_sender uuid,
  unread_count bigint
) language sql stable security definer set search_path = public as $$
  select c.id, p.id, p.username::text, p.avatar_url, p.last_seen_at, c.last_message_at,
         lm.body, lm.kind, lm.sender_id,
         (select count(*) from messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.created_at > me.last_read_at)
  from conversation_members me
  join conversations c on c.id = me.conversation_id
  join conversation_members other on other.conversation_id = c.id and other.user_id <> me.user_id
  join profiles p on p.id = other.user_id
  left join lateral (
    select m.body, m.kind, m.sender_id from messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
  order by c.last_message_at desc;
$$;

-- Profile summary that respects privacy (counts are hidden for private/non-friends).
create or replace function public.get_profile_summary(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_can boolean := can_view_activity(p_user_id, auth.uid()); v_out jsonb;
begin
  select jsonb_build_object(
    'can_view_activity', v_can,
    'friends_count', (select count(*) from friendships where status = 'accepted'
                       and p_user_id in (requester_id, addressee_id)),
    'watched_count', case when v_can then (select count(*) from watch_history where user_id = p_user_id) end,
    'watchlist_count', case when v_can then (select count(*) from watchlist where user_id = p_user_id) end,
    'favourite_genres', case when v_can then (
       select coalesce(jsonb_agg(g order by n desc), '[]'::jsonb) from (
         select genre as g, count(*) as n
         from watch_history h join movies m on m.id = h.movie_id, unnest(m.genres) genre
         where h.user_id = p_user_id group by genre order by n desc limit 3) t) end,
    'friendship', (select jsonb_build_object('id', f.id, 'status', f.status,
                     'direction', case when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end)
                   from friendships f
                   where least(requester_id, addressee_id) = least(auth.uid(), p_user_id)
                     and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user_id))
  ) into v_out;
  return v_out;
end $$;

create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update profiles set last_seen_at = now() where id = auth.uid();
$$;

-- Lock RPCs to signed-in users.
do $$
declare f text;
begin
  foreach f in array array[
    'upsert_movie(int,text,date,text,text,text,text[],int)',
    'add_to_watchlist(uuid,public.watchlist_status,uuid)',
    'mark_as_watched(uuid,date,smallint,text)',
    'log_watch(uuid,date,smallint,text)',
    'send_friend_request(uuid)',
    'respond_friend_request(uuid,boolean)',
    'get_or_create_conversation(uuid)',
    'send_recommendation(uuid,uuid,text)',
    'mark_conversation_read(uuid)',
    'get_conversations()',
    'get_profile_summary(uuid)',
    'touch_last_seen()',
    'are_friends(uuid,uuid)',
    'can_view_activity(uuid,uuid)',
    'is_conversation_member(uuid,uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ═══════════════════════════ Triggers: messages / friendships ═══════════════════════════
create or replace function public.on_message_inserted()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  -- the sender has obviously read up to their own message
  update conversation_members set last_read_at = new.created_at
  where conversation_id = new.conversation_id and user_id = new.sender_id;
  if new.kind = 'text' then
    for r in select user_id from conversation_members
             where conversation_id = new.conversation_id and user_id <> new.sender_id loop
      -- one unread "new messages" notification per conversation, refreshed
      delete from notifications
      where user_id = r.user_id and type = 'message' and entity_id = new.conversation_id and read_at is null;
      perform notify(r.user_id, new.sender_id, 'message', new.conversation_id,
                     jsonb_build_object('preview', left(new.body, 80)));
    end loop;
  end if;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_inserted();

-- ═══════════════════════════ Column-level privileges ═══════════════════════════
-- RLS decides WHICH rows; these grants decide WHICH columns a client may write.
-- Everything else (recommendation links, diary snapshots, friendship state) is
-- only writable through the SECURITY DEFINER RPCs above.
revoke insert, update on public.profiles from anon, authenticated;
grant update (username, display_name, bio, avatar_url, privacy, show_diary) on public.profiles to authenticated;

revoke insert, update, delete on public.movies from anon, authenticated;

revoke insert, update on public.watchlist from anon, authenticated;
grant update (status) on public.watchlist to authenticated;

revoke insert, update on public.watch_history from anon, authenticated;
grant update (watched_on, rating, note) on public.watch_history to authenticated;

revoke insert, update on public.friendships from anon, authenticated;
revoke insert, update, delete on public.conversations from anon, authenticated;
revoke insert, update, delete on public.conversation_members from anon, authenticated;
revoke update, delete on public.messages from anon, authenticated;
revoke insert, update, delete on public.movie_recommendations from anon, authenticated;
revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke all on all tables in schema public from anon;

-- ═══════════════════════════ Storage: avatars ═══════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "avatar public read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatar upload own folder" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update own folder" on storage.objects
  for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar delete own folder" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ═══════════════════════════ Realtime ═══════════════════════════
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.friendships;
