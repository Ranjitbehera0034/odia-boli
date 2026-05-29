import { supabase } from './supabase';
import { getDB } from './srs';
import { getFriendships } from './friends';

// ─── Constants ─────────────────────────────────────────────────────────────

export type Tier = 'Bronze' | 'Silver' | 'Gold';

export const TIERS: Tier[] = ['Bronze', 'Silver', 'Gold'];

export const TIER_COLORS: Record<Tier, { bg: string; text: string; border: string; badge: string }> = {
  Bronze: { bg: '#92400E15', text: '#92400E', border: '#92400E60', badge: '🥉' },
  Silver: { bg: '#6B728015', text: '#374151', border: '#9CA3AF60', badge: '🥈' },
  Gold:   { bg: '#D9770615', text: '#D97706', border: '#F59E0B60', badge: '🥇' },
};

// ─── Types ─────────────────────────────────────────────────────────────────

export interface LeagueEntry {
  id: string;
  name: string;
  avatar: string;
  weeklyXp: number;
  tier: Tier;
  isUser: boolean;
  rank: number;
  previousRank: number | null;
}

export interface LeagueState {
  entries: LeagueEntry[];
  userTier: Tier;
  weekStartTimestamp: number;
  promotionIds: string[];  // IDs that will promote (top 3)
  demotionIds: string[];   // IDs that will demote (bottom 3)
}

// ─── DB Init ───────────────────────────────────────────────────────────────

/**
 * Initializes local SQLite table for tracking local user's weekly XP.
 * Preserved for offline-first support; users accumulate XP locally and sync updates.
 */
