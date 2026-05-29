import { create } from 'zustand';
import { getDB } from '../services/srs';
import { getLevelInfo } from '../services/levelSystem';
import { addLeagueXp } from '../services/league';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';

// Lazy sync trigger — avoids circular dependency with useSyncStore
const triggerSync = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useSyncStore } = require('./useSyncStore') as any;
    useSyncStore.getState().sync().catch(console.error);
  } catch (e) {
    console.warn('Sync trigger skipped:', e);
  }
};

// Lazy analytics trigger — avoids circular dependency issues
const trackStreakLost = (previousStreak: number) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { trackEvent, EVENTS } = require('../services/analytics') as any;
    trackEvent(EVENTS.STREAK_LOST, { previousStreak }).catch(console.error);
  } catch (e) {
    console.warn('Analytics streak_lost skipped:', e);
  }
};

export interface UserState {
  xp: number;
  level: number;
  hearts: number;
  gems: number;
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

  // New Profile fields
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string;
  location: string;
  nativeLanguage: string;
  learningGoal: string;
  longestStreak: number;
  isPublic: boolean;
  badges: string[];
  interests: string[];
  createdAt: number;

  activeCelebrationMilestone: 7 | 30 | 100 | 365 | null;
  setCelebrationMilestone: (milestone: 7 | 30 | 100 | 365 | null) => void;

  loadUser: () => Promise<void>;
  addXp: (amount: number, source: string) => Promise<void>;
  addGems: (amount: number) => Promise<void>;
  deductHeart: () => Promise<number>;
  refillHearts: () => Promise<void>;
  checkRefill: () => Promise<void>;
  updateStreak: () => Promise<{ wasStreakBroken: boolean; newlyUnlockedMilestone: 7 | 30 | 100 | 365 | null }>;
  buyStreakFreeze: () => Promise<boolean>;
  completeOnboarding: (placedUnit: number, score: number) => Promise<void>;
  updateQuizStats: (score: number) => Promise<void>;
  resetUser: () => Promise<void>;
  updateProfile: (fields: Partial<{
    username: string;
    bio: string;
    location: string;
    nativeLanguage: string;
    learningGoal: string;
    isPublic: boolean;
    avatarUrl: string | null;
    interests: string[];
  }>) => Promise<void>;
  uploadAvatar: (uri: string) => Promise<string | null>;
  recalculateBadges: () => Promise<string[]>;
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
  gems: 0,
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

  username: '',
  email: '',
  avatarUrl: null,
  bio: '',
  location: '',
  nativeLanguage: 'English',
  learningGoal: 'casual',
  longestStreak: 0,
  isPublic: true,
  badges: [],
  interests: [],
  createdAt: 0,
  activeCelebrationMilestone: null,
  setCelebrationMilestone: (milestone) => set({ activeCelebrationMilestone: milestone }),
 
  loadUser: async () => {
    try {
      const db = getDB();
      const row = await db.getFirstAsync<any>('SELECT * FROM users WHERE id = 1;');
      if (row) {
        set({
          xp: row.xp,
          level: row.level,
          hearts: row.hearts,
          gems: row.gems || 0,
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
          username: row.username || '',
          email: row.email || '',
          avatarUrl: row.avatar_url || null,
          bio: row.bio || '',
          location: row.location || '',
          nativeLanguage: row.native_language || 'English',
          learningGoal: row.learning_goal || 'casual',
          longestStreak: row.longest_streak || 0,
          isPublic: row.is_public !== 0,
          badges: JSON.parse(row.badges || '[]'),
          interests: row.interests ? row.interests.split(',').filter(Boolean) : [],
          createdAt: row.created_at || Date.now(),
          loading: false,
        });
        
        // Recalculate badges on load to ensure consistency
        await get().recalculateBadges();
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
        'UPDATE users SET xp = ?, level = ?, updated_at = ? WHERE id = 1;',
        [newXp, newLevelInfo.level, now]
      );

      // Update league weekly XP
      await addLeagueXp(amount);

      set({
        xp: newXp,
        level: newLevelInfo.level,
      });

      // Trigger daily challenge updates for xp_earned and lessons_completed
      try {
        const { useChallengeStore } = require('./useChallengeStore');
        useChallengeStore.getState().incrementProgress('xp_earned', amount).catch(console.error);
        if (source === 'Lesson completion') {
          useChallengeStore.getState().incrementProgress('lessons_completed', 1).catch(console.error);
        }
      } catch (err) {
        console.warn('Failed to update daily challenges in addXp:', err);
      }

      // Trigger sync
      triggerSync();
    } catch (e) {
      console.error('Failed to add XP in SQLite:', e);
    }
  },

