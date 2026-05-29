import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type MainTabParamList = {
  Home: undefined;
  Translate: undefined;
  Practice: undefined;
  League: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Details: { itemId: string };
  Flashcard: undefined;
  Quiz: undefined;
  History: undefined;
  Onboarding: undefined;
  Curriculum: undefined;
  Lesson: { lessonId: string };
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  EmailVerify: { email: string };
  Settings: undefined;
  AiChat: undefined;
  PronunciationCoach: undefined;
  Friends: undefined;
  Challenge: { challengeId: string };
  MyProgress: undefined;
  StreakSociety: undefined;
};



export type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type TranslateScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Translate'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type PracticeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Practice'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type LeagueScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'League'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type SettingsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Settings'
>;

export type ProfileScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type DetailsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Details'
>;

export type FriendsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Friends'
>;

export type ChallengeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Challenge'
>;


