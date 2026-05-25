import React from 'react';
import { useColorScheme, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DefaultTheme, DarkTheme, NavigationContainer } from '@react-navigation/native';

import Theme from '../constants/Theme';
import { useThemeColor } from '../hooks/useThemeColor';
import HomeScreen from '../screens/HomeScreen';
import TranslateScreen from '../screens/TranslateScreen';
import PracticeScreen from '../screens/PracticeScreen';
import LeagueScreen from '../screens/LeagueScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DetailsScreen from '../screens/DetailsScreen';
import FlashcardScreen from '../screens/FlashcardScreen';
import QuizScreen from '../screens/QuizScreen';
import HistoryScreen from '../screens/HistoryScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import CurriculumScreen from '../screens/CurriculumScreen';
import LessonScreen from '../screens/LessonScreen';
import { MainTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  const activeColor = useThemeColor({}, 'tint');
  const inactiveColor = useThemeColor({}, 'icon');
  const insets = useSafeAreaInsets();

  // Add system nav bar inset so tab bar clears the Android gesture/button bar
  const TAB_BAR_INNER_HEIGHT = 52;
  const tabBarHeight = TAB_BAR_INNER_HEIGHT + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          borderTopWidth: 1,
          elevation: 8,
          shadowOpacity: 0.1,
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Translate"
        component={TranslateScreen}
        options={({ navigation }) => ({
          title: 'Translate',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🗣️</Text>,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('History')}
              style={{ marginRight: 16, padding: 4 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20 }}>📜</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <Tab.Screen
        name="Practice"
        component={PracticeScreen}
        options={{
          title: 'Practice',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📖</Text>,
        }}
      />
      <Tab.Screen
        name="League"
        component={LeagueScreen}
        options={{
          title: 'League',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏆</Text>,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator({ showOnboarding }: { showOnboarding: boolean }) {
  const scheme = useColorScheme();
  const tintCol = useThemeColor({}, 'tint');

  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: Theme.colors.light.tint,
      background: Theme.colors.light.background,
      card: Theme.colors.light.card,
      text: Theme.colors.light.text,
      border: Theme.colors.light.border,
    },
  };

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: Theme.colors.dark.tint,
      background: Theme.colors.dark.background,
      card: Theme.colors.dark.card,
      text: Theme.colors.dark.text,
      border: Theme.colors.dark.border,
    },
  };

  return (
    <NavigationContainer theme={scheme === 'dark' ? customDarkTheme : customLightTheme}>
      <Stack.Navigator
        initialRouteName={showOnboarding ? 'Onboarding' : 'MainTabs'}
        screenOptions={{
          headerTitleStyle: {
            fontWeight: '700',
          },
          headerTintColor: tintCol,
        }}
      >
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MainTabs"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Details"
          component={DetailsScreen}
          options={{ title: 'Details', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="Flashcard"
          component={FlashcardScreen}
          options={{ title: 'Study Cards', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="Quiz"
          component={QuizScreen}
          options={{ title: 'Quiz Challenge', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ title: 'Translation History', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="Curriculum"
          component={CurriculumScreen}
          options={{ title: 'Learning Path', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="Lesson"
          component={LessonScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
