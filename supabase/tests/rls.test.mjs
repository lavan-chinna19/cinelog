// End-to-end database test for the CineLog migration.
// Runs real Postgres (PGlite, WASM) with minimal stubs of Supabase's auth/storage
// schemas, then walks the core user journey as two different signed-in users,
// checking RLS and RPC behaviour along the way.
//
//   cd supabase/tests && npm i @electric-sql/pglite @electric-sql/pglite/contrib && node rls.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite({ extensions: { citext, pg_trgm } });

const STUBS = `
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage; create schema extensions;
create table auth.users (id uuid primary key, email text unique, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
grant usage on schema public, auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant all on storage.objects to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';

async function as(uid, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
}
async function fails(uid, sql, params, label) {
  let threw = false;
  try { await as(uid, sql, params); } catch { threw = true; }
  assert.ok(threw, `expected failure: ${label}`);
  console.log('  ✓ blocked:', label);
}
const ok = (label) => console.log('  ✓', label);

await db.exec(STUBS);
await db.exec(readFileSync(new URL('../migrations/20261103000000_init.sql', import.meta.url), 'utf8'));
ok('migration applied');

// sign-ups (trigger creates profiles)
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values
  ($1,'ana@x.io','{"username":"ana"}'), ($2,'ben@x.io','{"username":"ben"}'), ($3,'cal@x.io','{"username":"cal"}')`, [A, B, C]);
const profs = await db.query('select username from profiles order by username');
assert.deepEqual(profs.rows.map(r => r.username), ['ana', 'ben', 'cal']); ok('profiles created by trigger');
assert.equal((await as(null, `select username_available('ana') v`)).rows[0].v, false);
assert.equal((await as(null, `select username_available('newbie') v`)).rows[0].v, true); ok('username availability');
await fails(null, 'select * from profiles', [], 'anon cannot read profiles');

// movies + watchlist
const mid = (await as(A, `select upsert_movie(27205,'Inception','2010-07-15','/p.jpg','/b.jpg','Dreams',array['Action','Science Fiction'],148) id`)).rows[0].id;
const mid2 = (await as(A, `select upsert_movie(157336,'Interstellar','2014-11-05','/i.jpg',null,'Space',array['Science Fiction','Drama'],169) id`)).rows[0].id;
await fails(A, `insert into movies (tmdb_id,title) values (1,'x')`, [], 'direct movie insert');
const add1 = (await as(A, `select add_to_watchlist($1) r`, [mid])).rows[0].r;
assert.equal(add1.status, 'added');
const add2 = (await as(A, `select add_to_watchlist($1) r`, [mid])).rows[0].r;
assert.equal(add2.status, 'exists'); ok('duplicate watchlist prevented');
await fails(A, `insert into watchlist (user_id,movie_id) values ($1,$2)`, [A, mid2], 'direct watchlist insert (RPC only)');
await as(A, `update watchlist set status='currently_watching' where id=$1`, [add1.watchlist_id]); ok('status update');
await fails(A, `update watchlist set recommended_by=$1 where id=$2`, [B, add1.watchlist_id], 'forging recommended_by');

// mark as watched → diary
const hid = (await as(A, `select mark_as_watched($1, null, 5::smallint, 'Mind-bending') id`, [add1.watchlist_id])).rows[0].id;
assert.equal((await as(A, 'select count(*)::int n from watchlist')).rows[0].n, 0);
const h = (await as(A, 'select * from watch_history where id=$1', [hid])).rows[0];
assert.equal(h.title, 'Inception'); assert.equal(h.rating, 5); assert.ok(h.watched_on); ok('mark as watched moves to diary with date');
await as(A, `update watch_history set watched_on='2026-10-01', note='edited' where id=$1`, [hid]); ok('diary date/note editable');
await as(A, `select log_watch($1, '2026-10-20', 4::smallint, 'Rewatch')`, [mid]);
assert.equal((await as(A, 'select count(*)::int n from watch_history where movie_id=$1', [mid])).rows[0].n, 2); ok('rewatches stored separately');
await fails(B, `update watch_history set note='hack' where id=$1 returning id`, [hid], 'other user editing diary')
  .catch(async () => { // RLS update on invisible rows affects 0 rows rather than erroring
    const r = await as(B, `update watch_history set note='hack' where id=$1 returning id`, [hid]);
    assert.equal(r.rows.length, 0); console.log('  ✓ blocked: other user editing diary (0 rows)');
  });

// privacy: default 'friends' → B (not friend) sees nothing
assert.equal((await as(B, 'select count(*)::int n from watch_history')).rows[0].n, 0); ok('non-friend cannot see friends-only diary');

