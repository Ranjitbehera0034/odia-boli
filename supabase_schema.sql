-- Odia Boli Supabase Schema Setup Script
-- Paste this script into the Supabase SQL Editor to initialize your database structure.

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (extends auth.users with app-specific attributes)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  avatar_url text,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  hearts integer NOT NULL DEFAULT 5,
  last_refill_time bigint NOT NULL DEFAULT 0,
  quizzes_taken integer NOT NULL DEFAULT 0,
  quiz_high_score integer NOT NULL DEFAULT 0,
  onboarding_completed boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Curriculum Progress Table (tracks lesson completions)
CREATE TABLE IF NOT EXISTS public.progress (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  unit_id integer NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  score integer NOT NULL DEFAULT 0,
  completed_at bigint,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_lesson UNIQUE (user_id, lesson_id)
);

-- 3. Vocabulary Mastery Table (tracks learned and saved vocabulary words)
CREATE TABLE IF NOT EXISTS public.vocabulary_mastery (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vocab_id text NOT NULL,
  is_learned boolean NOT NULL DEFAULT false,
  is_saved boolean NOT NULL DEFAULT false,
  learned_at bigint,
  saved_at bigint,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_vocab UNIQUE (user_id, vocab_id)
);

-- 4. Streaks Table (tracks daily active streak progress)
CREATE TABLE IF NOT EXISTS public.streaks (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  streak_freeze_count integer NOT NULL DEFAULT 0,
  was_streak_broken boolean NOT NULL DEFAULT false,
  last_active_date text,
  activity_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  freeze_used_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. XP History Table (detailed breakdown log of XP gains)
CREATE TABLE IF NOT EXISTS public.xp_history (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  source text NOT NULL,
  timestamp bigint NOT NULL
);

-- 6. Leagues Table (tracks weekly competitive league placement)
CREATE TABLE IF NOT EXISTS public.leagues (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  league_tier text NOT NULL DEFAULT 'Bronze',
  weekly_xp integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Friendships Table (tracks user connections for the social layer)
CREATE TABLE IF NOT EXISTS public.friendships (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_friendship UNIQUE (sender_id, receiver_id)
);

-- 8. Challenges Table (tracks friendship competitive matches)
CREATE TABLE IF NOT EXISTS public.challenges (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  challenger_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challengee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired')),
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- Enable Row Level Security (RLS)
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Row Level Security (RLS) Policies
-- ==========================================

-- 1. Profiles Policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. Progress Policies
CREATE POLICY "Users can view their own progress" ON public.progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" ON public.progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON public.progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress" ON public.progress
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Vocabulary Mastery Policies
CREATE POLICY "Users can view their own vocabulary mastery" ON public.vocabulary_mastery
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vocabulary mastery" ON public.vocabulary_mastery
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vocabulary mastery" ON public.vocabulary_mastery
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. Streaks Policies
CREATE POLICY "Streaks are viewable by everyone" ON public.streaks
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own streak" ON public.streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak" ON public.streaks
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. XP History Policies
CREATE POLICY "Users can view their own XP history" ON public.xp_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own XP history" ON public.xp_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Leagues Policies
CREATE POLICY "Leagues are viewable by everyone" ON public.leagues
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own league tier" ON public.leagues
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own league tier" ON public.leagues
  FOR UPDATE USING (auth.uid() = user_id);

-- 7. Friendships Policies
CREATE POLICY "Users can view friendships they are part of" ON public.friendships
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create friendship requests" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update friendships they are part of" ON public.friendships
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can delete friendships they are part of" ON public.friendships
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 8. Challenges Policies
CREATE POLICY "Users can view challenges they are part of" ON public.challenges
  FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = challengee_id);

CREATE POLICY "Users can create challenges" ON public.challenges
  FOR INSERT WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Users can update challenges they are part of" ON public.challenges
  FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = challengee_id);

-- ==========================================
-- Triggers for Automated Synchronization
-- ==========================================

-- Function to automatically create profile, streak, and league records on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert a public profile record corresponding to the auth signup
  INSERT INTO public.profiles (id, username, email, xp, level, hearts)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    0,
    1,
    5
  );

  -- Insert default streaks record
  INSERT INTO public.streaks (user_id, current_streak, streak_freeze_count, activity_dates, freeze_used_dates)
  VALUES (new.id, 0, 0, '[]'::jsonb, '[]'::jsonb);

  -- Insert default leagues record
  INSERT INTO public.leagues (user_id, league_tier, weekly_xp)
  VALUES (new.id, 'Bronze', 0);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution binding
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
