import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryClient';
import { useUserStore, UserState } from '../stores/useUserStore';
import { supabase } from '../services/supabase';

/**
 * Hook: Optimistic XP addition mutation.
 *
 * Flow:
 * 1. Instantly update the Zustand store (UI reflects new XP in <16ms)
 * 2. On success: invalidate leaderboard cache so rank reflects the new XP
 *    on the next background refetch
 * 3. On error: the Zustand store stays updated locally (intentional — XP
 *    gains are always synced up on next successful sync cycle)
 */
export function useAddXpMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, source }: { amount: number; source: string }) => {
      // This writes to SQLite + queues Supabase sync
      await useUserStore.getState().addXp(amount, source);
      return { amount, source };
    },

    // Zero-lag: XP is already in Zustand before this runs
    onSuccess: () => {
      // Invalidate both leaderboard scopes
      qc.invalidateQueries({ queryKey: queryKeys.leaderboard.all });
    },
  });
}

/**
 * Hook: Profile update mutation.
 * Optimistically reflects changes in profile query cache before server confirms.
 */
export function useUpdateProfileMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (fields: Parameters<UserState['updateProfile']>[0]) => {
      await useUserStore.getState().updateProfile(fields);
    },

    onMutate: async (fields) => {
      // No cache to cancel/update since profile is primarily Zustand-managed
      // but we invalidate on settle to keep any cached profile queries fresh
    },

    onSettled: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user.id) {
        qc.invalidateQueries({ queryKey: queryKeys.profile.byId(session.user.id) });
      }
    },
  });
}

/**
 * Hook: Lesson complete mutation.
 * Invalidates leaderboard after XP is awarded.
 */
export function useLessonCompleteMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      xpAmount,
      lessonId,
    }: {
      xpAmount: number;
      lessonId: string;
    }) => {
      await useUserStore.getState().addXp(xpAmount, `Lesson: ${lessonId}`);
      return { xpAmount, lessonId };
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leaderboard.all });
    },
  });
}
