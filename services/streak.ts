import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_LAST_ACTIVE = '@odia_agent:last_active_date';
const KEY_STREAK = '@odia_agent:streak_count';
const KEY_ACTIVITY_DATES = '@odia_agent:activity_dates';

export interface StreakStats {
  currentStreak: number;
  activityDates: string[];
}

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getStreakStats(): Promise<StreakStats> {
  try {
    const lastActive = await AsyncStorage.getItem(KEY_LAST_ACTIVE);
    const streakStr = await AsyncStorage.getItem(KEY_STREAK);
    const activityStr = await AsyncStorage.getItem(KEY_ACTIVITY_DATES);

    const currentStreak = streakStr ? parseInt(streakStr, 10) : 0;
    const activityDates = activityStr ? (JSON.parse(activityStr) as string[]) : [];

    return { currentStreak, activityDates };
  } catch (e) {
    console.error('Failed to get streak stats', e);
    return { currentStreak: 0, activityDates: [] };
  }
}

export async function logActivity(): Promise<StreakStats> {
  try {
    const todayStr = getLocalDateString();
    
    const lastActive = await AsyncStorage.getItem(KEY_LAST_ACTIVE);
    const streakStr = await AsyncStorage.getItem(KEY_STREAK);
    const activityStr = await AsyncStorage.getItem(KEY_ACTIVITY_DATES);

    let currentStreak = streakStr ? parseInt(streakStr, 10) : 0;
    let activityDates = activityStr ? (JSON.parse(activityStr) as string[]) : [];

    if (!activityDates.includes(todayStr)) {
      activityDates.push(todayStr);
    }

    if (lastActive === todayStr) {
      // Already active today, streak count is maintained
    } else if (lastActive === getYesterdayDateString()) {
      // Active yesterday, increment streak
      currentStreak += 1;
    } else {
      // Streak broken, reset to 1
      currentStreak = 1;
    }

    await AsyncStorage.setItem(KEY_LAST_ACTIVE, todayStr);
    await AsyncStorage.setItem(KEY_STREAK, String(currentStreak));
    await AsyncStorage.setItem(KEY_ACTIVITY_DATES, JSON.stringify(activityDates));

    return { currentStreak, activityDates };
  } catch (e) {
    console.error('Failed to log activity', e);
    return { currentStreak: 0, activityDates: [] };
  }
}

function getYesterdayDateString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
}
