import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * Custom storage adapter for Supabase client that uses expo-secure-store.
 * Mitigates Android's 2048-byte limit by chunking strings longer than 2000 characters.
 */
class LargeSecureStoreAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`);
      if (!chunkCountStr) {
        // Fallback to reading the single key if no chunks metadata exists
        return await SecureStore.getItemAsync(key);
      }
      
      const chunkCount = parseInt(chunkCountStr, 10);
      let merged = '';
      for (let i = 0; i < chunkCount; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (!chunk) return null;
        merged += chunk;
      }
      return merged;
    } catch (e) {
      console.error('Failed to get secure item:', e);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      // First clean up any pre-existing keys and chunks to prevent leaks
      await this.removeItem(key);

      const chunkSize = 2000; // Stay safely below Android's 2048-byte key value limit
      if (value.length <= chunkSize) {
        await SecureStore.setItemAsync(key, value);
        return;
      }

      const chunkCount = Math.ceil(value.length / chunkSize);
      await SecureStore.setItemAsync(`${key}_chunks`, String(chunkCount));
      
      for (let i = 0; i < chunkCount; i++) {
        const start = i * chunkSize;
        const chunk = value.slice(start, start + chunkSize);
        await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
      }
    } catch (e) {
      console.error('Failed to set secure item:', e);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
      const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunkCountStr) {
        const chunkCount = parseInt(chunkCountStr, 10);
        await SecureStore.deleteItemAsync(`${key}_chunks`);
        for (let i = 0; i < chunkCount; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        }
      }
    } catch (e) {
      console.error('Failed to remove secure item:', e);
    }
  }
}

const secureStoreAdapter = new LargeSecureStoreAdapter();

// Retrieve credentials injected via app.config.js from environment variables
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing: URL or Anon Key was not found in Expo Constants. ' +
    'Make sure to set the SUPABASE_URL and SUPABASE_ANON_KEY environment variables ' +
    'before launching the development server.'
  );
}

// Initialize and export the global Supabase client instance using our secure store adapter
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Prevents issues in mobile browser authentication redirects
  },
});