export async function initLeagueDatabase(): Promise<void> {
  try {
    const db = getDB();

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS league_entries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT NOT NULL,
        weekly_xp INTEGER NOT NULL DEFAULT 0,
        tier TEXT NOT NULL DEFAULT 'Bronze',
        is_user INTEGER NOT NULL DEFAULT 0,
        week_start INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Seed local user if empty
    const countRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM league_entries WHERE is_user = 1;');
    if (countRow && countRow.c === 0) {
      const weekStart = _getWeekStart();
      await db.runAsync(
        `INSERT OR IGNORE INTO league_entries (id, name, avatar, weekly_xp, tier, is_user, week_start)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        ['user', 'You', '🧑🏽', 0, 'Bronze', 1, weekStart]
      );
    }
  } catch (error) {
    console.error('Failed to init local league database:', error);
  }
}

// ─── User XP Accumulator ───────────────────────────────────────────────────

/** Called whenever the real user earns XP. Adds to local SQLite weekly_xp. */
export async function addLeagueXp(amount: number): Promise<void> {
  try {
    const db = getDB();
    await db.runAsync(
      'UPDATE league_entries SET weekly_xp = weekly_xp + ? WHERE is_user = 1;',
      [amount]
    );
  } catch (e) {
    console.error('Failed to add league XP:', e);
  }
}

// ─── Scoped Supabase Fetches ────────────────────────────────────────────────

export type LeaderboardScope = 'global' | 'friends' | 'city' | 'india';

/**
 * Fetches real Supabase weekly leaderboard, scoped by Global, Friends, City, or India.
 */
export async function getRealLeagueState(
  userId: string,
  scope: LeaderboardScope
): Promise<LeagueState> {
  try {
    // 1. Fetch current user profile to determine current tier and location
    const { data: userProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, level, location')
      .eq('id', userId)
      .single();

    if (profileErr) throw profileErr;

    // 2. Fetch current user league tier from Supabase
    const { data: userLeague, error: userLeagueErr } = await supabase
      .from('leagues')
      .select('league_tier')
      .eq('user_id', userId)
      .single();

    const userTier = (userLeague?.league_tier || 'Bronze') as Tier;

    // 3. Fetch all active league entries with profiles from Supabase
    const { data: rawLeagues, error: leaguesErr } = await supabase
      .from('leagues')
      .select(`
        user_id,
        league_tier,
        weekly_xp,
        previous_rank,
        profile:profiles!inner (
          id,
          username,
          avatar_url,
          level,
          location,
          streaks ( current_streak )
        )
      `);

    if (leaguesErr) throw leaguesErr;

    // Determine target lists to filter
    let filteredRows = rawLeagues || [];
    
    // Scoping rules
    if (scope === 'global') {
      // Global scope: Compete with all users inside the same tier
      filteredRows = filteredRows.filter((r) => r.league_tier === userTier);
    } else if (scope === 'friends') {
      // Friends scope: Current user + accepted friends (any tier)
      const relationships = await getFriendships(userId);
      const friendIds = relationships.friends.map((f) => f.id);
      filteredRows = filteredRows.filter(
        (r) => r.user_id === userId || friendIds.includes(r.user_id)
      );
    } else if (scope === 'city') {
      // City scope: Compete with users in the same location (case-insensitive)
      const userProfileData = userProfile as any;
      const userLoc = (userProfileData?.location || '').trim().toLowerCase();
      filteredRows = filteredRows.filter((r) => {
        const profile = (Array.isArray(r.profile) ? r.profile[0] : r.profile) as any;
        const itemLoc = (profile?.location || '').trim().toLowerCase();
        return itemLoc && userLoc && itemLoc === userLoc;
      });
    } else if (scope === 'india') {
      // India scope: Compete with users whose location is in India / Odisha region
      filteredRows = filteredRows.filter((r) => {
        const profile = (Array.isArray(r.profile) ? r.profile[0] : r.profile) as any;
        const loc = (profile?.location || '').trim().toLowerCase();
        return (
          loc.includes('india') ||
          loc.includes('odisha') ||
          loc.includes('bhubaneswar') ||
          loc.includes('cuttack') ||
          loc.includes('delhi') ||
          loc.includes('mumbai') ||
          loc.includes('bangalore') ||
          loc.includes('hyderabad') ||
          loc.includes('kolkata') ||
          loc.includes('chennai')
        );
      });
    }


    // Sort by weekly XP desc
    filteredRows.sort((a, b) => b.weekly_xp - a.weekly_xp);

    const entries: LeagueEntry[] = filteredRows.map((item, idx) => {
      const profile = Array.isArray(item.profile) ? item.profile[0] : item.profile;
      const avatarSymbol = profile?.avatar_url
        ? profile.avatar_url
        : (profile?.username?.charAt(0).toUpperCase() || '👤');

      return {
        id: item.user_id,
        name: profile?.username || 'Learner',
        avatar: avatarSymbol,
        weeklyXp: item.weekly_xp,
        tier: item.league_tier as Tier,
        isUser: item.user_id === userId,
        rank: idx + 1,
        previousRank: item.previous_rank,
      };
    });

    // Promotion & Demotion zone tags (calculated based on global current tier)
    const globalTierRows = (rawLeagues || [])
      .filter((r) => r.league_tier === userTier)
      .sort((a, b) => b.weekly_xp - a.weekly_xp);

    const promotionIds = globalTierRows.slice(0, 3).map((r) => r.user_id);
    const demotionIds = globalTierRows.length > 5 
      ? globalTierRows.slice(-3).map((r) => r.user_id) 
      : [];

    return {
      entries,
      userTier,
      weekStartTimestamp: _getWeekStart(),
      promotionIds,
      demotionIds,
    };
  } catch (e) {
    console.error('Failed to get real league state:', e);
    return {
      entries: [],
      userTier: 'Bronze',
      weekStartTimestamp: 0,
      promotionIds: [],
      demotionIds: [],
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Returns timestamp (ms) of the most recent Monday 00:00 local time */
function _getWeekStart(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

/** How many days until Monday (end of week)? */
export function getDaysUntilReset(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  return dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7;
}
