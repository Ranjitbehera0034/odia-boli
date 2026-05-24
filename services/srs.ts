import * as SQLite from 'expo-sqlite';
import { PRACTICAL_PHRASES, Phrase } from './phrases';

const DATABASE_NAME = 'odia_srs.db';

export interface SRSItem {
  id: string;
  odia: string;
  english: string;
  category: string;
  repetitions: number;
  interval: number;
  easeFactor: number;
  nextReview: number; // timestamp in milliseconds
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the single active database instance.
 */
export function getDB(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(DATABASE_NAME);
  }
  return dbInstance;
}

/**
 * Initialize the database schema and seed default phrases if empty.
 */
export async function initSRSDatabase(): Promise<void> {
  try {
    const db = getDB();

    // Create table for storing SRS study state
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS srs_items (
        id TEXT PRIMARY KEY,
        odia TEXT NOT NULL,
        english TEXT NOT NULL,
        category TEXT NOT NULL,
        repetitions INTEGER NOT NULL DEFAULT 0,
        interval INTEGER NOT NULL DEFAULT 0,
        ease_factor REAL NOT NULL DEFAULT 2.5,
        next_review INTEGER NOT NULL
      );
    `);

    // Check if table contains any entries
    const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM srs_items;');
    const count = row ? row.count : 0;

    if (count === 0) {
      console.log('Seeding initial SRS data into SQLite database...');
      // Seed all default phrases
      for (const phrase of PRACTICAL_PHRASES) {
        await db.runAsync(
          'INSERT INTO srs_items (id, odia, english, category, repetitions, interval, ease_factor, next_review) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
          [phrase.id, phrase.odia, phrase.english, phrase.category, 0, 0, 2.5, Date.now()]
        );
      }
      console.log('Seeding completed.');
    }
  } catch (error) {
    console.error('Failed to initialize SRS database:', error);
  }
}

/**
 * Fetch the number of items currently due for review.
 */
export async function getDueCount(): Promise<number> {
  try {
    const db = getDB();
    const now = Date.now();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM srs_items WHERE next_review <= ?;',
      [now]
    );
    return row ? row.count : 0;
  } catch (error) {
    console.error('Failed to get due count:', error);
    return 0;
  }
}

/**
 * Fetch all items currently due for review.
 */
export async function getDueItems(): Promise<SRSItem[]> {
  try {
    const db = getDB();
    const now = Date.now();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM srs_items WHERE next_review <= ? ORDER BY next_review ASC;',
      [now]
    );
    return rows.map((row) => ({
      id: row.id,
      odia: row.odia,
      english: row.english,
      category: row.category,
      repetitions: row.repetitions,
      interval: row.interval,
      easeFactor: row.ease_factor,
      nextReview: row.next_review,
    }));
  } catch (error) {
    console.error('Failed to get due items:', error);
    return [];
  }
}

/**
 * Fetch all items, regardless of due status (for study-ahead mode).
 */
export async function getAllItems(): Promise<SRSItem[]> {
  try {
    const db = getDB();
    const rows = await db.getAllAsync<any>('SELECT * FROM srs_items ORDER BY next_review ASC;');
    return rows.map((row) => ({
      id: row.id,
      odia: row.odia,
      english: row.english,
      category: row.category,
      repetitions: row.repetitions,
      interval: row.interval,
      easeFactor: row.ease_factor,
      nextReview: row.next_review,
    }));
  } catch (error) {
    console.error('Failed to get all items:', error);
    return [];
  }
}

/**
 * Update SRS properties for a phrase after review using the SM-2 algorithm.
 * quality options:
 * 1 = Again (Forgot/Failed)
 * 3 = Hard (Passed with extreme effort)
 * 4 = Good (Standard correct pass)
 * 5 = Easy (Immediate correct recall)
 */
export async function updateSRSCard(id: string, quality: number): Promise<void> {
  try {
    const db = getDB();
    const card = await db.getFirstAsync<any>('SELECT * FROM srs_items WHERE id = ?;', [id]);
    
    if (!card) {
      console.warn(`Card with id ${id} not found in database.`);
      return;
    }

    let repetitions = card.repetitions;
    let interval = card.interval;
    let easeFactor = card.ease_factor;

    // Apply SM-2 algorithm
    if (quality >= 3) {
      if (repetitions === 0) {
        interval = 1; // 1 day
      } else if (repetitions === 1) {
        interval = 6; // 6 days
      } else {
        // Adjust standard interval multiplier slightly for 'Hard' vs 'Easy'
        const multiplier = quality === 3 ? 0.8 : quality === 5 ? 1.2 : 1.0;
        interval = Math.max(1, Math.round(interval * easeFactor * multiplier));
      }
      repetitions += 1;
    } else {
      // Forgot / Incorrect - Reset the schedule
      repetitions = 0;
      interval = 1; // 1 day
    }

    // Modify the ease factor based on review quality
    // SM-2 formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) {
      easeFactor = 1.3; // minimum ease factor
    }

    // Calculate the next review date timestamp (interval is in days)
    const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

    await db.runAsync(
      'UPDATE srs_items SET repetitions = ?, interval = ?, ease_factor = ?, next_review = ? WHERE id = ?;',
      [repetitions, interval, easeFactor, nextReview, id]
    );
  } catch (error) {
    console.error('Failed to update SRS card:', error);
  }
}

/**
 * Reset all SRS progress back to default.
 */
export async function resetSRSDatabase(): Promise<void> {
  try {
    const db = getDB();
    // Reset repetitions, intervals, and set next review to now
    const now = Date.now();
    await db.runAsync(
      'UPDATE srs_items SET repetitions = 0, interval = 0, ease_factor = 2.5, next_review = ?;',
      [now]
    );
    console.log('Spaced Repetition progress has been reset successfully.');
  } catch (error) {
    console.error('Failed to reset SRS database:', error);
  }
}
