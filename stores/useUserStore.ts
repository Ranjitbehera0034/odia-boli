import { create } from 'zustand';
import { getDB } from '../services/srs';
import { getLevelInfo } from '../services/levelSystem';
import { addLeagueXp } from '../services/league';

export interface UserState {
  xp: number;
  level: number;
  hearts: number;
  lastRefillTime: number;
  streak: number;
  streakFreezeCount: number;
  wasStreakBroken: boolean;
  lastActiveDate: string | null;
  activityDates: string[];
  freezeUsedDates: string[];
  onboardingCompleted: boolean;
  quizzesTaken: number;
  quizHighScore: number;
  loading: boolean;

  loadUser: () => Promise<void>;
  addXp: (amount: number, source: string) => Promise<void>;
  deductHeart: () => Promise<number>;
  refillHearts: () => Promise<void>;
  checkRefill: () => Promise<void>;
  updateStreak: () => Promise<{ wasStreakBroken: boolean }>;
  buyStreakFreeze: () => Promise<boolean>;
  completeOnboarding: (placedUnit: number, score: number) => Promise<void>;
  updateQuizStats: (score: number) => Promise<void>;
  resetUser: () => Promise<void>;
}

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
}

export const useUserStore = create<UserState>((set, get) => ({
  xp: 0,
  level: 1,
  hearts: 5,
  lastRefillTime: 0,
  streak: 0,
  streakFreezeCount: 0,
  wasStreakBroken: false,
  lastActiveDate: null,
  activityDates: [],
  freezeUsedDates: [],
  onboardingCompleted: false,
  quizzesTaken: 0,
  quizHighScore: 0,
  loading: true,

  loadUser: async () => {
    try {
      const db = getDB();
      const row = await db.getFirstAsync<any>('SELECT * FROM users WHERE id = 1;');
      if (row) {
        set({
          xp: row.xp,
          level: row.level,
          hearts: row.hearts,
          lastRefillTime: row.last_refill_time,
          streak: row.streak,
          streakFreezeCount: row.streak_freeze_count,
          wasStreakBroken: row.was_streak_broken === 1,
          lastActiveDate: row.last_active_date,
          activityDates: JSON.parse(row.activity_dates || '[]'),
          freezeUsedDates: JSON.parse(row.freeze_used_dates || '[]'),
          onboardingCompleted: row.onboarding_completed === 1,
          quizzesTaken: row.quizzes_taken,
          quizHighScore: row.quiz_high_score,
          loading: false,
        });
      }
    } catch (e) {
      console.error('Failed to load user state from SQLite:', e);
      set({ loading: false });
    }
  },

  addXp: async (amount: number, source: string) => {
    try {
      const db = getDB();
      const state = get();
      const newXp = state.xp + amount;
      const newLevelInfo = getLevelInfo(newXp);
      const now = Date.now();

      // Log XP gain
      await db.runAsync(
        'INSERT INTO xp_log (amount, source, timestamp) VALUES (?, ?, ?);',
        [amount, source, now]
      );

      // Update user details
      await db.runAsync(
        'UPDATE users SET xp = ?, level = ? WHERE id = 1;',
        [newXp, newLevelInfo.level]
      );

      // Update league weekly XP
      await addLeagueXp(amount);

      set({
        xp: newXp,
        level: newLevelInfo.level,
      });
    } catch (e) {
      console.error('Failed to add XP in SQLite:', e);
    }
  },

  deductHeart: async () => {
    try {
      const db = getDB();
      const state = get();
      if (state.hearts <= 0) return 0;

      const newHearts = state.hearts - 1;
      const now = Date.now();

      if (state.hearts === 5) {
        await db.runAsync(
          'UPDATE users SET hearts = ?, last_refill_time = ? WHERE id = 1;',
          [newHearts, now]
        );
        set({ hearts: newHearts, lastRefillTime: now });
      } else {
        await db.runAsync(
          'UPDATE users SET hearts = ? WHERE id = 1;',
          [newHearts]
        );
        set({ hearts: newHearts });
      }
      return newHearts;
    } catch (e) {
      console.error('Failed to deduct heart in SQLite:', e);
      return get().hearts;
    }
  },

  refillHearts: async () => {
    try {
      const db = getDB();
      await db.runAsync(
        'UPDATE users SET hearts = 5, last_refill_time = 0 WHERE id = 1;'
      );
      set({ hearts: 5, lastRefillTime: 0 });
    } catch (e) {
      console.error('Failed to refill hearts in SQLite:', e);
    }
  },

  checkRefill: async () => {
    try {
      const db = getDB();
      const state = get();
      const now = Date.now();
      let hearts = state.hearts;
      let lastRefillTime = state.lastRefillTime;

      // 1. Midnight refill
      if (lastRefillTime > 0) {
        const lastRefillDate = new Date(lastRefillTime);
        const nowDate = new Date(now);
        const passedMidnight =
          nowDate.getDate() !== lastRefillDate.getDate() ||
          nowDate.getMonth() !== lastRefillDate.getMonth() ||
          nowDate.getFullYear() !== lastRefillDate.getFullYear();

        if (passedMidnight && now > lastRefillTime) {
          hearts = 5;
          lastRefillTime = 0;
        }
      }

      // 2. 30-minute incremental refill
      if (hearts < 5 && lastRefillTime > 0) {
        const elapsedMs = now - lastRefillTime;
        const intervalMs = 30 * 60 * 1000;

        if (elapsedMs >= intervalMs) {
          const heartsToAdd = Math.floor(elapsedMs / intervalMs);
          hearts = Math.min(5, hearts + heartsToAdd);

          if (hearts === 5) {
            lastRefillTime = 0;
          } else {
            lastRefillTime = lastRefillTime + heartsToAdd * intervalMs;
          }
        }
      }

      if (hearts !== state.hearts || lastRefillTime !== state.lastRefillTime) {
        await db.runAsync(
          'UPDATE users SET hearts = ?, last_refill_time = ? WHERE id = 1;',
          [hearts, lastRefillTime]
        );
        set({ hearts, lastRefillTime });
      }
    } catch (e) {
      console.error('Failed to check and refill hearts in SQLite:', e);
    }
  },

  updateStreak: async () => {
    try {
      const db = getDB();
      const state = get();
      const todayStr = getLocalDateString();
      const yesterdayStr = getYesterdayDateString();

      let currentStreak = state.streak;
      let activityDates = [...state.activityDates];
      let streakFreezeCount = state.streakFreezeCount;
      let freezeUsedDates = [...state.freezeUsedDates];
      let wasStreakBroken = false;

      if (!activityDates.includes(todayStr)) {
        activityDates = [...activityDates, todayStr];
      }

      if (state.lastActiveDate === todayStr) {
        // Already logged today
      } else if (state.lastActiveDate === yesterdayStr) {
        // Consecutive activity
        currentStreak += 1;
      } else if (state.lastActiveDate) {
        // Streak broken
        if (streakFreezeCount > 0 && currentStreak > 0) {
          // Use freeze item
          streakFreezeCount -= 1;
          freezeUsedDates = [...freezeUsedDates, yesterdayStr];
        } else {
          // Reset
          wasStreakBroken = currentStreak > 1;
          currentStreak = 1;
        }
      } else {
        // First ever activity
        currentStreak = 1;
      }

      await db.runAsync(
        `UPDATE users SET 
          streak = ?, 
          streak_freeze_count = ?, 
          last_active_date = ?, 
          activity_dates = ?, 
          freeze_used_dates = ?,
          was_streak_broken = ?
        WHERE id = 1;`,
        [
          currentStreak,
          streakFreezeCount,
          todayStr,
          JSON.stringify(activityDates),
          JSON.stringify(freezeUsedDates),
          wasStreakBroken ? 1 : 0,
        ]
      );

      set({
        streak: currentStreak,
        streakFreezeCount,
        lastActiveDate: todayStr,
        activityDates,
        freezeUsedDates,
        wasStreakBroken,
      });

      return { wasStreakBroken };
    } catch (e) {
      console.error('Failed to update user streak in SQLite:', e);
      return { wasStreakBroken: false };
    }
  },

  buyStreakFreeze: async () => {
    try {
      const db = getDB();
      const state = get();
      if (state.xp < 200) return false;

      const newXp = state.xp - 200;
      const levelInfo = getLevelInfo(newXp);
      const newFreezeCount = state.streakFreezeCount + 1;

      await db.runAsync(
        'UPDATE users SET xp = ?, level = ?, streak_freeze_count = ? WHERE id = 1;',
        [newXp, levelInfo.level, newFreezeCount]
      );

      set({
        xp: newXp,
        level: levelInfo.level,
        streakFreezeCount: newFreezeCount,
      });

      return true;
    } catch (e) {
      console.error('Failed to buy streak freeze in SQLite:', e);
      return false;
    }
  },

  completeOnboarding: async (placedUnit: number, score: number) => {
    try {
      const db = getDB();
      await db.runAsync(
        'UPDATE users SET onboarding_completed = 1 WHERE id = 1;'
      );
      set({ onboardingCompleted: true });
    } catch (e) {
      console.error('Failed to complete onboarding in SQLite:', e);
    }
  },

  updateQuizStats: async (score: number) => {
    try {
      const db = getDB();
      const state = get();
      const newQuizzesTaken = state.quizzesTaken + 1;
      const newHighScore = Math.max(state.quizHighScore, score);

      await db.runAsync(
        'UPDATE users SET quizzes_taken = ?, quiz_high_score = ? WHERE id = 1;',
        [newQuizzesTaken, newHighScore]
      );

      set({
        quizzesTaken: newQuizzesTaken,
        quizHighScore: newHighScore,
      });
    } catch (e) {
      console.error('Failed to update quiz stats in SQLite:', e);
    }
  },

  resetUser: async () => {
    try {
      const db = getDB();
      await db.runAsync(
        `UPDATE users SET
          xp = 0,
          level = 1,
          hearts = 5,
          last_refill_time = 0,
          streak = 0,
          streak_freeze_count = 0,
          was_streak_broken = 0,
          last_active_date = NULL,
          activity_dates = '[]',
          freeze_used_dates = '[]',
          onboarding_completed = 0,
          quizzes_taken = 0,
          quiz_high_score = 0
        WHERE id = 1;`
      );
      await db.runAsync('DELETE FROM xp_log;');

      set({
        xp: 0,
        level: 1,
        hearts: 5,
        lastRefillTime: 0,
        streak: 0,
        streakFreezeCount: 0,
        wasStreakBroken: false,
        lastActiveDate: null,
        activityDates: [],
        freezeUsedDates: [],
        onboardingCompleted: false,
        quizzesTaken: 0,
        quizHighScore: 0,
      });
    } catch (e) {
      console.error('Failed to reset user in SQLite:', e);
    }
  },
}));
