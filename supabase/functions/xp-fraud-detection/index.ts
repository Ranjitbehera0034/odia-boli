/**
 * xp-fraud-detection/index.ts
 *
 * Edge Function: XP Fraud Detection
 * Cron: every hour (0 * * * *)
 *
 * Actions:
 * 1. Query profiles where today's XP gain exceeds threshold (10,000 XP/day)
 * 2. Cross-check against xp_events table for legitimacy signals
 * 3. Write flagged users to fraud_flags table
 * 4. Send alert to admin webhook (ADMIN_WEBHOOK_URL env var)
 * 5. Return summary of flagged users
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';
import { handleCors, jsonOk, jsonError } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_WEBHOOK_URL = Deno.env.get('ADMIN_WEBHOOK_URL') ?? '';

const XP_DAILY_THRESHOLD = 10_000;

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const today = todayISO();

    // 1. Aggregate XP events for today grouped by user
    const { data: xpRows, error: xpErr } = await supabase
      .from('xp_events')
      .select('user_id, amount')
      .gte('created_at', `${today}T00:00:00Z`);

    if (xpErr) throw xpErr;

    // Sum XP per user
    const xpByUser: Record<string, number> = {};
    for (const row of xpRows || []) {
      xpByUser[row.user_id] = (xpByUser[row.user_id] ?? 0) + (row.amount ?? 0);
    }

    // 2. Identify users exceeding threshold
    const suspicious = Object.entries(xpByUser)
      .filter(([, total]) => total > XP_DAILY_THRESHOLD)
      .map(([userId, total]) => ({ userId, dailyXp: total }));

    if (suspicious.length === 0) {
      return jsonOk({ success: true, message: 'No suspicious XP activity detected', flagged: 0 });
    }

    // 3. Check which are already flagged today to avoid duplicate inserts
    const suspiciousIds = suspicious.map((s) => s.userId);
    const { data: existingFlags } = await supabase
      .from('fraud_flags')
      .select('user_id')
      .in('user_id', suspiciousIds)
      .gte('flagged_at', `${today}T00:00:00Z`);

    const alreadyFlaggedIds = new Set((existingFlags || []).map((f: any) => f.user_id));
    const newFlags = suspicious.filter((s) => !alreadyFlaggedIds.has(s.userId));

    // 4. Insert new fraud flags
    if (newFlags.length > 0) {
      const flagRows = newFlags.map((s) => ({
        user_id: s.userId,
        flagged_at: new Date().toISOString(),
        daily_xp: s.dailyXp,
        reason: `XP exceeded daily threshold of ${XP_DAILY_THRESHOLD} (earned: ${s.dailyXp})`,
        reviewed: false,
      }));

      const { error: flagErr } = await supabase
        .from('fraud_flags')
        .insert(flagRows);

      if (flagErr) throw flagErr;
    }

    // 5. Send admin webhook alert
    if (ADMIN_WEBHOOK_URL && newFlags.length > 0) {
      try {
        await fetch(ADMIN_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'xp_fraud_detected',
            timestamp: new Date().toISOString(),
            count: newFlags.length,
            users: newFlags,
          }),
        });
      } catch (webhookErr) {
        // Non-fatal — log and continue
        console.warn('[xp-fraud-detection] Webhook delivery failed:', webhookErr);
      }
    }

    return jsonOk({
      success: true,
      message: `Flagged ${newFlags.length} user(s) for suspicious XP activity`,
      flagged: newFlags.length,
      users: newFlags.map((s) => ({ userId: s.userId, dailyXp: s.dailyXp })),
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[xp-fraud-detection] Error:', msg);
    return jsonError(msg);
  }
});
