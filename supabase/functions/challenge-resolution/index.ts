/**
 * challenge-resolution/index.ts
 *
 * Edge Function: Friend Challenge Resolution
 * Cron: every hour (0 * * * *)
 *
 * Actions:
 * 1. Find friend_challenges where end_date < NOW() and status = 'active'
 * 2. For each expired challenge: determine winner by comparing final XP
 * 3. Update challenge status → 'completed', set winner_id
 * 4. Award trophy badge to winner in profiles.badges
 * 5. Notify both participants via push-dispatch function
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';
import { handleCors, jsonOk, jsonError } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FUNCTIONS_URL = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.functions.supabase.co') ?? '';

async function dispatchPush(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/push-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ user_id: userId, title, body, data }),
    });
  } catch (e) {
    console.warn('[challenge-resolution] Push dispatch failed:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const now = new Date().toISOString();

    // 1. Find all expired active challenges
    const { data: expiredChallenges, error: fetchErr } = await supabase
      .from('friend_challenges')
      .select('*')
      .eq('status', 'active')
      .lt('end_date', now);

    if (fetchErr) throw fetchErr;
    if (!expiredChallenges || expiredChallenges.length === 0) {
      return jsonOk({ success: true, message: 'No expired challenges to resolve', resolved: 0 });
    }

    const resolved: Array<{ challengeId: string; winnerId: string | null; tied: boolean }> = [];

    for (const challenge of expiredChallenges) {
      const { challenger_id, opponent_id, challenger_xp, opponent_xp, id: challengeId } = challenge;

      let winnerId: string | null = null;
      let tied = false;

      if (challenger_xp > opponent_xp) {
        winnerId = challenger_id;
      } else if (opponent_xp > challenger_xp) {
        winnerId = opponent_id;
      } else {
        tied = true;
      }

      // 2. Update challenge status
      const { error: updateErr } = await supabase
        .from('friend_challenges')
        .update({
          status: 'completed',
          winner_id: winnerId,
          completed_at: now,
        })
        .eq('id', challengeId);

      if (updateErr) {
        console.error(`[challenge-resolution] Failed to update challenge ${challengeId}:`, updateErr);
        continue;
      }

      // 3. Award trophy badge to winner
      if (winnerId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('badges')
          .eq('id', winnerId)
          .maybeSingle();

        const currentBadges: string[] = profile?.badges ?? [];
        const TROPHY_BADGE = 'xp_battle_champion';

        if (!currentBadges.includes(TROPHY_BADGE)) {
          await supabase
            .from('profiles')
            .update({ badges: [...currentBadges, TROPHY_BADGE] })
            .eq('id', winnerId);
        }
      }

      // 4. Fetch usernames for notifications
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', [challenger_id, opponent_id]);

      const getName = (id: string) =>
        profiles?.find((p: any) => p.id === id)?.username ?? 'your opponent';

      // 5. Notify both participants
      if (tied) {
        await dispatchPush(challenger_id, "It's a tie! 🤝", "Your 7-day XP battle ended in a draw. Challenge again?");
        await dispatchPush(opponent_id, "It's a tie! 🤝", "Your 7-day XP battle ended in a draw. Challenge again?");
      } else {
        const winnerName = getName(winnerId!);
        const loserName = getName(winnerId === challenger_id ? opponent_id : challenger_id);
        const loserId = winnerId === challenger_id ? opponent_id : challenger_id;

        await dispatchPush(
          winnerId!,
          '🏆 You won the XP Battle!',
          `You defeated ${loserName} in a 7-day XP battle! A trophy badge has been added to your profile.`,
          { challengeId, badge: 'xp_battle_champion' }
        );
        await dispatchPush(
          loserId,
          '⚔️ Battle Complete',
          `${winnerName} won this round. Keep practicing and challenge again!`,
          { challengeId }
        );
      }

      resolved.push({ challengeId, winnerId, tied });
    }

    return jsonOk({
      success: true,
      message: `Resolved ${resolved.length} challenge(s)`,
      resolved: resolved.length,
      results: resolved,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[challenge-resolution] Error:', msg);
    return jsonError(msg);
  }
});
