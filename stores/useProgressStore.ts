import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB } from '../services/srs';
import { PRACTICAL_PHRASES } from '../services/phrases';
import { CURRICULUM } from '../services/curriculumData';
import { Challenge, generateSmartSentences } from '../services/gemini';

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
  weakAreas: string[];
  recommendedLessons: string[];
  focusVocabulary: string[];
  loadPersonalization: () => Promise<void>;
  generatePersonalization: () => Promise<void>;
  smartSentences: Challenge[];
  isGeneratingSmartSentences: boolean;
  loadSmartSentences: () => Promise<void>;
  generateSmartSentencesAction: (force?: boolean) => Promise<void>;
}

export const useProgressStore = create<ProgressStoreState>((set, get) => ({
  lessonProgress: {},
  vocabulary: [],
  srsCards: [],
  dueCount: 0,
  translationHistory: [],
  savedTranslations: [],
  loading: true,
  weakAreas: [],
  recommendedLessons: [],
  focusVocabulary: [],
  smartSentences: [],
  isGeneratingSmartSentences: false,

  loadProgress: async () => {
    try {
      const db = getDB();

      // Load personalization recommendations
      await get().loadPersonalization();
 
      // Load smart sentences
      await get().loadSmartSentences();

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
        `INSERT INTO progress (lesson_id, unit_id, is_completed, score, completed_at, updated_at)
         VALUES (?, ?, 1, ?, ?, ?)
         ON CONFLICT(lesson_id) DO UPDATE SET
           is_completed = 1,
           score = MAX(score, excluded.score),
           completed_at = excluded.completed_at,
           updated_at = excluded.updated_at;`,
        [lessonId, unitId, score, now, now, now]
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

      // Trigger sync
      triggerSync();

      // Check if we should trigger personalization analysis (every 5 lessons)
      const completedCountRow = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM progress WHERE is_completed = 1;'
      );
      const totalCompleted = completedCountRow?.count || 0;

      const lastAnalyzedStr = await AsyncStorage.getItem('@odia_agent:last_analyzed_lessons_count');
      const lastAnalyzed = lastAnalyzedStr ? parseInt(lastAnalyzedStr, 10) : 0;

      if (totalCompleted > 0 && totalCompleted - lastAnalyzed >= 5) {
        console.log(`[Personalization] ${totalCompleted - lastAnalyzed} lessons completed since last analysis. Triggering personalization...`);
        get().generatePersonalization().then(async () => {
          await AsyncStorage.setItem('@odia_agent:last_analyzed_lessons_count', String(totalCompleted));
        }).catch(console.error);
      }
    } catch (e) {
      console.error('Failed to save completed lesson progress:', e);
    }
  },

  markVocabularyLearned: async (id: string) => {
    try {
      const db = getDB();
      const now = Date.now();
      await db.runAsync(
        'UPDATE vocabulary SET is_learned = 1, learned_at = ?, updated_at = ? WHERE id = ?;',
        [now, now, id]
      );

      set((state) => ({
        vocabulary: state.vocabulary.map((item) =>
          item.id === id ? { ...item, isLearned: true, learnedAt: now } : item
        ),
      }));

      // Recalculate badges (will trigger sync automatically)
      import('./useUserStore').then((m) => m.useUserStore.getState().recalculateBadges().catch(console.error));
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
      const now = Date.now();

      await db.runAsync(
        'UPDATE vocabulary SET is_saved = ?, saved_at = ?, updated_at = ? WHERE id = ?;',
        [newIsSaved ? 1 : 0, newIsSaved ? now : null, now, id]
      );

      set((state) => ({
        vocabulary: state.vocabulary.map((v) =>
          v.id === id ? { ...v, isSaved: newIsSaved, savedAt: newIsSaved ? now : null } : v
        ),
      }));

      // Recalculate badges (will trigger sync automatically)
      import('./useUserStore').then((m) => m.useUserStore.getState().recalculateBadges().catch(console.error));
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
      } else {
        // If not a vocabulary item, we still recalculate badges to check for the 'word_collector' badge
        import('./useUserStore').then((m) => m.useUserStore.getState().recalculateBadges().catch(console.error));
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
      // Recalculate badges
      import('./useUserStore').then((m) => m.useUserStore.getState().recalculateBadges().catch(console.error));
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

  loadPersonalization: async () => {
    try {
      const stored = await AsyncStorage.getItem('@odia_agent:personalization_recommendations');
      if (stored) {
        const parsed = JSON.parse(stored);
        set({
          weakAreas: parsed.weakAreas || [],
          recommendedLessons: parsed.recommendedLessons || [],
          focusVocabulary: parsed.focusVocabulary || [],
        });
      }
    } catch (e) {
      console.error('Failed to load personalization recommendations from AsyncStorage:', e);
    }
  },

  generatePersonalization: async () => {
    try {
      const db = getDB();
      
      // Query last 20 mistakes from mistake_log
      const mistakes = await db.getAllAsync<any>(
        'SELECT question, correct_answer, user_answer FROM mistake_log ORDER BY timestamp DESC LIMIT 20;'
      );

      if (mistakes.length === 0) {
        console.log('[Personalization] No mistakes logged yet. Skipping analysis.');
        return;
      }

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('Gemini API key is missing. Skipping personalization analysis.');
        return;
      }

      console.log(`[Personalization] Compiling prompt with ${mistakes.length} mistakes for Gemini...`);

      const prompt = `You are an AI language learning assistant analyzing Odia learner mistakes.
Identify the top 3 weak areas, recommend specific lesson IDs to review (select strictly from the list of available lesson IDs below), and suggest 5 vocabulary words to focus on.
Return STRICTLY a JSON object matching this structure:
{
  "weakAreas": ["Verb Conjugations", "Plural Forms", "Shopping Vocabulary"],
  "recommendedLessons": ["lesson_1_2", "lesson_2_3"],
  "focusVocabulary": ["dhanyabaada", "namaste", "ghara", "khaiba", "pani"]
}

Available lessons to recommend (select from these IDs):
${CURRICULUM.map(unit => unit.lessons.map(l => `- ${l.id} (${l.title}: ${l.description})`).join('\n')).join('\n')}

Mistake log (last 20 incorrect answers):
${JSON.stringify(mistakes, null, 2)}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error during personalization: ${response.status}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Received empty response from Gemini personalization.');
      }

      const parsed = JSON.parse(rawText.trim());
      
      // Save recommendations to AsyncStorage
      await AsyncStorage.setItem(
        '@odia_agent:personalization_recommendations',
        JSON.stringify(parsed)
      );

      set({
        weakAreas: parsed.weakAreas || [],
        recommendedLessons: parsed.recommendedLessons || [],
        focusVocabulary: parsed.focusVocabulary || [],
      });

      console.log('[Personalization] Successfully generated and stored recommendations.');
    } catch (err) {
      console.error('[Personalization] Failed to generate personalization:', err);
    }
  },
 
  loadSmartSentences: async () => {
    try {
      const db = getDB();
      const rows = await db.getAllAsync<any>(
        'SELECT * FROM generated_sentences ORDER BY created_at DESC;'
      );
 
      const sentences: Challenge[] = rows.map((row) => ({
        id: row.id,
        text: row.text,
        focus: row.focus,
        odia: row.odia,
        difficulty: row.difficulty as 'Easy' | 'Medium' | 'Hard',
      }));
 
      set({ smartSentences: sentences });
 
      // Check if we need to regenerate (empty or older than 7 days)
      const oldestRecord = rows[0];
      const isExpired = oldestRecord ? (Date.now() - oldestRecord.created_at) > (7 * 24 * 60 * 60 * 1000) : true;
 
      if (sentences.length === 0 || isExpired) {
        console.log('[SmartSentences] Cache empty or expired, triggering regeneration...');
        await get().generateSmartSentencesAction();
      }
    } catch (e) {
      console.error('[SmartSentences] Failed to load smart sentences:', e);
    }
  },
 
  generateSmartSentencesAction: async (force = false) => {
    const { isGeneratingSmartSentences } = get();
    if (isGeneratingSmartSentences && !force) return;
 
    set({ isGeneratingSmartSentences: true });
 
    try {
      const db = getDB();
      const { useUserStore } = require('./useUserStore');
      const userState = useUserStore.getState();
      
      const interests = userState.interests || [];
      const weakAreas = get().weakAreas || [];
      const level = userState.level || 1;
 
      // Query recent mistakes from SQLite
      const recentMistakes = await db.getAllAsync<{ question: string; correct_answer: string }>(
        'SELECT question, correct_answer FROM mistake_log ORDER BY timestamp DESC LIMIT 5;'
      );
 
      const interestsToUse = interests.length > 0 ? interests : ['general', 'travel', 'food'];
 
      const result = await generateSmartSentences(interestsToUse, weakAreas, level, recentMistakes);
 
      if (result && result.length > 0) {
        // Clear old generated sentences
        await db.runAsync('DELETE FROM generated_sentences;');
 
        const now = Date.now();
        for (const item of result) {
          await db.runAsync(
            `INSERT OR REPLACE INTO generated_sentences (id, text, focus, odia, difficulty, created_at)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [item.id || Math.random().toString(36).substring(2, 9), item.text, item.focus, item.odia, item.difficulty, now]
          );
        }
 
        set({ smartSentences: result });
        console.log('[SmartSentences] Successfully generated and cached sentences.');
      }
    } catch (e) {
      console.error('[SmartSentences] Failed to generate smart sentences:', e);
    } finally {
      set({ isGeneratingSmartSentences: false });
    }
  },
}));
