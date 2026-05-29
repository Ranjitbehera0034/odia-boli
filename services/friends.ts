import { supabase } from './supabase';

export interface FriendProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  streak: number;
  weeklyXp: number;
}

export interface FriendRequest {
  id: number;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  friend: {
    id: string;
    username: string;
    avatar_url: string | null;
    level: number;
    streak: number;
    weeklyXp: number;
  };
}

export interface ActivityFeedItem {
  id: string;
  username: string;
  userId: string;
  avatarUrl: string | null;
  lessonId: string;
  unitId: number;
  completedAt: number;
}

/**
 * Searches users by username (excluding current user)
 */
export async function searchUsers(query: string, currentUserId: string): Promise<FriendProfile[]> {
  if (!query.trim()) return [];
  
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      avatar_url,
      level,
      streaks ( current_streak ),
      leagues ( weekly_xp )
    `)
    .ilike('username', `%${query}%`)
    .neq('id', currentUserId)
    .eq('is_public', true)
    .limit(15);

  if (error) {
    console.error('Error searching users:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    username: row.username,
    avatar_url: row.avatar_url,
    level: row.level,
    streak: row.streaks?.[0]?.current_streak ?? 0,
    weeklyXp: row.leagues?.[0]?.weekly_xp ?? 0,
  }));
}

/**
 * Sends a friend request to a user
 */
export async function sendFriendRequest(senderId: string, receiverId: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('friendships')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      status: 'pending',
    });

  return { error };
}

/**
 * Accepts a pending friend request
 */
export async function acceptFriendRequest(friendshipId: number): Promise<{ error: any }> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);

  return { error };
}

/**
 * Rejects or cancels a friend request
 */
export async function rejectOrCancelFriendRequest(friendshipId: number): Promise<{ error: any }> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);

  return { error };
}

/**
 * Unfriends an existing friend
 */
export async function removeFriend(userId: string, friendId: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`);

  return { error };
}

/**
 * Fetches all friendships for the current user
 * Returns accepted friends, incoming pending requests, and outgoing pending requests
 */
export async function getFriendships(userId: string): Promise<{
  friends: FriendProfile[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
}> {
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      status,
      sender_id,
      receiver_id,
      sender:profiles!friendships_sender_id_fkey (
        id,
        username,
        avatar_url,
        level,
        streaks ( current_streak ),
        leagues ( weekly_xp )
      ),
      receiver:profiles!friendships_receiver_id_fkey (
        id,
        username,
        avatar_url,
        level,
        streaks ( current_streak ),
        leagues ( weekly_xp )
      )
    `)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

  if (error) {
    console.error('Error fetching friendships:', error);
    return { friends: [], incomingRequests: [], outgoingRequests: [] };
  }

  const friends: FriendProfile[] = [];
  const incomingRequests: FriendRequest[] = [];
  const outgoingRequests: FriendRequest[] = [];

  for (const item of (data || [])) {
    const isSender = item.sender_id === userId;
    const friendData = (isSender ? item.receiver : item.sender) as any;
    if (!friendData) continue;

    // Handle array case if returned as array, otherwise object
    const actualFriend = Array.isArray(friendData) ? friendData[0] : friendData;
    if (!actualFriend) continue;

    const mappedFriend = {
      id: actualFriend.id,
      username: actualFriend.username,
      avatar_url: actualFriend.avatar_url,
      level: actualFriend.level,
      streak: actualFriend.streaks?.[0]?.current_streak ?? 0,
      weeklyXp: actualFriend.leagues?.[0]?.weekly_xp ?? 0,
    };


    if (item.status === 'accepted') {
      friends.push(mappedFriend);
    } else if (item.status === 'pending') {
      const request: FriendRequest = {
        id: item.id,
        sender_id: item.sender_id,
        receiver_id: item.receiver_id,
        status: item.status,
        friend: mappedFriend,
      };
      
      if (isSender) {
        outgoingRequests.push(request);
      } else {
        incomingRequests.push(request);
      }
    }
  }

  return { friends, incomingRequests, outgoingRequests };
}

/**
 * Fetches other users in the same league tier who aren't currently friends or pending friends
 */
export async function getLeagueSuggestions(
  userId: string,
  userLeagueTier: string,
  excludeUserIds: string[]
): Promise<FriendProfile[]> {
  const { data, error } = await supabase
    .from('leagues')
    .select(`
      user_id,
      league_tier,
      profile:profiles (
        id,
        username,
        avatar_url,
        level,
        streaks ( current_streak ),
        leagues ( weekly_xp )
      )
    `)
    .eq('league_tier', userLeagueTier)
    .neq('user_id', userId)
    .limit(30);

  if (error) {
    console.error('Error fetching league suggestions:', error);
    return [];
  }

  const excludeSet = new Set(excludeUserIds);

  const suggestions: FriendProfile[] = [];
  for (const item of (data || [])) {
    const profile = item.profile as any;
    if (!profile) continue;
    
    const actualProfile = Array.isArray(profile) ? profile[0] : profile;
    if (!actualProfile || excludeSet.has(actualProfile.id)) continue;

    suggestions.push({
      id: actualProfile.id,
      username: actualProfile.username,
      avatar_url: actualProfile.avatar_url,
      level: actualProfile.level,
      streak: actualProfile.streaks?.[0]?.current_streak ?? 0,
      weeklyXp: actualProfile.leagues?.[0]?.weekly_xp ?? 0,
    });
  }


  return suggestions.slice(0, 8); // Return top 8 matches
}

/**
 * Fetches recent activities for friends
 */
export async function getRecentFriendActivity(friendIds: string[]): Promise<ActivityFeedItem[]> {
  if (friendIds.length === 0) return [];

  const { data, error } = await supabase
    .from('progress')
    .select(`
      id,
      lesson_id,
      unit_id,
      completed_at,
      user_id,
      profile:profiles (
        username,
        avatar_url
      )
    `)
    .in('user_id', friendIds)
    .eq('is_completed', true)
    .order('completed_at', { ascending: false })
    .limit(25);

  if (error) {
    console.error('Error fetching friend activities:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id.toString(),
    userId: row.user_id,
    username: row.profile?.username || 'Learner',
    avatarUrl: row.profile?.avatar_url || null,
    lessonId: row.lesson_id,
    unitId: row.unit_id,
    completedAt: row.completed_at || Date.now(),
  }));
}

/**
 * Set up real-time subscription for friendship changes
 */
export function subscribeToFriendships(userId: string, onUpdate: () => void) {
  return supabase
    .channel(`friendships-channel-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `sender_id=eq.${userId}`,
      },
      onUpdate
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `receiver_id=eq.${userId}`,
      },
      onUpdate
    )
    .subscribe();
}

/**
 * Set up real-time subscription for progress activity feed
 */
export function subscribeToProgress(friendIds: string[], onActivity: (payload: any) => void) {
  if (friendIds.length === 0) {
    // If no friends, return a dummy subscription that satisfies unsubscribe
    return {
      unsubscribe: () => {},
    };
  }

  return supabase
    .channel('friend-progress-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'progress',
      },
      (payload) => {
        const record = payload.new;
        if (record.is_completed && friendIds.includes(record.user_id)) {
          onActivity(record);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'progress',
      },
      (payload) => {
        const record = payload.new;
        if (record.is_completed && friendIds.includes(record.user_id)) {
          onActivity(record);
        }
      }
    )
    .subscribe();
}
