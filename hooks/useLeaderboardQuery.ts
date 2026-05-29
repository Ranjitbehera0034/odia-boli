import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { queryKeys, STALE_TIMES } from '../services/queryClient';
import { useUserStore } from '../stores/useUserStore';
import { getRealLeagueState, LeagueState, LeaderboardScope } from '../services/league';

/**
 * Hook: Real-time leaderboard with 5-minute cache.
 * Optimistically shows last-known rank while refreshing in background.
 */
export function useLeaderboardQuery(scope: LeaderboardScope = 'global') {
  return useQuery({
    queryKey: queryKeys.leaderboard.byScope(scope),
    queryFn: async (): Promise<LeagueState> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('Not authenticated');
      }
      return getRealLeagueState(session.user.id, scope);
    },
    staleTime: STALE_TIMES.leaderboard,
    placeholderData: (prev) => prev, // Keep previous data visible during refetch
  });
}

/**
 * Mutation: Add XP and immediately invalidate leaderboard cache
 * so rank reflects new score within the next refetch cycle.
 */
export function useAddXpMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, source }: { amount: number; source: string }) => {
      await useUserStore.getState().addXp(amount, source);
    },
    onSuccess: () => {
      // Invalidate all leaderboard scopes so they refetch on next view
      qc.invalidateQueries({ queryKey: queryKeys.leaderboard.all });
    },
  });
}
