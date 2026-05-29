import { supabase } from './supabase';

export interface XPChallenge {
  id: string;
  challenger_id: string;
  challengee_id: string;
  type: string;
  parameters: {
    challenger_start_xp?: number;
    challengee_start_xp?: number;
  };
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'expired';
  winner_id: string | null;
  expires_at: string;
  created_at: string;
  challenger: {
    id: string;
    username: string;
    avatar_url: string | null;
    xp: number;
  };
  challengee: {
    id: string;
    username: string;
    avatar_url: string | null;
    xp: number;
  };
}

/**
 * Creates a new XP battle challenge request
 */
export async function createXPChallenge(challengerId: string, challengeeId: string): Promise<{ data: any; error: any }> {
  // Check if there is already an active challenge between these two users
  const { data: existing, error: checkErr } = await supabase
    .from('challenges')
    .select('id')
    .or(`and(challenger_id.eq.${challengerId},challengee_id.eq.${challengeeId}),and(challenger_id.eq.${challengeeId},challengee_id.eq.${challengerId})`)
    .in('status', ['pending', 'accepted']);

  if (checkErr) return { data: null, error: checkErr };
  if (existing && existing.length > 0) {
    return { data: null, error: new Error('An active challenge or pending request already exists between you two.') };
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Default 7 days
  
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      challenger_id: challengerId,
      challengee_id: challengeeId,
      type: 'xp_battle',
      status: 'pending',
      parameters: {},
      expires_at: expiresAt,
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Accepts a challenge request and takes static snapshot of current XP points
 */
export async function acceptXPChallenge(challengeId: string): Promise<{ error: any }> {
  try {
    // 1. Fetch challenge details to identify users
    const { data: challenge, error: getErr } = await supabase
      .from('challenges')
      .select('challenger_id, challengee_id')
      .eq('id', challengeId)
      .single();

    if (getErr) throw getErr;

    // 2. Fetch current XP for both users
    const { data: challengerProfile, error: errChallenger } = await supabase
      .from('profiles')
      .select('xp')
      .eq('id', challenge.challenger_id)
      .single();

    const { data: challengeeProfile, error: errChallengee } = await supabase
      .from('profiles')
      .select('xp')
      .eq('id', challenge.challengee_id)
      .single();

    if (errChallenger) throw errChallenger;
    if (errChallengee) throw errChallengee;

    // 3. Update status to 'accepted', write start XP, and reset expires_at to 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { error: updateErr } = await supabase
      .from('challenges')
      .update({
        status: 'accepted',
        parameters: {
          challenger_start_xp: challengerProfile.xp || 0,
          challengee_start_xp: challengeeProfile.xp || 0,
        },
        expires_at: expiresAt,
      })
      .eq('id', challengeId);

    return { error: updateErr };
  } catch (err: any) {
    return { error: err };
  }
}

/**
 * Declines a challenge request
 */
export async function declineXPChallenge(challengeId: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'declined' })
    .eq('id', challengeId);

  return { error };
}

/**
 * Fetches all pending and active accepted challenges involving a user
 */
export async function getActiveChallenges(userId: string): Promise<XPChallenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select(`
      id,
      challenger_id,
      challengee_id,
      type,
      parameters,
      status,
      winner_id,
      expires_at,
      created_at,
      challenger:profiles!challenges_challenger_id_fkey ( id, username, avatar_url, xp ),
      challengee:profiles!challenges_challengee_id_fkey ( id, username, avatar_url, xp )
    `)
    .or(`challenger_id.eq.${userId},challengee_id.eq.${userId}`)
    .in('status', ['pending', 'accepted']);

  if (error) {
    console.error('Error fetching active challenges:', error);
    return [];
  }

  return (data || []).map((row: any) => {
    const challengerData = Array.isArray(row.challenger) ? row.challenger[0] : row.challenger;
    const challengeeData = Array.isArray(row.challengee) ? row.challengee[0] : row.challengee;
    return {
      ...row,
      challenger: challengerData,
      challengee: challengeeData,
    };
  });
}

/**
 * Checks for expired challenges, calculates the winner, and awards profile badges
 */
