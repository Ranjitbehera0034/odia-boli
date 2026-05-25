import { getDB } from './srs';

// ─── Constants ─────────────────────────────────────────────────────────────

export type Tier = 'Bronze' | 'Silver' | 'Gold';

export const TIERS: Tier[] = ['Bronze', 'Silver', 'Gold'];

export const TIER_COLORS: Record<Tier, { bg: string; text: string; border: string; badge: string }> = {
  Bronze: { bg: '#92400E15', text: '#92400E', border: '#92400E60', badge: '🥉' },
  Silver: { bg: '#6B728015', text: '#374151', border: '#9CA3AF60', badge: '🥈' },
  Gold:   { bg: '#D9770615', text: '#D97706', border: '#F59E0B60', badge: '🥇' },
};

export const LEAGUE_SIZE = 10; // 1 real user + 9 bots

// 9 fake competitors with Indian/Odia-sounding names and avatars
const BOT_PROFILES = [
  { id: 'bot_1', name: 'Priya Patel',    avatar: '👩🏽' },
  { id: 'bot_2', name: 'Arjun Mohanty', avatar: '👨🏽' },
  { id: 'bot_3', name: 'Sita Nanda',    avatar: '👩🏾' },
  { id: 'bot_4', name: 'Ravi Sahoo',    avatar: '👨🏾' },
  { id: 'bot_5', name: 'Ananya Das',    avatar: '👩🏽' },
  { id: 'bot_6', name: 'Deepak Rath',   avatar: '👨🏽' },
  { id: 'bot_7', name: 'Kavitha Misra', avatar: '👩🏾' },
  { id: 'bot_8', name: 'Suresh Behera', avatar: '👨🏾' },
  { id: 'bot_9', name: 'Meena Prusty',  avatar: '👩🏽' },
];

// Daily XP ranges per tier for bots (min, max)
const BOT_DAILY_XP_RANGE: Record<Tier, [number, number]> = {
  Bronze: [5,  40],
  Silver: [20, 80],
  Gold:   [50, 150],
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
}

export interface LeagueState {
  entries: LeagueEntry[];
  userTier: Tier;
  weekStartTimestamp: number;
  promotionIds: string[];  // IDs that will promote (top 3)
  demotionIds: string[];   // IDs that will demote (bottom 3)
}

// ─── DB Init ───────────────────────────────────────────────────────────────

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

    // Seed if empty
    const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM league_entries;');
    if (count && count.c === 0) {
      await _seedLeague();
    } else {
      // Apply any missed daily bot XP gains since last open
      await _applyBotDailyGains();
      // Check if week has reset
      await _checkWeeklyReset();
    }

    console.log('League database initialized.');
  } catch (error) {
    console.error('Failed to init league database:', error);
  }
}

// ─── Seeding ───────────────────────────────────────────────────────────────

async function _seedLeague(): Promise<void> {
  const db = getDB();
  const weekStart = _getWeekStart();

  // Insert the real user
  await db.runAsync(
    `INSERT OR IGNORE INTO league_entries (id, name, avatar, weekly_xp, tier, is_user, week_start)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    ['user', 'You', '🧑🏽', 0, 'Bronze', 1, weekStart]
  );

  // Insert bots with varied starting XP so the league looks alive
  for (const bot of BOT_PROFILES) {
    const startXp = _randomInt(10, 120); // head-start for realism
    await db.runAsync(
      `INSERT OR IGNORE INTO league_entries (id, name, avatar, weekly_xp, tier, is_user, week_start)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [bot.id, bot.name, bot.avatar, startXp, 'Bronze', 0, weekStart]
    );
  }
}

// ─── Weekly Reset ──────────────────────────────────────────────────────────

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

