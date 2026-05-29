/**
 * daily-challenges/index.ts
 *
 * Edge Function: Daily Challenge Generation
 * Cron: 18:30 UTC daily = 00:00 IST (midnight India time)
 *
 * Actions:
 * 1. Read challenge templates from challenge_templates table
 * 2. Apply seeded LCG shuffle keyed on YYYY-MM-DD (IST)
 * 3. Pick top 3 templates — same algorithm as client offline fallback
 * 4. Insert into daily_challenges for today
 * 5. Clean up entries older than 7 days
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';
import { handleCors, jsonOk, jsonError } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// IST = UTC+5:30
const IST_OFFSET_HOURS = 5.5;

function getISTDateString(): string {
  const now = new Date();
  const istMs = now.getTime() + IST_OFFSET_HOURS * 3600 * 1000;
  const istDate = new Date(istMs);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(istDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Seeded LCG — must match client-side useChallengeStore implementation
function getSeededRandom(seedStr: string) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return () => {
    hash = (hash * 1664525 + 1013904223) % 4294967296;
    return Math.abs(hash) / 4294967296;
  };
}

function fisherYatesShuffle<T>(arr: T[], rand: () => number): T[] {
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCors();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const todayStr = getISTDateString();

    // 1. Check if challenges already generated for today
    const { data: existing, error: existErr } = await supabase
      .from('daily_challenges')
      .select('id')
      .eq('date', todayStr)
      .limit(1);

    if (existErr) throw existErr;
    if (existing && existing.length > 0) {
      return jsonOk({ success: true, message: `Challenges already generated for ${todayStr}`, skipped: true });
    }

    // 2. Load challenge templates
    const { data: templates, error: tplErr } = await supabase
      .from('challenge_templates')
      .select('*')
      .eq('is_active', true);

    if (tplErr) throw tplErr;
    if (!templates || templates.length < 3) {
      throw new Error(`Not enough active templates: found ${templates?.length ?? 0}, need at least 3`);
    }

    // 3. Deterministic shuffle + pick 3
    const rand = getSeededRandom(todayStr);
    const shuffled = fisherYatesShuffle(templates, rand);
    const selected = shuffled.slice(0, 3);

    // 4. Insert today's challenges
    const challenges = selected.map((tpl: any) => ({
      id: `server_${todayStr}_${tpl.type}`,
      description: tpl.description,
      type: tpl.type,
      target_count: tpl.target_count,
      reward_xp: tpl.reward_xp,
      reward_gems: tpl.reward_gems,
      date: todayStr,
    }));

    const { error: insertErr } = await supabase
      .from('daily_challenges')
      .insert(challenges);

    if (insertErr) throw insertErr;

    // 5. Clean up entries older than 7 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    await supabase
      .from('daily_challenges')
      .delete()
      .lt('date', cutoffStr);

    return jsonOk({
      success: true,
      message: `Generated 3 challenges for ${todayStr}`,
      date: todayStr,
      challenges: challenges.map((c: any) => ({ type: c.type, description: c.description })),
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[daily-challenges] Error:', msg);
    return jsonError(msg);
  }
});
