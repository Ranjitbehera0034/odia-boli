import { create } from 'zustand';
import { getDB } from '../services/srs';
import { supabase } from '../services/supabase';
import { useUserStore } from './useUserStore';

export interface DailyChallenge {
  id: string;
  description: string;
  type: string;
  target_count: number;
  current_progress: number;
  is_completed: number;
  reward_xp: number;
  reward_gems: number;
  date: string;
}

interface ChallengeState {
  challenges: DailyChallenge[];
  chestClaimed: boolean;
  loading: boolean;
  
  loadDailyChallenges: () => Promise<void>;
  incrementProgress: (type: string, amount: number) => Promise<void>;
  claimDailyChest: () => Promise<{ xp: number; gems: number } | null>;
}

// 7 thematic template types for daily challenges
const CHALLENGE_POOL = [
  { description: 'Complete 2 lessons', type: 'lessons_completed', target_count: 2, reward_xp: 25, reward_gems: 8 },
  { description: 'Translate 5 sentences', type: 'translate_sentence', target_count: 5, reward_xp: 20, reward_gems: 5 },
  { description: 'Get 3 correct exercises in a row', type: 'streak_exercises', target_count: 3, reward_xp: 20, reward_gems: 5 },
  { description: 'Practice pronunciation for 3 words', type: 'pronunciation_count', target_count: 3, reward_xp: 20, reward_gems: 5 },
  { description: 'Earn 50 XP today', type: 'xp_earned', target_count: 50, reward_xp: 30, reward_gems: 10 },
  { description: 'Review 10 flashcards in Spaced Repetition', type: 'flashcards_reviewed', target_count: 10, reward_xp: 20, reward_gems: 5 },
  { description: 'Complete 1 Quiz challenge', type: 'quiz_completed', target_count: 1, reward_xp: 25, reward_gems: 8 },
];

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Seeded LCG random generator for deterministic shuffles
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

