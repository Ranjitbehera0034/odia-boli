import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';
import AppNavigator from './navigation/AppNavigator';
import GlobalCelebrationOverlay from './components/GlobalCelebrationOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initLeagueDatabase } from './services/league';
import { initAppDatabase } from './services/db';
import { useUserStore } from './stores/useUserStore';
import { useLessonStore } from './stores/useLessonStore';
import { useProgressStore } from './stores/useProgressStore';
import { useAuthStore } from './stores/useAuthStore';
import { useSyncStore } from './stores/useSyncStore';
import { queryClient } from './services/queryClient';
import { initAnalytics, identifyUser } from './services/analytics';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(console.warn);

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize crash reporting + product analytics
        await initAnalytics();

        // Initialize SQLite databases
        await initAppDatabase();
        await initLeagueDatabase();

        // Initialize auth store (restores session / guest flag)
        await useAuthStore.getState().initialize();

        // Initialize sync store (registers NetInfo listeners and syncs)
        useSyncStore.getState().initialize();

        // Load Zustand stores
        await useUserStore.getState().loadUser();
        await useLessonStore.getState().loadLessons();
        await useProgressStore.getState().loadProgress();

        // Check hearts regeneration on startup
        await useUserStore.getState().checkRefill();

        // Identify the user in analytics if logged in
        const { supabase } = await import('./services/supabase');
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { username, email } = useUserStore.getState();
          await identifyUser(session.user.id, { username, email });
        }

        // Fetch onboarding flag from the store
        const onboardingCompleted = useUserStore.getState().onboardingCompleted;
        setShowOnboarding(!onboardingCompleted);

        // Pre-load assets and display cultural splash screen motifs
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
            <AppNavigator />
            <GlobalCelebrationOverlay />
          </View>
        </ErrorBoundary>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

