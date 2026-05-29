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
  bio text,
  location text,
  native_language text,
  learning_goal text,
  longest_streak integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  badges jsonb NOT NULL DEFAULT '[]'::jsonb,
  interests text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
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
  previous_rank integer,
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

-- 9. Pronunciation Scores Table (tracks scores per word)
CREATE TABLE IF NOT EXISTS public.pronunciation_scores (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  word text NOT NULL,
  score integer NOT NULL,
  feedback text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, word)
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
ALTER TABLE public.pronunciation_scores ENABLE ROW LEVEL SECURITY;

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

-- 9. Pronunciation Scores Policies
CREATE POLICY "Users can view their own pronunciation scores" ON public.pronunciation_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pronunciation scores" ON public.pronunciation_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pronunciation scores" ON public.pronunciation_scores
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pronunciation scores" ON public.pronunciation_scores
  FOR DELETE USING (auth.uid() = user_id);

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

-- Add gems column to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gems integer NOT NULL DEFAULT 0;

-- 11. Daily Challenges Table (stores generated challenges for each calendar date)
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  type text NOT NULL,
  target_count integer NOT NULL,
  reward_xp integer NOT NULL DEFAULT 15,
  reward_gems integer NOT NULL DEFAULT 5,
  date date NOT NULL,
  challenge_index integer NOT NULL,
  CONSTRAINT unique_date_index UNIQUE (date, challenge_index)
);

-- 12. User Daily Challenges Table (tracks per-user challenge progress)
CREATE TABLE IF NOT EXISTS public.user_daily_challenges (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  current_progress integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  date date NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, challenge_id)
);

-- 13. User Daily Chest Table (tracks if chest was claimed for date)
CREATE TABLE IF NOT EXISTS public.user_daily_chest (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  is_claimed boolean NOT NULL DEFAULT false,
  claimed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_chest ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Daily challenges are viewable by everyone" ON public.daily_challenges
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own daily challenges" ON public.user_daily_challenges
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own daily chests" ON public.user_daily_chest
  FOR ALL USING (auth.uid() = user_id);

-- Generator Function
CREATE OR REPLACE FUNCTION public.generate_daily_challenges(target_date date)
RETURNS void AS $$
DECLARE
  template_record RECORD;
  idx integer := 0;
BEGIN
  -- Delete existing challenges for target_date
  DELETE FROM public.daily_challenges WHERE date = target_date;

  -- Pick 3 random templates from the pool
  FOR template_record IN 
    SELECT * FROM (
      VALUES 
        ('Complete 2 lessons', 'lessons_completed', 2, 25, 8),
        ('Translate 5 sentences', 'translate_sentence', 5, 20, 5),
        ('Get 3 correct exercises in a row', 'streak_exercises', 3, 20, 5),
        ('Practice pronunciation for 3 words', 'pronunciation_count', 3, 20, 5),
        ('Earn 50 XP today', 'xp_earned', 50, 30, 10),
        ('Review 10 flashcards', 'flashcards_reviewed', 10, 20, 5),
        ('Complete 1 Quiz challenge', 'quiz_completed', 1, 25, 8)
    ) AS t(description, type, target_count, reward_xp, reward_gems)
    ORDER BY random()
    LIMIT 3
  LOOP
    INSERT INTO public.daily_challenges (description, type, target_count, reward_xp, reward_gems, date, challenge_index)
    VALUES (template_record.description, template_record.type, template_record.target_count, template_record.reward_xp, template_record.reward_gems, target_date, idx);
    idx := idx + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
