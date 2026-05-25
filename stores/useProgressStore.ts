import { create } from 'zustand';
import { getDB } from '../services/srs';
import { PRACTICAL_PHRASES } from '../services/phrases';

export interface LessonProgressRow {
  lessonId: string;
  unitId: number;
  isCompleted: boolean;
  score: number;
  completedAt: number | null;
}

export interface VocabularyItem {
  id: string;
  odia: string;
  english: string;
  category: string;
  isLearned: boolean;
  isSaved: boolean;
  savedAt: number | null;
  learnedAt: number | null;
}

export interface SRSCard {
  id: string;
  odia: string;
  english: string;
  category: string;
  repetitions: number;
  interval: number;
  easeFactor: number;
  nextReview: number;
}

export interface HistoryEntry {
  id: string;
  odia: string;
  english: string;
  timestamp: number;
}

export interface SavedTranslation {
  id: string;
  odia: string;
  english: string;
  timestamp: number;
}

export interface ProgressStoreState {
  lessonProgress: Record<string, LessonProgressRow>;
  vocabulary: VocabularyItem[];
  srsCards: SRSCard[];
  dueCount: number;
  translationHistory: HistoryEntry[];
  savedTranslations: SavedTranslation[];
  loading: boolean;

  loadProgress: () => Promise<void>;
  completeLesson: (lessonId: string, unitId: number, score: number) => Promise<void>;
  markVocabularyLearned: (id: string) => Promise<void>;
  toggleSaveVocabularyItem: (id: string) => Promise<void>;
  toggleSaveTranslation: (odia: string, english: string) => Promise<void>;
  addHistory: (odia: string, english: string) => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  reviewSRSCard: (id: string, quality: number) => Promise<void>;
  resetProgress: () => Promise<void>;
  resetSRSCards: () => Promise<void>;
  getTranslationFromCache: (odiaText: string) => Promise<any | null>;
  saveTranslationToCache: (odiaText: string, result: any) => Promise<void>;
}

