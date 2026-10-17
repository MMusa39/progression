import type { UserSummary } from '@/features/api/types';

/** Name to show for a person: display name, else @username. */
export function personName(user: UserSummary): string {
  return user.displayName?.trim() || (user.username ? `@${user.username}` : 'Lifter');
}

/** "@mike", or null when the person hasn't picked a username. */
export function handle(user: UserSummary): string | null {
  return user.username ? `@${user.username}` : null;
}

/** Up to two initials for an avatar. */
export function initials(user: UserSummary): string {
  const source = user.displayName?.trim() || user.username || '?';
  return source
    .split(/[\s._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
