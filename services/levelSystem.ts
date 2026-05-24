export const LEVEL_THRESHOLDS = [
  0,      // Level 1 starts at 0 XP
  100,    // Level 2 starts at 100 XP
  250,    // Level 3 starts at 250 XP
  450,    // Level 4 starts at 450 XP
  700,    // Level 5 starts at 700 XP
  1000,   // Level 6 starts at 1000 XP
  1350,   // Level 7 starts at 1350 XP
  1750,   // Level 8 starts at 1750 XP
  2200,   // Level 9 starts at 2200 XP
  2700,   // Level 10 starts at 2700 XP
  3250,   // Level 11 starts at 3250 XP
  3900,   // Level 12 starts at 3900 XP
  4650,   // Level 13 starts at 4650 XP
  5500,   // Level 14 starts at 5500 XP
  6450,   // Level 15 starts at 6450 XP
  7500,   // Level 16 starts at 7500 XP
  8650,   // Level 17 starts at 8650 XP
  9900,   // Level 18 starts at 9900 XP
  11250,  // Level 19 starts at 11250 XP
  12700   // Level 20 starts at 12700 XP
];

export interface LevelInfo {
  level: number;
  minXp: number;
  maxXp: number;
  progress: number; // Float between 0.0 and 1.0
}

/**
 * Calculates current level and progress information based on total XP.
 */
export function getLevelInfo(xp: number): LevelInfo {
  let level = 1;
  
  // Find which level XP fits into
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  
  // Cap at Level 20
  if (level > 20) {
    level = 20;
  }
  
  const minXp = LEVEL_THRESHOLDS[level - 1];
  let maxXp = LEVEL_THRESHOLDS[level] ?? (minXp + 2000); // 2000 XP per level at max level
  
  // Calculate progress towards next level
  const progress = (xp - minXp) / (maxXp - minXp);
  
  return {
    level,
    minXp,
    maxXp,
    progress: Math.min(1.0, Math.max(0.0, progress))
  };
}
