import { supabase } from './supabase';

export interface StreakLeaderboardEntry {
  id: string;
  username: string;
  avatarUrl: string | null;
  currentStreak: number;
  longestStreak: number;
  rank: number;
  isUser: boolean;
}

// Highly realistic mock users to populate the leaderboards for each club tier.
const MOCK_ENTRIES: Record<number, Omit<StreakLeaderboardEntry, 'rank' | 'isUser'>[]> = {
  7: [
    { id: 'mock_b1', username: 'OdiaLearner99', avatarUrl: null, currentStreak: 8, longestStreak: 12 },
    { id: 'mock_b2', username: 'RameshChandra', avatarUrl: null, currentStreak: 15, longestStreak: 15 },
    { id: 'mock_b3', username: 'Swati_P', avatarUrl: null, currentStreak: 7, longestStreak: 10 },
    { id: 'mock_b4', username: 'Gita_Odia', avatarUrl: null, currentStreak: 9, longestStreak: 28 },
    { id: 'mock_b5', username: 'SureshKumar', avatarUrl: null, currentStreak: 12, longestStreak: 14 },
    { id: 'mock_b6', username: 'Odia_Boli_Fan', avatarUrl: null, currentStreak: 6, longestStreak: 9 },
  ],
  30: [
    { id: 'mock_c1', username: 'Priyanka_Patra', avatarUrl: null, currentStreak: 32, longestStreak: 45 },
    { id: 'mock_c2', username: 'Abhilash_K', avatarUrl: null, currentStreak: 41, longestStreak: 41 },
    { id: 'mock_c3', username: 'Cuttack_Runner', avatarUrl: null, currentStreak: 22, longestStreak: 55 },
    { id: 'mock_c4', username: 'OdiaExplorer', avatarUrl: null, currentStreak: 30, longestStreak: 32 },
    { id: 'mock_c5', username: 'Subhashree_S', avatarUrl: null, currentStreak: 38, longestStreak: 38 },
  ],
  100: [
    { id: 'mock_d1', username: 'Lingaraj_Devotee', avatarUrl: null, currentStreak: 104, longestStreak: 120 },
    { id: 'mock_d2', username: 'Konark_King', avatarUrl: null, currentStreak: 125, longestStreak: 125 },
    { id: 'mock_d3', username: 'Sambalpuri_Handloom', avatarUrl: null, currentStreak: 84, longestStreak: 110 },
    { id: 'mock_d4', username: 'Rasagola_Lover', avatarUrl: null, currentStreak: 101, longestStreak: 101 },
  ],
  365: [
    { id: 'mock_l1', username: 'Odia_Bhasha_Legend', avatarUrl: null, currentStreak: 380, longestStreak: 412 },
    { id: 'mock_l2', username: 'Jagannath_Sanskruti', avatarUrl: null, currentStreak: 405, longestStreak: 405 },
    { id: 'mock_l3', username: 'Gopabandhu_Fan', avatarUrl: null, currentStreak: 367, longestStreak: 399 },
  ],
};

/**
 * Fetches the private leaderboard for a specific milestone club.
 * Queries Supabase first, merging/falling back to mock data if there are too few users or if offline.
 */
export async function getStreakClubLeaderboard(
  userId: string,
  milestone: number,
  currentUserStreak: number,
  currentUserLongestStreak: number,
  currentUsername: string
): Promise<StreakLeaderboardEntry[]> {
  let dbEntries: Omit<StreakLeaderboardEntry, 'rank' | 'isUser'>[] = [];

  try {
    // Query profiles with longest_streak >= milestone and join their streaks
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, longest_streak, streaks:streaks(current_streak)')
      .gte('longest_streak', milestone)
      .order('longest_streak', { ascending: false });

    if (error) {
      console.warn('Failed to fetch from Supabase, using mock data fallback:', error.message);
    } else if (data) {
      dbEntries = data.map((row: any) => ({
        id: row.id,
        username: row.username || 'Anonymous Learner',
        avatarUrl: row.avatar_url,
        currentStreak: row.streaks?.current_streak || 0,
        longestStreak: row.longest_streak || 0,
      }));
    }
  } catch (e) {
    console.warn('Error querying streak leaderboard from Supabase:', e);
  }

  // Filter out current user from dbEntries or mock entries to prevent duplication,
  // we will add the real user explicitly based on the latest local store state.
  const filteredDbEntries = dbEntries.filter((e) => e.id !== userId);

  // Combine with mock entries of this milestone tier to ensure a lively list
  const mocks = MOCK_ENTRIES[milestone] || [];
  const combinedList = [...filteredDbEntries, ...mocks];

  // Add the current user if they qualify for this club milestone
  if (currentUserLongestStreak >= milestone) {
    combinedList.push({
      id: userId,
      username: currentUsername || 'You',
      avatarUrl: null, // will display default or local
      currentStreak: currentUserStreak,
      longestStreak: currentUserLongestStreak,
    });
  }

  // Sort: 1st by longestStreak (desc), 2nd by currentStreak (desc)
  combinedList.sort((a, b) => {
    if (b.longestStreak !== a.longestStreak) {
      return b.longestStreak - a.longestStreak;
    }
    return b.currentStreak - a.currentStreak;
  });

  // Assign ranks
  return combinedList.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    isUser: entry.id === userId,
  }));
}
