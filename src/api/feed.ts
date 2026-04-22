import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/types/models';

export interface FeedQuery {
  kind?: 'content' | 'app';
  country?: string;
  locale?: string;
  limit?: number;
}

export async function fetchFeed(query: FeedQuery = {}): Promise<FeedItem[]> {
  let q = supabase.from('items').select('*').order('rank', { ascending: false });

  if (query.kind) q = q.eq('kind', query.kind);
  if (query.country) q = q.eq('country', query.country);
  if (query.locale) q = q.eq('locale', query.locale);
  q = q.limit(query.limit ?? 50);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