  addGems: async (amount: number) => {
    try {
      const db = getDB();
      const state = get();
      const newGems = state.gems + amount;
      const now = Date.now();

      await db.runAsync(
        'UPDATE users SET gems = ?, updated_at = ? WHERE id = 1;',
        [newGems, now]
      );

      set({ gems: newGems });

      // Trigger sync
      triggerSync();
    } catch (e) {
      console.error('Failed to add gems in SQLite:', e);
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
          'UPDATE users SET hearts = ?, last_refill_time = ?, updated_at = ? WHERE id = 1;',
          [newHearts, now, now]
        );
        set({ hearts: newHearts, lastRefillTime: now });
      } else {
        await db.runAsync(
          'UPDATE users SET hearts = ?, updated_at = ? WHERE id = 1;',
          [newHearts, now]
        );
        set({ hearts: newHearts });
      }

      // Trigger sync
      triggerSync();
      return newHearts;
    } catch (e) {
      console.error('Failed to deduct heart in SQLite:', e);
      return get().hearts;
    }
  },

  refillHearts: async () => {
    try {
      const db = getDB();
      const now = Date.now();
      await db.runAsync(
        'UPDATE users SET hearts = 5, last_refill_time = 0, updated_at = ? WHERE id = 1;',
        [now]
      );
      set({ hearts: 5, lastRefillTime: 0 });

      // Trigger sync
      triggerSync();
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
          'UPDATE users SET hearts = ?, last_refill_time = ?, updated_at = ? WHERE id = 1;',
          [hearts, lastRefillTime, now]
        );
        set({ hearts, lastRefillTime });

        // Trigger sync
        triggerSync();
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
      const now = Date.now();

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
          if (wasStreakBroken) {
            // Fire analytics event before the streak resets to 1
            trackStreakLost(currentStreak);
          }
          currentStreak = 1;
        }
      } else {
        // First ever activity
        currentStreak = 1;
      }

      const newLongestStreak = Math.max(state.longestStreak, currentStreak);

      await db.runAsync(
        `UPDATE users SET 
          streak = ?, 
          streak_freeze_count = ?, 
          last_active_date = ?, 
          activity_dates = ?, 
          freeze_used_dates = ?,
          was_streak_broken = ?,
          longest_streak = ?,
          updated_at = ?
        WHERE id = 1;`,
        [
          currentStreak,
          streakFreezeCount,
          todayStr,
          JSON.stringify(activityDates),
          JSON.stringify(freezeUsedDates),
          wasStreakBroken ? 1 : 0,
          newLongestStreak,
          now,
        ]
      );

      // Check for newly unlocked milestone clubs before updating badges
      let newlyUnlockedMilestone: 7 | 30 | 100 | 365 | null = null;
      const milestones: (7 | 30 | 100 | 365)[] = [7, 30, 100, 365];
      for (const milestone of milestones) {
        const badgeId = `streak_club_${milestone}`;
        if (currentStreak >= milestone && !state.badges.includes(badgeId)) {
          newlyUnlockedMilestone = milestone;
        }
      }

      set({
        streak: currentStreak,
        streakFreezeCount,
        lastActiveDate: todayStr,
        activityDates,
        freezeUsedDates,
        wasStreakBroken,
        longestStreak: newLongestStreak,
        ...(newlyUnlockedMilestone !== null ? { activeCelebrationMilestone: newlyUnlockedMilestone } : {}),
      });

      // Recalculate badges (will trigger sync if badges changed)
      await get().recalculateBadges();

      return { wasStreakBroken, newlyUnlockedMilestone };
    } catch (e) {
      console.error('Failed to update user streak in SQLite:', e);
      return { wasStreakBroken: false, newlyUnlockedMilestone: null };
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
      const now = Date.now();

      await db.runAsync(
        'UPDATE users SET xp = ?, level = ?, streak_freeze_count = ?, updated_at = ? WHERE id = 1;',
        [newXp, levelInfo.level, newFreezeCount, now]
      );

      set({
        xp: newXp,
        level: levelInfo.level,
        streakFreezeCount: newFreezeCount,
      });

      // Trigger sync
      triggerSync();
      return true;
    } catch (e) {
      console.error('Failed to buy streak freeze in SQLite:', e);
      return false;
    }
  },

  completeOnboarding: async (placedUnit: number, score: number) => {
    try {
      const db = getDB();
      const now = Date.now();
      await db.runAsync(
        'UPDATE users SET onboarding_completed = 1, updated_at = ? WHERE id = 1;',
        [now]
      );
      set({ onboardingCompleted: true });

      // Recalculate badges
      await get().recalculateBadges();
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
      const now = Date.now();

      await db.runAsync(
        'UPDATE users SET quizzes_taken = ?, quiz_high_score = ?, updated_at = ? WHERE id = 1;',
        [newQuizzesTaken, newHighScore, now]
      );

      set({
        quizzesTaken: newQuizzesTaken,
        quizHighScore: newHighScore,
      });

      // Recalculate badges
      await get().recalculateBadges();
    } catch (e) {
      console.error('Failed to update quiz stats in SQLite:', e);
    }
  },

  resetUser: async () => {
    try {
      const db = getDB();
      const now = Date.now();
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
          quiz_high_score = 0,
          gems = 0,
          updated_at = ?
        WHERE id = 1;`,
        [now]
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
        gems: 0,
      });

      // Trigger sync
      triggerSync();
    } catch (e) {
      console.error('Failed to reset user in SQLite:', e);
    }
  },

  updateProfile: async (fields) => {
    try {
      const db = getDB();
      const state = get();
      const now = Date.now();

      const usernameVal = fields.username !== undefined ? fields.username : state.username;
      const bioVal = fields.bio !== undefined ? fields.bio : state.bio;
      const locationVal = fields.location !== undefined ? fields.location : state.location;
      const nativeLanguageVal = fields.nativeLanguage !== undefined ? fields.nativeLanguage : state.nativeLanguage;
      const learningGoalVal = fields.learningGoal !== undefined ? fields.learningGoal : state.learningGoal;
      const isPublicVal = fields.isPublic !== undefined ? (fields.isPublic ? 1 : 0) : (state.isPublic ? 1 : 0);
      const avatarUrlVal = fields.avatarUrl !== undefined ? fields.avatarUrl : state.avatarUrl;
      const interestsVal = fields.interests !== undefined ? fields.interests.join(',') : state.interests.join(',');

      await db.runAsync(
        `UPDATE users SET
          username = ?,
          bio = ?,
          location = ?,
          native_language = ?,
          learning_goal = ?,
          is_public = ?,
          avatar_url = ?,
          interests = ?,
          updated_at = ?
        WHERE id = 1;`,
        [usernameVal, bioVal, locationVal, nativeLanguageVal, learningGoalVal, isPublicVal, avatarUrlVal, interestsVal, now]
      );

      set({
        username: usernameVal,
        bio: bioVal,
        location: locationVal,
        nativeLanguage: nativeLanguageVal,
        learningGoal: learningGoalVal,
        isPublic: fields.isPublic !== undefined ? fields.isPublic : state.isPublic,
        avatarUrl: avatarUrlVal,
        interests: fields.interests !== undefined ? fields.interests : state.interests,
      });

      // Trigger sync
      triggerSync();
    } catch (e) {
      console.error('Failed to update user profile in SQLite:', e);
    }
  },

  uploadAvatar: async (uri) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('User not logged in');

      const userId = session.user.id;
      
      // Fetch local file blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Determine file extension
      const ext = uri.split('.').pop() || 'png';
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      // Upload to storage bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      // Save public URL locally and sync
      await get().updateProfile({ avatarUrl: publicUrl });

      return publicUrl;
    } catch (e) {
      console.error('Failed to upload avatar image:', e);
      Alert.alert(
        'Upload Failed ⚠️', 
        'Failed to upload avatar image. Make sure the storage bucket "avatars" is created and public on Supabase.'
      );
      return null;
    }
  },

  recalculateBadges: async () => {
    try {
      const db = getDB();
      const state = get();

      // 1. Fetch counts from SQLite
      const learnedRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM vocabulary WHERE is_learned = 1;');
      const totalLearned = learnedRow?.count || 0;

      const savedRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM saved_translations;');
      const totalSaved = savedRow?.count || 0;

      const earnedBadges: string[] = [];

      if (state.onboardingCompleted) earnedBadges.push('first_steps');
      if (totalLearned >= 5) earnedBadges.push('odia_learner');
      if (totalLearned >= 20) earnedBadges.push('vocab_star');
      if (state.streak >= 3 || state.longestStreak >= 3) earnedBadges.push('streak_starter');
      if (state.streak >= 7 || state.longestStreak >= 7) earnedBadges.push('streak_champion');
      if (state.quizzesTaken >= 3) earnedBadges.push('quiz_master');
      if (state.quizHighScore >= 10) earnedBadges.push('perfect_score');
      if (totalSaved >= 5) earnedBadges.push('word_collector');

      // Streak Society clubs
      if (state.streak >= 7 || state.longestStreak >= 7) earnedBadges.push('streak_club_7');
      if (state.streak >= 30 || state.longestStreak >= 30) earnedBadges.push('streak_club_30');
      if (state.streak >= 100 || state.longestStreak >= 100) earnedBadges.push('streak_club_100');
      if (state.streak >= 365 || state.longestStreak >= 365) earnedBadges.push('streak_club_365');

      // Sort badges for consistent comparison
      earnedBadges.sort();
      const currentBadges = [...state.badges].sort();

      if (JSON.stringify(earnedBadges) !== JSON.stringify(currentBadges)) {
        const now = Date.now();
        await db.runAsync(
          'UPDATE users SET badges = ?, updated_at = ? WHERE id = 1;',
          [JSON.stringify(earnedBadges), now]
        );
        set({ badges: earnedBadges });
        
        // Trigger sync
        triggerSync();
      }

      return earnedBadges;
    } catch (e) {
      console.error('Failed to recalculate badges in SQLite:', e);
      return get().badges;
    }
  },
}));
