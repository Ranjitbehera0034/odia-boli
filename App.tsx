import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './navigation/AppNavigator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initLeagueDatabase } from './services/league';
import { initAppDatabase } from './services/db';
import { useUserStore } from './stores/useUserStore';
import { useLessonStore } from './stores/useLessonStore';
import { useProgressStore } from './stores/useProgressStore';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(console.warn);

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize SQLite databases
        await initAppDatabase();
        await initLeagueDatabase();

        // Load Zustand stores
        await useUserStore.getState().loadUser();
        await useLessonStore.getState().loadLessons();
        await useProgressStore.getState().loadProgress();

        // Check hearts regeneration on startup
        await useUserStore.getState().checkRefill();

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
    <SafeAreaProvider>
      <ErrorBoundary>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <AppNavigator showOnboarding={showOnboarding} />
        </View>
      </ErrorBoundary>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
