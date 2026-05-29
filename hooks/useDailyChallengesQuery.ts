import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { queryKeys, STALE_TIMES } from '../services/queryClient';
import { useChallengeStore, DailyChallenge } from '../stores/useChallengeStore';

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface ChestClaimResult {
  xp: number;
  gems: number;
}

/**
 * Query: Fetch today's daily challenges from Supabase.
 * Falls back gracefully to the Zustand store's offline-generated challenges
 * via initialData — so the UI always has something to render immediately.
 */
export function useDailyChallengesQuery() {
  const today = getTodayString();

  return useQuery({
    queryKey: queryKeys.challenges.daily(today),
    queryFn: async (): Promise<DailyChallenge[]> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // If not logged in, use offline store data
      if (!session) {
        return useChallengeStore.getState().challenges;
      }

      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('date', today);

      if (error) throw error;

      if (!data || data.length === 0) {
        // Server has no challenges yet — fall back to offline generation
        return useChallengeStore.getState().challenges;
      }

      // Merge with local progress from Zustand store
      const localChallenges = useChallengeStore.getState().challenges;
      return data.map((serverCh: any) => {
        const local = localChallenges.find((lc) => lc.id === serverCh.id);
        return {
          id: serverCh.id,
          description: serverCh.description,
          type: serverCh.type,
          target_count: serverCh.target_count,
          current_progress: local?.current_progress ?? 0,
          is_completed: local?.is_completed ?? 0,
          reward_xp: serverCh.reward_xp,
          reward_gems: serverCh.reward_gems,
          date: today,
        };
      });
    },

    staleTime: STALE_TIMES.dailyChallenges,

    // Show offline data immediately while fetching server data
    initialData: () => {
      const offline = useChallengeStore.getState().challenges;
      return offline.length > 0 ? offline : undefined;
    },
    initialDataUpdatedAt: 0, // Treat initial data as stale so we fetch in background
  });
}

/**
 * Mutation: Claim the daily chest.
 * Optimistic: marks chest as claimed instantly, rolls back if server rejects.
 */
export function useClaimChestMutation() {
  const qc = useQueryClient();
  const today = getTodayString();

  return useMutation({
    mutationFn: async (): Promise<ChestClaimResult | null> => {
      return useChallengeStore.getState().claimDailyChest();
    },

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.challenges.daily(today) });
      const previousData = qc.getQueryData<DailyChallenge[]>(queryKeys.challenges.daily(today));
      // No cache mutation needed — chest state lives in useChallengeStore
      return { previousData };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previousData) {
        qc.setQueryData(queryKeys.challenges.daily(today), ctx.previousData);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.challenges.daily(today) });
    },
  });
}