export const useProgressStore = create<ProgressStoreState>((set, get) => ({
  lessonProgress: {},
  vocabulary: [],
  srsCards: [],
  dueCount: 0,
  translationHistory: [],
  savedTranslations: [],
  loading: true,

  loadProgress: async () => {
    try {
      const db = getDB();

      // 1. Fetch lesson progress
      const progressRows = await db.getAllAsync<any>('SELECT * FROM progress;');
      const lessonProgress: Record<string, LessonProgressRow> = {};
      progressRows.forEach((row) => {
        lessonProgress[row.lesson_id] = {
          lessonId: row.lesson_id,
          unitId: row.unit_id,
          isCompleted: row.is_completed === 1,
          score: row.score,
          completedAt: row.completed_at,
        };
      });

      // 2. Fetch vocabulary
      const vocabRows = await db.getAllAsync<any>('SELECT * FROM vocabulary;');
      const vocabulary: VocabularyItem[] = vocabRows.map((row) => ({
        id: row.id,
        odia: row.odia,
        english: row.english,
        category: row.category,
        isLearned: row.is_learned === 1,
        isSaved: row.is_saved === 1,
        savedAt: row.saved_at,
        learnedAt: row.learned_at,
      }));

      // 3. Fetch SRS Cards
      const srsRows = await db.getAllAsync<any>('SELECT * FROM srs_cards;');
      const srsCards: SRSCard[] = srsRows.map((row) => ({
        id: row.id,
        odia: row.odia,
        english: row.english,
        category: row.category,
        repetitions: row.repetitions,
        interval: row.interval,
        easeFactor: row.ease_factor,
        nextReview: row.next_review,
      }));

      // 4. Fetch Translation History
      const historyRows = await db.getAllAsync<any>(
        'SELECT * FROM translation_history ORDER BY timestamp DESC;'
      );
      const translationHistory: HistoryEntry[] = historyRows.map((row) => ({
        id: row.id,
        odia: row.odia,
        english: row.english,
        timestamp: row.timestamp,
      }));

      // 5. Fetch Saved Translations
      const savedRows = await db.getAllAsync<any>(
        'SELECT * FROM saved_translations ORDER BY timestamp DESC;'
      );
      const savedTranslations: SavedTranslation[] = savedRows.map((row) => ({
        id: row.id,
        odia: row.odia,
        english: row.english,
        timestamp: row.timestamp,
      }));

      // 6. Calculate dueCount
      const now = Date.now();
      const dueCount = srsCards.filter((card) => card.nextReview <= now).length;

      set({
        lessonProgress,
        vocabulary,
        srsCards,
        dueCount,
        translationHistory,
        savedTranslations,
        loading: false,
      });
    } catch (e) {
      console.error('Failed to load progress details from SQLite:', e);
      set({ loading: false });
    }
  },

  completeLesson: async (lessonId: string, unitId: number, score: number) => {
    try {
      const db = getDB();
      const now = Date.now();

      await db.runAsync(
        `INSERT INTO progress (lesson_id, unit_id, is_completed, score, completed_at)
         VALUES (?, ?, 1, ?, ?)
         ON CONFLICT(lesson_id) DO UPDATE SET
           is_completed = 1,
           score = MAX(score, excluded.score),
           completed_at = excluded.completed_at;`,
        [lessonId, unitId, score, now]
      );

      set((state) => {
        const updated = { ...state.lessonProgress };
        const existing = updated[lessonId];
        updated[lessonId] = {
          lessonId,
          unitId,
          isCompleted: true,
          score: existing ? Math.max(existing.score, score) : score,
          completedAt: now,
        };
        return { lessonProgress: updated };
      });
    } catch (e) {
      console.error('Failed to save completed lesson progress:', e);
    }
  },

  markVocabularyLearned: async (id: string) => {
    try {
      const db = getDB();
      const now = Date.now();
      await db.runAsync(
        'UPDATE vocabulary SET is_learned = 1, learned_at = ? WHERE id = ?;',
        [now, id]
      );

      set((state) => ({
        vocabulary: state.vocabulary.map((item) =>
          item.id === id ? { ...item, isLearned: true, learnedAt: now } : item
        ),
      }));
    } catch (e) {
      console.error('Failed to mark vocabulary as learned:', e);
    }
  },

  toggleSaveVocabularyItem: async (id: string) => {
    try {
      const db = getDB();
      const state = get();
      const item = state.vocabulary.find((v) => v.id === id);
      if (!item) return;

      const newIsSaved = !item.isSaved;
      const now = newIsSaved ? Date.now() : null;

      await db.runAsync(
        'UPDATE vocabulary SET is_saved = ?, saved_at = ? WHERE id = ?;',
        [newIsSaved ? 1 : 0, now, id]
      );

      set((state) => ({
        vocabulary: state.vocabulary.map((v) =>
          v.id === id ? { ...v, isSaved: newIsSaved, savedAt: now } : v
        ),
      }));
    } catch (e) {
      console.error('Failed to toggle save on vocabulary item:', e);
    }
  },

  toggleSaveTranslation: async (odia: string, english: string) => {
    try {
      const db = getDB();
      const state = get();
      const oTrimmed = odia.trim();
      const eTrimmed = english.trim();
      if (!oTrimmed || !eTrimmed) return;

      const existing = state.savedTranslations.find(
        (t) => t.odia.trim() === oTrimmed && t.english.trim() === eTrimmed
      );

      if (existing) {
        // Delete
        await db.runAsync('DELETE FROM saved_translations WHERE id = ?;', [existing.id]);
        set((state) => ({
          savedTranslations: state.savedTranslations.filter((t) => t.id !== existing.id),
        }));
      } else {
        // Add
        const newId = Math.random().toString(36).substring(2, 9);
        const now = Date.now();
        await db.runAsync(
          'INSERT INTO saved_translations (id, odia, english, timestamp) VALUES (?, ?, ?, ?);',
          [newId, oTrimmed, eTrimmed, now]
        );
        set((state) => ({
          savedTranslations: [
            { id: newId, odia: oTrimmed, english: eTrimmed, timestamp: now },
            ...state.savedTranslations,
          ],
        }));
      }

      // Also check if this phrase matches one in vocabulary and toggle is_saved there
      const matchedVocab = state.vocabulary.find(
        (v) => v.odia.trim() === oTrimmed && v.english.trim() === eTrimmed
      );
      if (matchedVocab) {
        await get().toggleSaveVocabularyItem(matchedVocab.id);
      }
    } catch (e) {
      console.error('Failed to toggle save on translation:', e);
    }
  },

  addHistory: async (odia: string, english: string) => {
    try {
      const db = getDB();
      const state = get();
      const oTrimmed = odia.trim();
      const eTrimmed = english.trim();
      if (!oTrimmed || !eTrimmed) return;

      // Deduplicate
      const filteredHistory = state.translationHistory.filter(
        (item) => item.odia.trim() !== oTrimmed || item.english.trim() !== eTrimmed
      );

      // Remove from DB if exists
      await db.runAsync(
        'DELETE FROM translation_history WHERE TRIM(odia) = ? AND TRIM(english) = ?;',
        [oTrimmed, eTrimmed]
      );

      const newId = Math.random().toString(36).substring(2, 9);
      const now = Date.now();

      await db.runAsync(
        'INSERT INTO translation_history (id, odia, english, timestamp) VALUES (?, ?, ?, ?);',
        [newId, oTrimmed, eTrimmed, now]
      );

      let newHistory = [{ id: newId, odia: oTrimmed, english: eTrimmed, timestamp: now }, ...filteredHistory];
      if (newHistory.length > 100) {
        const itemsToDrop = newHistory.slice(100);
        for (const item of itemsToDrop) {
          await db.runAsync('DELETE FROM translation_history WHERE id = ?;', [item.id]);
        }
        newHistory = newHistory.slice(0, 100);
      }

      set({ translationHistory: newHistory });
    } catch (e) {
      console.error('Failed to add translation history entry:', e);
    }
  },

  deleteHistoryItem: async (id: string) => {
    try {
      const db = getDB();
      await db.runAsync('DELETE FROM translation_history WHERE id = ?;', [id]);
      set((state) => ({
        translationHistory: state.translationHistory.filter((item) => item.id !== id),
      }));
    } catch (e) {
      console.error('Failed to delete history item:', e);
    }
  },

  clearHistory: async () => {
    try {
      const db = getDB();
      await db.runAsync('DELETE FROM translation_history;');
      set({ translationHistory: [] });
    } catch (e) {
      console.error('Failed to clear translation history:', e);
    }
  },

  reviewSRSCard: async (id: string, quality: number) => {
    try {
      const db = getDB();
      const state = get();
      const card = state.srsCards.find((c) => c.id === id);
      if (!card) return;

      let repetitions = card.repetitions;
      let interval = card.interval;
      let easeFactor = card.easeFactor;

      if (quality >= 3) {
        if (repetitions === 0) {
          interval = 1;
        } else if (repetitions === 1) {
          interval = 6;
        } else {
          const multiplier = quality === 3 ? 0.8 : quality === 5 ? 1.2 : 1.0;
          interval = Math.max(1, Math.round(interval * easeFactor * multiplier));
        }
        repetitions += 1;
      } else {
        repetitions = 0;
        interval = 1;
      }

      easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (easeFactor < 1.3) {
        easeFactor = 1.3;
      }

      const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

      await db.runAsync(
        'UPDATE srs_cards SET repetitions = ?, interval = ?, ease_factor = ?, next_review = ? WHERE id = ?;',
        [repetitions, interval, easeFactor, nextReview, id]
      );

      const updatedCards = state.srsCards.map((c) =>
        c.id === id
          ? { ...c, repetitions, interval, easeFactor, nextReview }
          : c
      );

      const now = Date.now();
      const dueCount = updatedCards.filter((c) => c.nextReview <= now).length;

      set({
        srsCards: updatedCards,
        dueCount,
      });
    } catch (e) {
      console.error('Failed to review SRS card in SQLite:', e);
    }
  },

  resetProgress: async () => {
    try {
      const db = getDB();
      
      await db.runAsync('DELETE FROM progress;');
      await db.runAsync('DELETE FROM saved_translations;');
      await db.runAsync('DELETE FROM translation_history;');
      await db.runAsync('DELETE FROM translation_cache;');
      await db.runAsync('DELETE FROM vocabulary;');
      await db.runAsync('DELETE FROM srs_cards;');

      // Reseed vocabulary
      for (const phrase of PRACTICAL_PHRASES) {
        await db.runAsync(
          'INSERT INTO vocabulary (id, odia, english, category, is_learned, is_saved, saved_at, learned_at) VALUES (?, ?, ?, ?, 0, 0, NULL, NULL);',
          [phrase.id, phrase.odia, phrase.english, phrase.category]
        );
      }

      // Reseed srs_cards
      for (const phrase of PRACTICAL_PHRASES) {
        await db.runAsync(
          'INSERT INTO srs_cards (id, odia, english, category, repetitions, interval, ease_factor, next_review) VALUES (?, ?, ?, ?, 0, 0, 2.5, ?);',
          [phrase.id, phrase.odia, phrase.english, phrase.category, Date.now()]
        );
      }

      // Reload
      await get().loadProgress();
    } catch (e) {
      console.error('Failed to reset progress in SQLite:', e);
    }
  },

  resetSRSCards: async () => {
    try {
      const db = getDB();
      const now = Date.now();
      await db.runAsync(
        'UPDATE srs_cards SET repetitions = 0, interval = 0, ease_factor = 2.5, next_review = ?;',
        [now]
      );
      await get().loadProgress();
    } catch (e) {
      console.error('Failed to reset SRS cards in SQLite:', e);
    }
  },

  getTranslationFromCache: async (odiaText: string): Promise<any | null> => {
    try {
      const db = getDB();
      const normalized = odiaText.trim().toLowerCase();
      const row = await db.getFirstAsync<any>(
        'SELECT result_json FROM translation_cache WHERE LOWER(odia) = ?;',
        [normalized]
      );
      return row ? JSON.parse(row.result_json) : null;
    } catch (e) {
      console.error('Failed to get translation from cache:', e);
      return null;
    }
  },

  saveTranslationToCache: async (odiaText: string, result: any) => {
    try {
      const db = getDB();
      const normalized = odiaText.trim().toLowerCase();
      await db.runAsync(
        `INSERT INTO translation_cache (odia, english, result_json, timestamp)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(odia) DO UPDATE SET
           result_json = excluded.result_json,
           timestamp = excluded.timestamp;`,
        [odiaText.trim(), result.english, JSON.stringify(result), Date.now()]
      );
      // Cap cache at 50 entries
      const rows = await db.getAllAsync<any>('SELECT odia FROM translation_cache ORDER BY timestamp DESC;');
      if (rows.length > 50) {
        const itemsToDrop = rows.slice(50);
        for (const item of itemsToDrop) {
          await db.runAsync('DELETE FROM translation_cache WHERE odia = ?;', [item.odia]);
        }
      }
    } catch (e) {
      console.error('Failed to save translation to cache:', e);
    }
  },
}));
