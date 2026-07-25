-- ========================================================
-- MONOPOLYY - SUPABASE SCHEMAS & LEADERBOARD DATABASE SETUP
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  level INT DEFAULT 1,
  xp INT DEFAULT 0,
  coins INT DEFAULT 500,
  diamonds INT DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  profile_data JSONB DEFAULT '{}'::jsonb
);

-- 2. User Stats Table (for Leaderboard aggregation)
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL,
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0,
  games_lost INT DEFAULT 0,
  win_rate NUMERIC(5,2) DEFAULT 0.00,
  total_coins_earned INT DEFAULT 0,
  elo_rating INT DEFAULT 1000,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Match History Table
CREATE TABLE IF NOT EXISTS public.match_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id VARCHAR(255) NOT NULL,
  winner_id VARCHAR(255),
  winner_name VARCHAR(255),
  player_count INT DEFAULT 2,
  turns_count INT DEFAULT 0,
  duration_seconds INT DEFAULT 0,
  match_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for Leaderboard Fast Lookup
CREATE INDEX IF NOT EXISTS idx_user_stats_elo ON public.user_stats(elo_rating DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_wins ON public.user_stats(games_won DESC);
CREATE INDEX IF NOT EXISTS idx_users_coins ON public.users(coins DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access to Leaderboard
CREATE POLICY "Allow public read access to users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public read access to user_stats" ON public.user_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read access to match_history" ON public.match_history FOR SELECT USING (true);

-- Allow public insert/update (for demo API server key access)
CREATE POLICY "Allow service insert/update to users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow service insert/update to user_stats" ON public.user_stats FOR ALL USING (true);
CREATE POLICY "Allow service insert/update to match_history" ON public.match_history FOR ALL USING (true);
