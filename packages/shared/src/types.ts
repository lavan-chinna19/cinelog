export type Privacy = 'public' | 'friends' | 'private';
export type WatchlistStatus = 'want_to_watch' | 'currently_watching';
export type NotificationType =
  | 'friend_request' | 'friend_accepted' | 'message' | 'recommendation' | 'recommendation_added';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  privacy: Privacy;
  show_diary: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export type ProfileLite = Pick<Profile, 'id' | 'username' | 'avatar_url'>;

export interface Movie {
  id: string;
  tmdb_id: number;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  genres: string[];
  runtime: number | null;
}

export interface WatchlistEntry {
  id: string;
  user_id: string;
  movie_id: string;
  status: WatchlistStatus;
  recommended_by: string | null;
  recommendation_id: string | null;
  created_at: string;
  movie: Movie;
  recommender?: ProfileLite | null;
}

export interface DiaryEntry {
  id: string;
  user_id: string;
  movie_id: string;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  watched_on: string; // YYYY-MM-DD
  rating: number | null;
  note: string | null;
  recommended_by: string | null;
  created_at: string;
  movie?: Pick<Movie, 'genres' | 'runtime' | 'release_date'> | null;
  recommender?: ProfileLite | null;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
  requester?: ProfileLite;
  addressee?: ProfileLite;
}

export interface ConversationSummary {
  conversation_id: string;
  other_id: string;
  other_username: string;
  other_avatar_url: string | null;
  other_last_seen_at: string | null;
  last_message_at: string;
  last_message_body: string | null;
  last_message_kind: 'text' | 'recommendation' | null;
  last_message_sender: string | null;
  unread_count: number;
}

export interface Recommendation {
  id: string;
  sender_id: string;
  recipient_id: string;
  movie_id: string;
  message: string | null;
  watchlist_id: string | null;
  accepted_at: string | null;
  created_at: string;
  movie: Movie;
  sender?: ProfileLite;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: 'text' | 'recommendation';
  body: string | null;
  recommendation_id: string | null;
  created_at: string;
  recommendation?: Recommendation | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  entity_id: string | null;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
  actor?: ProfileLite | null;
}

export interface ProfileSummary {
  can_view_activity: boolean;
  friends_count: number;
  watched_count: number | null;
  watchlist_count: number | null;
  favourite_genres: string[] | null;
  friendship: { id: string; status: 'pending' | 'accepted'; direction: 'incoming' | 'outgoing' } | null;
}

/** TMDB search result, normalised. */
export interface TmdbMovie {
  tmdb_id: number;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  genres: string[];
  runtime: number | null;
}

export interface Page<T> { items: T[]; page: number; hasMore: boolean }
