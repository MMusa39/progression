import type { Recipe } from '@/features/api/types';

/** "Sam Lee", "@sam", or "a friend". */
export function sharerName(sharer: NonNullable<Recipe['sharedBy']>): string {
  return sharer.displayName ?? (sharer.username ? `@${sharer.username}` : 'a friend');
}
