import AsyncStorage from '@react-native-async-storage/async-storage';
import { TranslationResult } from './gemini';

export interface CacheEntry {
  odia: string;
  result: TranslationResult;
  timestamp: number;
}

const CACHE_KEY = '@odia_agent:translation_cache';
const MAX_CACHE_SIZE = 50;

/**
 * Normalizes input text for cache lookup/saving: trims whitespace and lowercases it.
 */
function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Saves a translation result to the cache. Keeps the cache limited to 50 items.
 */
export async function saveTranslationToCache(odiaText: string, result: TranslationResult): Promise<void> {
  try {
    const normalized = normalizeText(odiaText);
    if (!normalized) return;

    const stored = await AsyncStorage.getItem(CACHE_KEY);
    let cache: CacheEntry[] = stored ? JSON.parse(stored) : [];

    // Remove existing entry for this text if it exists (so we can move it to the front/update timestamp)
    cache = cache.filter(entry => normalizeText(entry.odia) !== normalized);

    // Add new entry to the beginning of the list
    const newEntry: CacheEntry = {
      odia: odiaText.trim(),
      result,
      timestamp: Date.now(),
    };

    cache.unshift(newEntry);

    // Enforce max cache size (keep the 50 most recent items)
    if (cache.length > MAX_CACHE_SIZE) {
      cache = cache.slice(0, MAX_CACHE_SIZE);
    }

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Error saving translation to cache:', e);
  }
}

/**
 * Retrieves a translation result from the cache.
 */
export async function getTranslationFromCache(odiaText: string): Promise<TranslationResult | null> {
  try {
    const normalized = normalizeText(odiaText);
    if (!normalized) return null;

    const stored = await AsyncStorage.getItem(CACHE_KEY);
    if (!stored) return null;

    const cache: CacheEntry[] = JSON.parse(stored);
    const entry = cache.find(e => normalizeText(e.odia) === normalized);

    return entry ? entry.result : null;
  } catch (e) {
    console.error('Error getting translation from cache:', e);
    return null;
  }
}

/**
 * Returns the list of all cached translations.
 */
export async function getCachedTranslations(): Promise<CacheEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Error getting cached translations:', e);
    return [];
  }
}