async function _checkWeeklyReset(): Promise<void> {
  const db = getDB();
  const currentWeekStart = _getWeekStart();

  const row = await db.getFirstAsync<{ week_start: number }>(
    'SELECT week_start FROM league_entries WHERE is_user = 1 LIMIT 1;'
  );

  if (!row || row.week_start >= currentWeekStart) return;

  // Week has turned — apply promotions/demotions then reset XP
  const entries = await _getRawEntries();
  const sorted = [...entries].sort((a, b) => b.weekly_xp - a.weekly_xp);

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    let newTier = entry.tier as Tier;

    if (i < 3 && entry.tier !== 'Gold') {
      // Promote
      newTier = entry.tier === 'Bronze' ? 'Silver' : 'Gold';
    } else if (i >= sorted.length - 3 && entry.tier !== 'Bronze') {
      // Demote
      newTier = entry.tier === 'Gold' ? 'Silver' : 'Bronze';
    }

    await db.runAsync(
      'UPDATE league_entries SET weekly_xp = ?, tier = ?, week_start = ? WHERE id = ?;',
      [0, newTier, currentWeekStart, entry.id]
    );
  }

  // Give bots a small head-start for the new week
  for (const bot of BOT_PROFILES) {
    const xp = _randomInt(0, 30);
    if (xp > 0) {
      await db.runAsync(
        'UPDATE league_entries SET weekly_xp = weekly_xp + ? WHERE id = ?;',
        [xp, bot.id]
      );
    }
  }
}

// ─── Bot Simulation ────────────────────────────────────────────────────────

async function _applyBotDailyGains(): Promise<void> {
  const db = getDB();

  for (const bot of BOT_PROFILES) {
    const row = await db.getFirstAsync<{ tier: string }>(
      'SELECT tier FROM league_entries WHERE id = ?;',
      [bot.id]
    );
    if (!row) continue;

    const tier = row.tier as Tier;
    const [min, max] = BOT_DAILY_XP_RANGE[tier];
    // Simulate a partial-day gain (30-100% of daily range, to feel organic)
    const fraction = 0.3 + Math.random() * 0.7;
    const gain = Math.round(_randomInt(min, max) * fraction);

    await db.runAsync(
      'UPDATE league_entries SET weekly_xp = weekly_xp + ? WHERE id = ?;',
      [gain, bot.id]
    );
  }
}

// ─── User XP ───────────────────────────────────────────────────────────────

/** Called whenever the real user earns XP. Adds to weekly_xp. */
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

// ─── Read State ────────────────────────────────────────────────────────────

interface RawEntry {
  id: string;
  name: string;
  avatar: string;
  weekly_xp: number;
  tier: string;
  is_user: number;
}

async function _getRawEntries(): Promise<RawEntry[]> {
  const db = getDB();
  return db.getAllAsync<RawEntry>('SELECT * FROM league_entries;');
}

export async function getLeagueState(): Promise<LeagueState> {
  try {
    await _applyBotDailyGains();
    await _checkWeeklyReset();

    const raw = await _getRawEntries();
    const sorted = [...raw].sort((a, b) => b.weekly_xp - a.weekly_xp);

    const userEntry = raw.find(e => e.is_user === 1);
    const userTier  = (userEntry?.tier ?? 'Bronze') as Tier;

    const promotionIds = sorted.slice(0, 3).map(e => e.id);
    const demotionIds  = sorted.slice(-3).map(e => e.id);

    const entries: LeagueEntry[] = sorted.map((e, idx) => ({
      id:       e.id,
      name:     e.name,
      avatar:   e.avatar,
      weeklyXp: e.weekly_xp,
      tier:     e.tier as Tier,
      isUser:   e.is_user === 1,
      rank:     idx + 1,
    }));

    return {
      entries,
      userTier,
      weekStartTimestamp: _getWeekStart(),
      promotionIds,
      demotionIds,
    };
  } catch (e) {
    console.error('Failed to get league state:', e);
    return { entries: [], userTier: 'Bronze', weekStartTimestamp: 0, promotionIds: [], demotionIds: [] };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function _randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** How many days until Monday (end of week)? */
export function getDaysUntilReset(): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  return dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7;
}