// Deterministically generate 3 challenges based on a date seed
function generateDeterministicChallenges(dateStr: string): Omit<DailyChallenge, 'current_progress' | 'is_completed'>[] {
  const rand = getSeededRandom(dateStr);
  const pool = [...CHALLENGE_POOL];

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }

  return pool.slice(0, 3).map((item, idx) => ({
    id: `offline_challenge_${dateStr}_${idx}`,
    description: item.description,
    type: item.type,
    target_count: item.target_count,
    reward_xp: item.reward_xp,
    reward_gems: item.reward_gems,
    date: dateStr,
  }));
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  challenges: [],
  chestClaimed: false,
  loading: true,

  loadDailyChallenges: async () => {
    const todayStr = getLocalDateString();
    const db = getDB();
    const currentUserId = useUserStore.getState().username ? 'user_active' : 'guest';

    set({ loading: true });

    try {
      // 1. Fetch from Supabase if user is logged in
      let remoteChallenges: any[] = [];
      let isChestClaimedRemote = false;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const userId = session.user.id;

        // Fetch challenges for today
        const { data: dailyData, error: dailyErr } = await supabase
          .from('daily_challenges')
          .select('*')
          .eq('date', todayStr);

        if (!dailyErr && dailyData && dailyData.length > 0) {
          remoteChallenges = dailyData;
        }

        // Fetch claimed state
        const { data: chestData, error: chestErr } = await supabase
          .from('user_daily_chest')
          .select('is_claimed')
          .eq('user_id', userId)
          .eq('date', todayStr)
          .maybeSingle();

        if (!chestErr && chestData) {
          isChestClaimedRemote = chestData.is_claimed;
        }
      }

      // 2. Determine base templates (either from remote or local seeded LCG)
      const baseChallenges = remoteChallenges.length === 3
        ? remoteChallenges.map((rc, idx) => ({
            id: rc.id,
            description: rc.description,
            type: rc.type,
            target_count: rc.target_count,
            reward_xp: rc.reward_xp,
            reward_gems: rc.reward_gems,
            date: todayStr,
          }))
        : generateDeterministicChallenges(todayStr);

      // 3. Load or initialize challenge progress in local SQLite
      const challengesList: DailyChallenge[] = [];
      for (const bc of baseChallenges) {
        const localRow = await db.getFirstAsync<any>(
          'SELECT current_progress, is_completed FROM daily_challenges WHERE id = ?;',
          [bc.id]
        );

        if (localRow) {
          challengesList.push({
            ...bc,
            current_progress: localRow.current_progress,
            is_completed: localRow.is_completed,
          });
        } else {
          // If no local record exists, delete any old dates to save space
          await db.runAsync('DELETE FROM daily_challenges WHERE date != ?;', [todayStr]);

          // Insert new challenge
          await db.runAsync(
            `INSERT INTO daily_challenges (id, description, type, target_count, current_progress, is_completed, reward_xp, reward_gems, date)
             VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?);`,
            [bc.id, bc.description, bc.type, bc.target_count, bc.reward_xp, bc.reward_gems, todayStr]
          );

          challengesList.push({
            ...bc,
            current_progress: 0,
            is_completed: 0,
          });
        }
      }

      // 4. Load chest claimed status from SQLite
      const claimedRow = await db.getFirstAsync<any>(
        'SELECT is_claimed FROM daily_chest_claimed WHERE date = ?;',
        [todayStr]
      );
      
      let isChestClaimedLocal = claimedRow ? claimedRow.is_claimed === 1 : false;

      if (!claimedRow && isChestClaimedRemote) {
        await db.runAsync('INSERT INTO daily_chest_claimed (date, is_claimed) VALUES (?, 1);', [todayStr]);
        isChestClaimedLocal = true;
      }

      // Cleanup old claimed chest logs
      if (!claimedRow) {
        await db.runAsync('DELETE FROM daily_chest_claimed WHERE date != ?;', [todayStr]);
      }

      set({
        challenges: challengesList,
        chestClaimed: isChestClaimedLocal || isChestClaimedRemote,
        loading: false,
      });
    } catch (err) {
      console.error('Failed loading daily challenges:', err);
      // Fallback: load strictly deterministically
      const bc = generateDeterministicChallenges(todayStr);
      set({
        challenges: bc.map((item) => ({ ...item, current_progress: 0, is_completed: 0 })),
        chestClaimed: false,
        loading: false,
      });
    }
  },

  incrementProgress: async (type: string, amount: number) => {
    const state = get();
    if (state.challenges.length === 0) return;

    const db = getDB();
    const todayStr = getLocalDateString();
    
    const updatedChallenges = await Promise.all(
      state.challenges.map(async (ch) => {
        if (ch.type !== type || ch.is_completed === 1) return ch;

        // Custom behavior for streak_exercises: can be incremented (resets handled by individual screens)
        const nextProgress = Math.min(ch.target_count, ch.current_progress + amount);
        const completed = nextProgress >= ch.target_count ? 1 : 0;

        await db.runAsync(
          'UPDATE daily_challenges SET current_progress = ?, is_completed = ? WHERE id = ?;',
          [nextProgress, completed, ch.id]
        );

        // Sync user progress with Supabase if online
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase
              .from('user_daily_challenges')
              .upsert({
                user_id: session.user.id,
                challenge_id: ch.id,
                current_progress: nextProgress,
                is_completed: completed === 1,
                date: todayStr,
              });
          }
        } catch (e) {
          // ignore offline sync fails
        }

        return {
          ...ch,
          current_progress: nextProgress,
          is_completed: completed,
        };
      })
    );

    set({ challenges: updatedChallenges });
  },

  claimDailyChest: async () => {
    const state = get();
    const todayStr = getLocalDateString();

    // Check if chest is already claimed
    if (state.chestClaimed) return null;

    // Verify all challenges are completed
    const allCompleted = state.challenges.length === 3 && state.challenges.every((ch) => ch.is_completed === 1);
    if (!allCompleted) return null;

    const db = getDB();
    const chestXpReward = 50;
    const chestGemsReward = 20;

    try {
      // 1. Log claim locally
      await db.runAsync(
        'INSERT OR REPLACE INTO daily_chest_claimed (date, is_claimed) VALUES (?, 1);',
        [todayStr]
      );

      // 2. Sync claim to Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const userId = session.user.id;
        await supabase
          .from('user_daily_chest')
          .upsert({
            user_id: userId,
            date: todayStr,
            is_claimed: true,
          });
      }

      // 3. Award XP & Gems in User Store
      const userStore = useUserStore.getState();
      await userStore.addXp(chestXpReward, 'Daily challenges chest');
      await userStore.addGems(chestGemsReward);

      set({ chestClaimed: true });

      return { xp: chestXpReward, gems: chestGemsReward };
    } catch (e) {
      console.error('Failed claiming daily chest:', e);
      return null;
    }
  },
}));