export async function checkAndExpireChallenges(userId: string): Promise<void> {
  try {
    const nowISO = new Date().toISOString();
    
    // Fetch user's active accepted challenges that have expired
    const { data: expiredList, error: fetchErr } = await supabase
      .from('challenges')
      .select(`
        id,
        challenger_id,
        challengee_id,
        parameters,
        expires_at
      `)
      .or(`challenger_id.eq.${userId},challengee_id.eq.${userId}`)
      .eq('status', 'accepted')
      .lte('expires_at', nowISO);

    if (fetchErr) throw fetchErr;
    if (!expiredList || expiredList.length === 0) return;

    for (const challenge of expiredList) {
      // 1. Fetch current live profiles
      const { data: challenger, error: cErr } = await supabase
        .from('profiles')
        .select('xp, badges')
        .eq('id', challenge.challenger_id)
        .single();

      const { data: challengee, error: eErr } = await supabase
        .from('profiles')
        .select('xp, badges')
        .eq('id', challenge.challengee_id)
        .single();

      if (cErr || eErr) continue;

      const challengerStart = challenge.parameters?.challenger_start_xp || 0;
      const challengeeStart = challenge.parameters?.challengee_start_xp || 0;

      const challengerEarned = Math.max(0, (challenger?.xp || 0) - challengerStart);
      const challengeeEarned = Math.max(0, (challengee?.xp || 0) - challengeeStart);

      let winnerId: string | null = null;
      let winnerProfile = null;

      if (challengerEarned > challengeeEarned) {
        winnerId = challenge.challenger_id;
        winnerProfile = challenger;
      } else if (challengeeEarned > challengerEarned) {
        winnerId = challenge.challengee_id;
        winnerProfile = challengee;
      }

      // 2. Mark challenge completed
      await supabase
        .from('challenges')
        .update({
          status: 'completed',
          winner_id: winnerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', challenge.id);

      // 3. Award 'challenge_champion' badge to the winner if they don't have it
      if (winnerId && winnerProfile) {
        const currentBadges: string[] = Array.isArray(winnerProfile.badges) 
          ? winnerProfile.badges 
          : JSON.parse(typeof winnerProfile.badges === 'string' ? winnerProfile.badges : '[]');

        if (!currentBadges.includes('challenge_champion')) {
          const updatedBadges = [...currentBadges, 'challenge_champion'];
          await supabase
            .from('profiles')
            .update({ badges: updatedBadges })
            .eq('id', winnerId);
        }
      }
    }
  } catch (e) {
    console.error('Failed checking/expiring challenges:', e);
  }
}

/**
 * Sets up a Realtime listener channel on the challenges table
 */
export function subscribeToUserChallenges(userId: string, onUpdate: (payload: any) => void) {
  return supabase
    .channel(`user-challenges-channel-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'challenges',
      },
      (payload) => {
        onUpdate(payload);
      }
    )
    .subscribe();
}

/**
 * Fetches details for a single challenge request by its ID
 */
export async function getChallengeDetails(challengeId: string): Promise<XPChallenge | null> {
  const { data, error } = await supabase
    .from('challenges')
    .select(`
      id,
      challenger_id,
      challengee_id,
      type,
      parameters,
      status,
      winner_id,
      expires_at,
      created_at,
      challenger:profiles!challenges_challenger_id_fkey ( id, username, avatar_url, xp ),
      challengee:profiles!challenges_challengee_id_fkey ( id, username, avatar_url, xp )
    `)
    .eq('id', challengeId)
    .single();

  if (error) {
    console.error('Error fetching challenge details:', error);
    return null;
  }

  if (!data) return null;

  const challengerData = Array.isArray(data.challenger) ? data.challenger[0] : data.challenger;
  const challengeeData = Array.isArray(data.challengee) ? data.challengee[0] : data.challengee;
  
  return {
    ...data,
    challenger: challengerData,
    challengee: challengeeData,
  };
}

/**
 * Sets up a Realtime listener channel on the profiles table for specific user IDs
 */
export function subscribeToProfiles(userIds: string[], onUpdate: (profile: any) => void) {
  return supabase
    .channel('challenge-profiles-channel')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
      },
      (payload) => {
        if (userIds.includes(payload.new.id)) {
          onUpdate(payload.new);
        }
      }
    )
    .subscribe();
}

