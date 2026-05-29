import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLocalProgressToCloud } from '../services/authMigration';
import { Linking } from 'react-native';

interface AuthState {
  session: Session | null;
  user: User | null;
  isGuest: boolean;
  loading: boolean;
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  setGuestMode: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isGuest: false,
  loading: true,

  initialize: async () => {
    try {
      const guestFlag = await AsyncStorage.getItem('@odia_agent:is_guest');
      const { data: { session } } = await supabase.auth.getSession();
      
      set({
        session,
        user: session?.user ?? null,
        isGuest: guestFlag === 'true',
        loading: false,
      });

      // Listen for auth state changes globally
      supabase.auth.onAuthStateChange(async (event, currentSession) => {
        const wasUnauthenticated = !get().session && currentSession;
        
        set({
          session: currentSession,
          user: currentSession?.user ?? null,
          isGuest: currentSession ? false : get().isGuest,
        });

        // Trigger migration if user just signed in and was previously a guest
        if (wasUnauthenticated && currentSession?.user) {
          const isPreviouslyGuest = await AsyncStorage.getItem('@odia_agent:is_guest') === 'true';
          if (isPreviouslyGuest) {
            try {
              await migrateLocalProgressToCloud(currentSession.user.id);
            } catch (err) {
              console.error('Error migrating progress:', err);
            } finally {
              await AsyncStorage.removeItem('@odia_agent:is_guest');
              set({ isGuest: false });
            }
          }
        }

        if (currentSession) {
          import('./useSyncStore').then((m) => m.useSyncStore.getState().sync().catch(console.error));
        }
      });

      // Listen for deep links (e.g. email confirmation redirect)
      const handleUrl = async (url: string | null) => {
        if (!url) return;
        try {
          let params: Record<string, string> = {};
          if (url.includes('#')) {
            const hashStr = url.split('#')[1];
            params = Object.fromEntries(new URLSearchParams(hashStr));
          } else if (url.includes('?')) {
            const queryStr = url.split('?')[1];
            params = Object.fromEntries(new URLSearchParams(queryStr));
          }
          
          const accessToken = params.access_token || params.token;
          const refreshToken = params.refresh_token;
          const code = params.code;
          
          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
            if (data?.session) {
              set({ session: data.session, user: data.session.user, isGuest: false });
            }
          } else if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
            if (data?.session) {
              set({ session: data.session, user: data.session.user, isGuest: false });
            }
          }
        } catch (err) {
          console.error('Failed to parse deep link URL:', err);
        }
      };

      Linking.getInitialURL().then(handleUrl);
      Linking.addEventListener('url', (event) => handleUrl(event.url));
    } catch (e) {
      console.error('Failed to initialize auth store:', e);
      set({ loading: false });
    }
  },

  signUp: async (email, password, username) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    set({ loading: false });
    if (error) {
      return { error };
    }
    return { error: null };
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    set({ loading: false });
    if (error) {
      return { error };
    }
    return { error: null };
  },

  setGuestMode: async () => {
    await AsyncStorage.setItem('@odia_agent:is_guest', 'true');
    set({ isGuest: true, session: null, user: null });
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    await AsyncStorage.removeItem('@odia_agent:is_guest');
    set({ session: null, user: null, isGuest: false, loading: false });
  },
}));
