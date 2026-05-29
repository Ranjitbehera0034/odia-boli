import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { queryKeys, STALE_TIMES } from '../services/queryClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FriendProfile {
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  streak: number;
  weeklyXp: number;
  friendshipId: string;
  status: 'accepted' | 'pending_sent' | 'pending_received';
}

export interface FriendRequest {
  friendshipId: string;
  fromUserId: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
}

// ─── Fetchers ───────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

async function fetchFriendsList(): Promise<FriendProfile[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(
      `id, status, user_id, friend_id,
       friend:profiles!friendships_friend_id_fkey(username, avatar_url, level, streak, weekly_xp),
       user:profiles!friendships_user_id_fkey(username, avatar_url, level, streak, weekly_xp)`
    )
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');

  if (error) throw error;

  return (data || []).map((row: any) => {
    const isSender = row.user_id === userId;
    const profile = isSender ? row.friend : row.user;
    const friendId = isSender ? row.friend_id : row.user_id;
    return {
      userId: friendId,
      username: profile?.username ?? 'Player',
      avatarUrl: profile?.avatar_url ?? null,
      level: profile?.level ?? 1,
      streak: profile?.streak ?? 0,
      weeklyXp: profile?.weekly_xp ?? 0,
      friendshipId: row.id,
      status: 'accepted' as const,
    };
  });
}

async function fetchPendingRequests(): Promise<FriendRequest[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(
      `id, created_at, user_id,
       sender:profiles!friendships_user_id_fkey(username, avatar_url)`
    )
    .eq('friend_id', userId)
    .eq('status', 'pending');

  if (error) throw error;

  return (data || []).map((row: any) => ({
    friendshipId: row.id,
    fromUserId: row.user_id,
    username: row.sender?.username ?? 'Player',
    avatarUrl: row.sender?.avatar_url ?? null,
    createdAt: row.created_at,
  }));
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/** Friends list with 3-minute cache */
export function useFriendsQuery() {
  return useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: fetchFriendsList,
    staleTime: STALE_TIMES.friends,
    placeholderData: (prev) => prev,
  });
}

/** Pending incoming friend requests */
export function useFriendRequestsQuery() {
  return useQuery({
    queryKey: queryKeys.friends.requests(),
    queryFn: fetchPendingRequests,
    staleTime: STALE_TIMES.friends,
  });
}

/**
 * Mutation: Send friend request.
 * Optimistic update: immediately adds a pending entry to the friends list cache.
 */
export function useSendFriendRequestMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase.from('friendships').insert({
        user_id: userId,
        friend_id: targetUserId,
        status: 'pending',
      });
      if (error) throw error;
    },

    // Optimistic update: add pending friend to cache immediately
    onMutate: async (targetUserId: string) => {
      await qc.cancelQueries({ queryKey: queryKeys.friends.list() });
      const previousData = qc.getQueryData<FriendProfile[]>(queryKeys.friends.list());

      qc.setQueryData<FriendProfile[]>(queryKeys.friends.list(), (old = []) => [
        ...old,
        {
          userId: targetUserId,
          username: 'Sending...',
          avatarUrl: null,
          level: 1,
          streak: 0,
          weeklyXp: 0,
          friendshipId: `optimistic_${Date.now()}`,
          status: 'pending_sent' as const,
        },
      ]);

      return { previousData };
    },

    // Rollback on error
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousData) {
        qc.setQueryData(queryKeys.friends.list(), ctx.previousData);
      }
    },

    // Always refetch after mutation settles
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friends.all });
    },
  });
}

/**
 * Mutation: Accept a friend request.
 * Optimistic: moves request from pending → accepted in cache.
 */
export function useAcceptFriendRequestMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);
      if (error) throw error;
    },

    onMutate: async (friendshipId: string) => {
      await qc.cancelQueries({ queryKey: queryKeys.friends.requests() });
      const previousRequests = qc.getQueryData<FriendRequest[]>(queryKeys.friends.requests());

      // Optimistically remove from pending requests
      qc.setQueryData<FriendRequest[]>(queryKeys.friends.requests(), (old = []) =>
        old.filter((r) => r.friendshipId !== friendshipId)
      );

      return { previousRequests };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previousRequests) {
        qc.setQueryData(queryKeys.friends.requests(), ctx.previousRequests);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friends.all });
    },
  });
}

/**
 * Mutation: Reject/remove a friend request or friendship.
 */
export function useRejectFriendRequestMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friends.all });
    },
  });
}
