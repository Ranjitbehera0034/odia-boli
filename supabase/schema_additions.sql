-- ============================================================
-- supabase/schema_additions.sql
-- Additional tables for L3-20 architecture features
-- ============================================================

-- ─── Push Tokens ─────────────────────────────────────────────────────────────
-- Stores Expo push tokens per user (one per device, updated on login)

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  device_id     TEXT,
  platform      TEXT CHECK (platform IN ('ios', 'android', 'web')) DEFAULT 'ios',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own tokens
CREATE POLICY "Users manage own push tokens"
  ON public.push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── XP Events ───────────────────────────────────────────────────────────────
-- Per-transaction XP log — used for fraud detection aggregation

CREATE TABLE IF NOT EXISTS public.xp_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  source      TEXT NOT NULL,        -- e.g., 'Lesson: greetings_1', 'Daily challenges chest'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_events_user_date ON public.xp_events(user_id, created_at DESC);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

-- Only service role can write XP events (server-authoritative)
CREATE POLICY "Service role manages xp_events"
  ON public.xp_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read their own events
CREATE POLICY "Users read own xp_events"
  ON public.xp_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- ─── Fraud Flags ─────────────────────────────────────────────────────────────
-- Flagged users for excessive XP gain — reviewed by admin

CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  flagged_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  daily_xp    INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  reviewed    BOOLEAN NOT NULL DEFAULT false,
  reviewer_id UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_user ON public.fraud_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_reviewed ON public.fraud_flags(reviewed);

ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

-- Only service role can manage fraud flags
CREATE POLICY "Service role manages fraud_flags"
  ON public.fraud_flags
  FOR ALL
  USING (auth.role() = 'service_role');

-- ─── League Reset Log ────────────────────────────────────────────────────────
-- Audit trail for weekly league resets

CREATE TABLE IF NOT EXISTS public.league_reset_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_processed     INTEGER NOT NULL DEFAULT 0,
  promotions          INTEGER NOT NULL DEFAULT 0,
  demotions           INTEGER NOT NULL DEFAULT 0,
  promoted_user_ids   UUID[] DEFAULT '{}',
  demoted_user_ids    UUID[] DEFAULT '{}'
);

ALTER TABLE public.league_reset_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages league_reset_log"
  ON public.league_reset_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- ─── Cron Schedules (pg_cron via Supabase) ────────────────────────────────────
-- These are registered in the Supabase Dashboard → Database → Extensions → pg_cron
-- Or via SQL after enabling pg_cron extension:

-- 1. Weekly league reset (every Monday 00:00 IST)
SELECT cron.schedule(
  'league-reset-weekly',
  '30 18 * * 1',   -- Every Monday 18:30 UTC = Tuesday 00:00 IST
  $$
    SELECT net.http_post(
      url := 'https://rlugmockbltcqgguadzb.supabase.co/functions/v1/league-reset',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    );
  $$
);

-- 2. Daily challenges generation (every midnight IST)
SELECT cron.schedule(
  'daily-challenges-generate',
  '30 18 * * *',   -- Every day 18:30 UTC = 00:00 IST
  $$
    SELECT net.http_post(
      url := 'https://rlugmockbltcqgguadzb.supabase.co/functions/v1/daily-challenges',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    );
  $$
);

-- 3. XP fraud check (every hour)
SELECT cron.schedule(
  'xp-fraud-check',
  '0 * * * *',     -- Every hour
  $$
    SELECT net.http_post(
      url := 'https://rlugmockbltcqgguadzb.supabase.co/functions/v1/xp-fraud-detection',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    );
  $$
);

-- 4. Challenge resolution (every hour)
SELECT cron.schedule(
  'challenge-resolution',
  '0 * * * *',     -- Every hour
  $$
    SELECT net.http_post(
      url := 'https://rlugmockbltcqgguadzb.supabase.co/functions/v1/challenge-resolution',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    );
  $$
);