// friends
await fails(B, `select get_or_create_conversation($1)`, [A], 'messaging a non-friend');
const fr = (await as(A, `select send_friend_request($1) r`, [B])).rows[0].r; assert.equal(fr.status, 'sent');
assert.equal((await as(A, `select send_friend_request($1) r`, [B])).rows[0].r.status, 'already_sent');
assert.equal((await as(B, `select count(*)::int n from notifications where type='friend_request'`)).rows[0].n, 1); ok('friend request + notification');
assert.equal((await as(C, 'select count(*)::int n from friendships')).rows[0].n, 0); ok('third party cannot see friendship');
await fails(A, `select respond_friend_request($1, true)`, [fr.id], 'requester accepting own request');
await as(B, `select respond_friend_request($1, true)`, [fr.id]);
assert.equal((await as(A, `select count(*)::int n from notifications where type='friend_accepted'`)).rows[0].n, 1); ok('accept + notification');
assert.equal((await as(B, 'select count(*)::int n from watch_history')).rows[0].n, 2); ok('friend can now see diary');
await as(A, `update profiles set privacy='private' where id=$1`, [A]);
assert.equal((await as(B, 'select count(*)::int n from watch_history')).rows[0].n, 0); ok('private profile hides diary from friends');
await as(A, `update profiles set privacy='friends' where id=$1`, [A]);
const summary = (await as(C, `select get_profile_summary($1) s`, [A])).rows[0].s;
assert.equal(summary.watched_count, null); assert.equal(summary.friends_count, 1); ok('profile summary respects privacy');
await fails(A, `update profiles set bio='x' where id=$1 returning id`, [B], 'editing someone else profile').catch(async () => {
  const r = await as(A, `update profiles set bio='x' where id=$1 returning id`, [B]); assert.equal(r.rows.length, 0);
  console.log('  ✓ blocked: editing someone else profile (0 rows)');
});

// messaging
const conv = (await as(A, `select get_or_create_conversation($1) id`, [B])).rows[0].id;
assert.equal((await as(B, `select get_or_create_conversation($1) id`, [A])).rows[0].id, conv); ok('one conversation per pair');
await as(A, `insert into messages (conversation_id, sender_id, body) values ($1,$2,'Hey 🎬')`, [conv, A]);
await fails(A, `insert into messages (conversation_id, sender_id, body) values ($1,$2,'spoof')`, [conv, B], 'sending as someone else');
await fails(C, `insert into messages (conversation_id, sender_id, body) values ($1,$2,'intrude')`, [conv, C], 'non-member sending');
assert.equal((await as(C, 'select count(*)::int n from messages')).rows[0].n, 0); ok('non-member cannot read messages');
const convB = (await as(B, 'select * from get_conversations()')).rows[0];
assert.equal(Number(convB.unread_count), 1); assert.equal(convB.last_message_body, 'Hey 🎬'); ok('conversation list + unread count');
await as(B, `select mark_conversation_read($1)`, [conv]);
assert.equal(Number((await as(B, 'select * from get_conversations()')).rows[0].unread_count), 0); ok('read receipts / mark read');

// recommendation → add to watchlist
const msgId = (await as(B, `select send_recommendation($1,$2,'You will love this') id`, [conv, mid2])).rows[0].id;
const recMsg = (await as(A, 'select * from messages where id=$1', [msgId])).rows[0];
assert.equal(recMsg.kind, 'recommendation');
const rec = (await as(A, 'select * from movie_recommendations where id=$1', [recMsg.recommendation_id])).rows[0];
await fails(C, `select add_to_watchlist(null, 'want_to_watch', $1)`, [rec.id], 'stranger redeeming recommendation');
const radd = (await as(A, `select add_to_watchlist(null, 'want_to_watch', $1) r`, [rec.id])).rows[0].r;
assert.equal(radd.status, 'added');
const w = (await as(A, 'select * from watchlist where id=$1', [radd.watchlist_id])).rows[0];
assert.equal(w.recommended_by, B); assert.equal(w.recommendation_id, rec.id);
assert.equal((await as(A, `select add_to_watchlist(null, 'want_to_watch', $1) r`, [rec.id])).rows[0].r.status, 'exists');
assert.equal((await as(B, `select count(*)::int n from notifications where type='recommendation_added'`)).rows[0].n, 1);
ok('recommendation → watchlist with "recommended by", dedupe, sender notified');
const wid = (await as(A, `select mark_as_watched($1) id`, [radd.watchlist_id])).rows[0].id;
assert.equal((await as(A, 'select recommended_by from watch_history where id=$1', [wid])).rows[0].recommended_by, B); ok('recommender carried into diary');

// unfriend
await as(B, `delete from friendships`);
assert.equal((await as(A, 'select count(*)::int n from friendships')).rows[0].n, 0); ok('remove friend');

// storage
await as(A, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${A}/me.png`]);
await fails(A, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${B}/x.png`], 'uploading into another user\'s avatar folder');

console.log('\nAll database checks passed.');
