import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Initialize and export the global Supabase client instance
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Prevents issues in mobile browser authentication redirects
  },
});
