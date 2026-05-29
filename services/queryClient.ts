import { QueryClient } from '@tanstack/react-query';

// ─── Query Key Factories ────────────────────────────────────────────────────
// Typed key factories keep keys consistent and allow precise cache invalidation.

export const queryKeys = {
  leaderboard: {
    all: ['leaderboard'] as const,
    byScope: (scope: string) => ['leaderboard', scope] as const,
  },
  friends: {
    all: ['friends'] as const,
    list: () => ['friends', 'list'] as const,
    requests: () => ['friends', 'requests'] as const,
    suggestions: () => ['friends', 'suggestions'] as const,
  },
  challenges: {
    all: ['challenges'] as const,
    daily: (date: string) => ['challenges', 'daily', date] as const,
    friendChallenge: (id: string) => ['challenges', 'friend', id] as const,
  },
  profile: {
    all: ['profile'] as const,
    byId: (userId: string) => ['profile', userId] as const,
  },
  vocabulary: {
    all: ['vocabulary'] as const,
    srs: () => ['vocabulary', 'srs'] as const,
  },
} as const;

// ─── Query Client Singleton ─────────────────────────────────────────────────

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default: 2-minute stale time for most remote data
      staleTime: 2 * 60 * 1000,
      // Retry failed queries twice before showing an error
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Refetch when app comes back to foreground
      refetchOnWindowFocus: true,
      // Don't refetch on mount if data is still fresh
      refetchOnMount: 'always',
    },
    mutations: {
      // Don't retry mutations automatically — let callers decide
      retry: 0,
    },
  },
});

// ─── Per-Query staleTime Overrides ──────────────────────────────────────────
// Set specific stale times by query key pattern after client creation.
// Leaderboard: 5 minutes (competitive data, some latency acceptable)
// Vocabulary/SRS: Infinity (user-owned data, only changes on explicit action)

export const STALE_TIMES = {
  leaderboard: 5 * 60 * 1000,       // 5 minutes
  friends: 3 * 60 * 1000,           // 3 minutes
  dailyChallenges: 10 * 60 * 1000,  // 10 minutes
  vocabulary: Infinity,              // Never stale — changes only on user action
  profile: 5 * 60 * 1000,           // 5 minutes
} as const;
