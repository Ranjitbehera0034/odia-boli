import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_LAST_ACTIVE        = '@odia_agent:last_active_date';
const KEY_STREAK             = '@odia_agent:streak_count';
const KEY_ACTIVITY_DATES     = '@odia_agent:activity_dates';
const KEY_STREAK_FREEZE      = '@odia_agent:streak_freeze';
const KEY_FREEZE_USED_DATES  = '@odia_agent:streak_freeze_used_dates';

export interface StreakStats {
  currentStreak: number;
  activityDates: string[];       // days with actual activity
  freezeUsedDates: string[];     // days protected by a freeze
  streakFreezeCount: number;
  wasStreakBroken: boolean;      // true if streak just reset this session
}

export function getLocalDateString(date = new Date()): string {
  const year  = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day   = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
}

export async function getStreakStats(): Promise<StreakStats> {
  try {
    const [streakStr, activityStr, freezeStr, freezeUsedStr] = await Promise.all([
      AsyncStorage.getItem(KEY_STREAK),
      AsyncStorage.getItem(KEY_ACTIVITY_DATES),
      AsyncStorage.getItem(KEY_STREAK_FREEZE),
      AsyncStorage.getItem(KEY_FREEZE_USED_DATES),
    ]);

    return {
      currentStreak:     streakStr     ? parseInt(streakStr, 10)          : 0,
      activityDates:     activityStr   ? (JSON.parse(activityStr) as string[]) : [],
      freezeUsedDates:   freezeUsedStr ? (JSON.parse(freezeUsedStr) as string[]) : [],
      streakFreezeCount: freezeStr     ? parseInt(freezeStr, 10)          : 0,
      wasStreakBroken:   false,
    };
  } catch (e) {
    console.error('Failed to get streak stats', e);
    return { currentStreak: 0, activityDates: [], freezeUsedDates: [], streakFreezeCount: 0, wasStreakBroken: false };
  }
}

/**
 * Called once per app session. Increments streak if user was active yesterday,
 * auto-applies a streak freeze if they missed a day and have one available,
 * or resets streak to 1 on a broken streak.
 * Returns wasStreakBroken=true only when the streak actually resets to 1 from >1.
 */
export async function logActivity(): Promise<StreakStats> {
  try {
    const todayStr     = getLocalDateString();
    const yesterdayStr = getYesterdayDateString();

    const [lastActive, streakStr, activityStr, freezeStr, freezeUsedStr] = await Promise.all([
      AsyncStorage.getItem(KEY_LAST_ACTIVE),
      AsyncStorage.getItem(KEY_STREAK),
      AsyncStorage.getItem(KEY_ACTIVITY_DATES),
      AsyncStorage.getItem(KEY_STREAK_FREEZE),
      AsyncStorage.getItem(KEY_FREEZE_USED_DATES),
    ]);

    let currentStreak     = streakStr     ? parseInt(streakStr, 10)          : 0;
    let activityDates     = activityStr   ? (JSON.parse(activityStr) as string[]) : [];
    let streakFreezeCount = freezeStr     ? parseInt(freezeStr, 10)          : 0;
    let freezeUsedDates   = freezeUsedStr ? (JSON.parse(freezeUsedStr) as string[]) : [];
    let wasStreakBroken   = false;

    // Record today as active
    if (!activityDates.includes(todayStr)) {
      activityDates = [...activityDates, todayStr];
    }

    if (lastActive === todayStr) {
      // Already logged today — no change
    } else if (lastActive === yesterdayStr) {
      // Consecutive day — increment streak
      currentStreak += 1;
    } else if (lastActive) {
      // Missed at least one day
      if (streakFreezeCount > 0 && currentStreak > 0) {
        // Auto-apply one freeze to protect the streak
        streakFreezeCount -= 1;
        freezeUsedDates = [...freezeUsedDates, yesterdayStr];
        // Streak stays the same — don't increment, don't reset
      } else {
        // Streak broken
        wasStreakBroken = currentStreak > 1; // only "broken" if they had a real streak
        currentStreak = 1;
      }
    } else {
      // First ever activity
      currentStreak = 1;
    }

    await Promise.all([
      AsyncStorage.setItem(KEY_LAST_ACTIVE,       todayStr),
      AsyncStorage.setItem(KEY_STREAK,            String(currentStreak)),
      AsyncStorage.setItem(KEY_ACTIVITY_DATES,    JSON.stringify(activityDates)),
      AsyncStorage.setItem(KEY_STREAK_FREEZE,     String(streakFreezeCount)),
      AsyncStorage.setItem(KEY_FREEZE_USED_DATES, JSON.stringify(freezeUsedDates)),
    ]);

    return { currentStreak, activityDates, freezeUsedDates, streakFreezeCount, wasStreakBroken };
  } catch (e) {
    console.error('Failed to log activity', e);
    return { currentStreak: 0, activityDates: [], freezeUsedDates: [], streakFreezeCount: 0, wasStreakBroken: false };
  }
}

/**
 * Purchase a streak freeze using XP. Returns true if purchase succeeded.
 * Caller is responsible for deducting XP from the user profile.
 */
export const STREAK_FREEZE_COST = 200;

export async function buyStreakFreeze(): Promise<boolean> {
  try {
    const freezeStr = await AsyncStorage.getItem(KEY_STREAK_FREEZE);
    const current   = freezeStr ? parseInt(freezeStr, 10) : 0;
    await AsyncStorage.setItem(KEY_STREAK_FREEZE, String(current + 1));
    return true;
  } catch (e) {
    console.error('Failed to buy streak freeze', e);
    return false;
  }
}
