import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { logActivity, getStreakStats, StreakStats } from './streak';

interface StreakContextValue {
  streak: number;
  streakFreezeCount: number;
  wasStreakBroken: boolean;
  activityDates: string[];
  freezeUsedDates: string[];
  refreshStreak: () => Promise<void>;
}

const StreakContext = createContext<StreakContextValue>({
  streak: 0,
  streakFreezeCount: 0,
  wasStreakBroken: false,
  activityDates: [],
  freezeUsedDates: [],
  refreshStreak: async () => {},
});

export function StreakProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<StreakStats>({
    currentStreak: 0,
    streakFreezeCount: 0,
    wasStreakBroken: false,
    activityDates: [],
    freezeUsedDates: [],
  });

  const refreshStreak = useCallback(async () => {
    const updated = await getStreakStats();
    setStats(updated);
  }, []);

  useEffect(() => {
    // On mount: log activity (handles streak increment / freeze / reset)
    logActivity()
      .then((result) => setStats(result))
      .catch(console.error);
  }, []);

  return (
    <StreakContext.Provider
      value={{
        streak: stats.currentStreak,
        streakFreezeCount: stats.streakFreezeCount,
        wasStreakBroken: stats.wasStreakBroken,
        activityDates: stats.activityDates,
        freezeUsedDates: stats.freezeUsedDates,
        refreshStreak,
      }}
    >
      {children}
    </StreakContext.Provider>
  );
}

export function useStreak() {
  return useContext(StreakContext);
}
