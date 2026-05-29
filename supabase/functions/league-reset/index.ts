/**
 * league-reset/index.ts
 *
 * Edge Function: Weekly League Recalculation
 * Cron: every Monday 18:30 UTC = 00:00 IST Tuesday (Mon IST midnight)
 *
 * Actions:
 * 1. Snapshot all users' current ranks as previous_rank
 * 2. Sort by weekly_xp within each tier
 * 3. Promote top 3 of Bronze→Silver, Silver→Gold
 * 4. Demote bottom 3 of Silver→Bronze, Gold→Silver (if tier has >5 members)
 * 5. Reset weekly_xp to 0 for new week
 * 6. Log operation result to league_reset_log table
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';
import { corsHeaders, handleCors, jsonOk, jsonError } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 1. Fetch all active league entries
    const { data: leagues, error: fetchErr } = await supabase
      .from('leagues')
      .select('user_id, weekly_xp, league_tier, previous_rank');

    if (fetchErr) throw fetchErr;
    if (!leagues || leagues.length === 0) {
      return jsonOk({ success: true, message: 'No league entries to process', processed: 0 });
    }

    // 2. Group by tier
    const tiers = ['Bronze', 'Silver', 'Gold'] as const;
    const groups: Record<string, typeof leagues> = { Bronze: [], Silver: [], Gold: [] };

    for (const row of leagues) {
      const tier = row.league_tier as string;
      if (groups[tier]) groups[tier].push(row);
    }

    const updates: Array<{
      user_id: string;
      league_tier: string;
      weekly_xp: number;
      previous_rank: number;
      updated_at: string;
    }> = [];

    const promotions: string[] = [];
    const demotions: string[] = [];

    // 3. Process each tier
    for (const tier of tiers) {
      const group = groups[tier];
      // Sort descending by weekly_xp
      group.sort((a, b) => b.weekly_xp - a.weekly_xp);

      for (let i = 0; i < group.length; i++) {
        const row = group[i];
        const currentRank = i + 1;
        let newTier: string = tier;

        // Promotion — top 3 positions
        if (i < 3) {
          if (tier === 'Bronze') { newTier = 'Silver'; promotions.push(row.user_id); }
          else if (tier === 'Silver') { newTier = 'Gold'; promotions.push(row.user_id); }
        }
        // Demotion — bottom 3 (only if group is large enough)
        else if (i >= group.length - 3 && group.length > 5) {
          if (tier === 'Silver') { newTier = 'Bronze'; demotions.push(row.user_id); }
          else if (tier === 'Gold') { newTier = 'Silver'; demotions.push(row.user_id); }
        }

        updates.push({
          user_id: row.user_id,
          league_tier: newTier,
          weekly_xp: 0,             // Reset weekly XP for new week
          previous_rank: currentRank,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // 4. Upsert all league updates
    if (updates.length > 0) {
      const { error: upsertErr } = await supabase
        .from('leagues')
        .upsert(updates, { onConflict: 'user_id' });

      if (upsertErr) throw upsertErr;
    }

    // 5. Log the reset operation
    await supabase.from('league_reset_log').insert({
      reset_at: new Date().toISOString(),
      total_processed: updates.length,
      promotions: promotions.length,
      demotions: demotions.length,
      promoted_user_ids: promotions,
      demoted_user_ids: demotions,
    }).throwOnError();

    return jsonOk({
      success: true,
      message: 'League reset successfully',
      processed: updates.length,
      promotions: promotions.length,
      demotions: demotions.length,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[league-reset] Error:', msg);
    return jsonError(msg);
  }
});
