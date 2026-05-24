import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HistoryEntry {
  id: string;
  odia: string;
  english: string;
  timestamp: number;
}

const HISTORY_KEY = '@odia_agent:translation_history';

/**
 * Adds a translation record into AsyncStorage history.
 */
export async function addTranslationToHistory(odia: string, english: string): Promise<void> {
  try {
    const oTrimmed = odia.trim();
    const eTrimmed = english.trim();
    if (!oTrimmed || !eTrimmed) return;

    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    let history: HistoryEntry[] = stored ? JSON.parse(stored) : [];

    // Remove duplicates to keep it clean (if they translate the same thing, move it to the top)
    history = history.filter(item => item.odia.trim() !== oTrimmed || item.english.trim() !== eTrimmed);

    const newEntry: HistoryEntry = {
      id: Math.random().toString(36).substring(2, 9),
      odia: oTrimmed,
      english: eTrimmed,
      timestamp: Date.now(),
    };

    history.unshift(newEntry);

    // Cap history at 100 entries to keep it performant
    if (history.length > 100) {
      history = history.slice(0, 100);
    }

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Error adding translation to history:', e);
  }
}

/**
 * Gets all history entries in reverse chronological order.
 */
export async function getTranslationHistory(): Promise<HistoryEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    const history: HistoryEntry[] = JSON.parse(stored);
    return history.sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.error('Error reading translation history:', e);
    return [];
  }
}

/**
 * Removes a single history entry by ID.
 */
export async function deleteHistoryItem(id: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    if (!stored) return;
    let history: HistoryEntry[] = JSON.parse(stored);
    history = history.filter(item => item.id !== id);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Error deleting history item:', e);
  }
}

/**
 * Clears the entire history logs.
 */
export async function clearAllHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.error('Error clearing history:', e);
  }
}
