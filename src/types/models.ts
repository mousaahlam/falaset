import type { ItemRow } from '@/types/database';

export type FeedItem = ItemRow;

export const isContent = (item: FeedItem) => item.kind === 'content';
export const isApp = (item: FeedItem) => item.kind === 'app';
