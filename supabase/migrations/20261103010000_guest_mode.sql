-- CineLog guest / trial mode.
-- Beginners can press "Try without an account": the app signs them in with a
-- Supabase anonymous user. Guests can search movies and use their own watchlist,
-- diary and stats. They are hidden from other users and cannot add friends,
-- chat or recommend. Creating an account later (email + password on the same
-- user) keeps everything they logged.

alter table public.profiles add column if not exists is_guest boolean not null default false;

create or replace function public.is_guest()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;
grant execute on function public.is_guest() to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  final  text;
begin
  -- Guest (anonymous) trial users get a private, hidden placeholder profile.
  if coalesce(new.is_anonymous, false) then
    insert into profiles (id, username, display_name, privacy, show_diary, is_guest)
    values (new.id, 'guest_' || substr(replace(new.id::text, '-', ''), 1, 12), 'Guest', 'private', false, true);
    return new;
  end if;
  if wanted !~ '^[a-z0-9_]{3,20}$' then
    wanted := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  final := wanted;
  if exists (select 1 from profiles where username = final) then
    final := left(wanted, 15) || '_' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;
  insert into profiles (id, username, display_name)
  values (new.id, final, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end $$;

-- When a guest upgrades (anonymous → permanent), give them their chosen username
-- and normal default privacy.
create or replace function public.handle_user_upgraded()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  final  text;
begin
  if coalesce(old.is_anonymous, false) and not coalesce(new.is_anonymous, false) then
    select username into final from profiles where id = new.id;
    if wanted ~ '^[a-z0-9_]{3,20}$' and not exists (select 1 from profiles where username = wanted and id <> new.id) then
      final := wanted;
    elsif final like 'guest\_%' then
      final := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
    end if;
    update profiles set
      is_guest = false, username = final,
      display_name = coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), nullif(display_name, 'Guest')),
      privacy = 'friends', show_diary = true
    where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_upgraded on auth.users;
create trigger on_auth_user_upgraded
  after update of is_anonymous on auth.users
  for each row execute function public.handle_user_upgraded();

-- Guests are invisible to everyone but themselves.
drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (not is_guest or id = auth.uid());

-- A guest may not flip its own guest flag through the API.
revoke update (is_guest) on public.profiles from authenticated;

-- Social actions are for real accounts only.
create or replace function public.send_friend_request(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_f friendships;
begin
  if public.is_guest() then raise exception 'Create a free account to add friends and chat.'; end if;
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_user_id = v_uid then raise exception 'you cannot befriend yourself'; end if;
  if not exists (select 1 from profiles where id = p_user_id and not is_guest) then raise exception 'user not found'; end if;

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
  if public.is_guest() then raise exception 'Create a free account to add friends and chat.'; end if;
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

create or replace function public.get_or_create_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_key text; v_id uuid;
begin
  if public.is_guest() then raise exception 'Create a free account to add friends and chat.'; end if;
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

create or replace function public.send_recommendation(
  p_conversation_id uuid, p_movie_id uuid, p_message text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_other uuid; v_rec uuid; v_msg uuid;
begin
  if public.is_guest() then raise exception 'Create a free account to add friends and chat.'; end if;
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

-- Guests can't post messages directly either (they are in no conversations anyway).
drop policy if exists "guests cannot message" on public.messages;
create policy "guests cannot message" on public.messages
  as restrictive for insert to authenticated with check (not public.is_guest());
