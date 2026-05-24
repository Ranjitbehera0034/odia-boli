import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './navigation/AppNavigator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSRSDatabase } from './services/srs';
import { initCurriculumDatabase } from './services/curriculum';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(console.warn);

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize SQLite databases
        await initSRSDatabase();
        await initCurriculumDatabase();

        // Fetch onboarding flag
        const onboardingCompleted = await AsyncStorage.getItem('@odia_agent:onboarding_completed');
        setShowOnboarding(onboardingCompleted !== 'true');

        // Pre-load assets, initialize services, and hold splash screen for 1.5s to display the cultural motifs
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Hide the splash screen immediately when the root view is rendered
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
