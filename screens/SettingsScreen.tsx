import React, { useState, useEffect } from 'react';
import { StyleSheet, Switch, TouchableOpacity, ScrollView, View as RNView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { getStreakStats, getLocalDateString } from '../services/streak';
import { checkMicrophonePermission, requestMicrophonePermission } from '../services/permissions';
import { resetSRSDatabase, getDueCount } from '../services/srs';
import { resetCurriculumProgress, getOverallCurriculumProgress } from '../services/curriculum';

function getPast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'narrow' });
    days.push({ dateStr, dayLabel });
  }
  return days;
}

export default function SettingsScreen() {
  const isFocused = useIsFocused();
  const [streak, setStreak] = useState(0);
  const [activityDates, setActivityDates] = useState<string[]>([]);
  const [totalLearned, setTotalLearned] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);
  const [quizzesTaken, setQuizzesTaken] = useState(0);
  const [quizHighScore, setQuizHighScore] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [mapProgressPercent, setMapProgressPercent] = useState(0);
  const [srsDueCount, setSrsDueCount] = useState(0);

  const [notifications, setNotifications] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [microphoneGranted, setMicrophoneGranted] = useState(false);

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');

  useEffect(() => {
    if (isFocused) {
      loadStats();
    }
  }, [isFocused]);

  const loadStats = async () => {
    try {
      const stats = await getStreakStats();
      setStreak(stats.currentStreak);
      setActivityDates(stats.activityDates);

      const learned = await AsyncStorage.getItem('@odia_agent:learned_phrases');
      if (learned) {
        setTotalLearned(JSON.parse(learned).length);
      } else {
        setTotalLearned(0);
      }

      const saved = await AsyncStorage.getItem('@odia_agent:saved_translations');
      if (saved) {
        setTotalSaved(JSON.parse(saved).length);
      } else {
        setTotalSaved(0);
      }

      const quizStats = await AsyncStorage.getItem('@odia_agent:quiz_stats');
      if (quizStats) {
        const parsed = JSON.parse(quizStats);
        setQuizzesTaken(parsed.totalQuizzes || 0);
        setQuizHighScore(parsed.highScore || 0);
      } else {
        setQuizzesTaken(0);
        setQuizHighScore(0);
      }

      // Load XP
      const storedXp = await AsyncStorage.getItem('@odia_agent:total_xp');
      setTotalXp(storedXp ? parseInt(storedXp) : 0);

      // Load curriculum map progress
      const curriculumProgress = await getOverallCurriculumProgress();
      setMapProgressPercent(curriculumProgress.progressPercent);

      // Load SRS due count
      const dueCount = await getDueCount();
      setSrsDueCount(dueCount);

      const micStatus = await checkMicrophonePermission();
      setMicrophoneGranted(micStatus.granted);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRequestMicrophone = async () => {
    const status = await requestMicrophonePermission();
    setMicrophoneGranted(status.granted);
    if (!status.granted) {
      alert('Microphone permission is required to enable voice recording. Please enable it in your device settings.');
    }
  };

  const handleResetStats = async () => {
    try {
      await AsyncStorage.removeItem('@odia_agent:last_active_date');
      await AsyncStorage.removeItem('@odia_agent:streak_count');
      await AsyncStorage.removeItem('@odia_agent:activity_dates');
      await AsyncStorage.removeItem('@odia_agent:learned_phrases');
      await AsyncStorage.removeItem('@odia_agent:saved_translations');
      await AsyncStorage.removeItem('@odia_agent:quiz_stats');
      await AsyncStorage.removeItem('@odia_agent:onboarding_completed');
      await AsyncStorage.removeItem('@odia_agent:total_xp');
      // Reset SRS spaced repetition intervals too
      await resetSRSDatabase();
      // Reset Curriculum progress too
      await resetCurriculumProgress();
      alert('All progress and study settings have been reset!');
      loadStats();
    } catch (e) {
      console.error(e);
    }
  };

  const renderSettingRow = (
    title: string,
    description: string,
    value: boolean,
    onValueChange: (val: boolean) => void
  ) => (
    <RNView style={[styles.row, { borderBottomColor: borderCol }]}>
      <RNView style={styles.textContainer}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{description}</Text>
      </RNView>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D1D5DB', true: tintCol + '80' }}
        thumbColor={value ? tintCol : '#F3F4F6'}
      />
    </RNView>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Progress & Stats Section */}
      <RNView style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Progress</Text>
      </RNView>

      <RNView style={[styles.card, { backgroundColor: cardCol, borderColor: borderCol, padding: 16 }]}>
        <RNView style={styles.statsRow}>
          <RNView style={styles.statBox}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </RNView>

          <RNView style={styles.statBox}>
            <Text style={styles.statEmoji}>🗂</Text>
            <Text style={styles.statValue}>{totalLearned}</Text>
            <Text style={styles.statLabel}>Phrases Learned</Text>
          </RNView>

          <RNView style={styles.statBox}>
            <Text style={styles.statEmoji}>⭐</Text>
            <Text style={styles.statValue}>{totalSaved}</Text>
            <Text style={styles.statLabel}>Saved Transl.</Text>
          </RNView>
        </RNView>

        <RNView style={[styles.statsRow, { marginTop: Theme.spacing.md, paddingTop: Theme.spacing.md, borderTopWidth: 0.5, borderTopColor: borderCol }]}>
          <RNView style={styles.statBox}>
            <Text style={styles.statEmoji}>📝</Text>
            <Text style={styles.statValue}>{quizzesTaken}</Text>
            <Text style={styles.statLabel}>Quizzes Taken</Text>
          </RNView>

          <RNView style={styles.statBox}>
            <Text style={styles.statEmoji}>🏆</Text>
            <Text style={styles.statValue}>{quizHighScore} / 10</Text>
            <Text style={styles.statLabel}>High Score</Text>
          </RNView>

          <RNView style={styles.statBox}>
            {/* Keeping it balanced with 3 columns per row */}
            <Text style={styles.statEmoji}>🎯</Text>
            <Text style={styles.statValue}>
              {quizzesTaken > 0 ? Math.round((quizHighScore / 10) * 100) : 0}%
            </Text>
            <Text style={styles.statLabel}>Max Accuracy</Text>
          </RNView>
        </RNView>

        <RNView style={[styles.statsRow, { marginTop: Theme.spacing.md, paddingTop: Theme.spacing.md, borderTopWidth: 0.5, borderTopColor: borderCol }]}>
          <RNView style={styles.statBox}>
            <Text style={styles.statEmoji}>👑</Text>
            <Text style={styles.statValue}>{totalXp}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </RNView>

          <RNView style={styles.statBox}>
            <Text style={styles.statEmoji}>🗺️</Text>
            <Text style={styles.statValue}>{mapProgressPercent}%</Text>
            <Text style={styles.statLabel}>Map Progress</Text>
          </RNView>

          <RNView style={styles.statBox}>
            <Text style={styles.statEmoji}>📚</Text>
            <Text style={styles.statValue}>{srsDueCount}</Text>
            <Text style={styles.statLabel}>SRS Due Today</Text>
          </RNView>
        </RNView>

        {/* Heatmap Grid */}
        <Text style={styles.heatmapTitle}>Activity Heatmap (Past 7 Days)</Text>
        <RNView style={styles.heatmapGrid}>
          {getPast7Days().map((day) => {
            const isActive = activityDates.includes(day.dateStr);
            return (
              <RNView key={day.dateStr} style={styles.heatmapDay}>
                <RNView
                  style={[
                    styles.heatmapSquare,
                    { borderColor: borderCol },
                    isActive && { backgroundColor: tintCol, borderColor: tintCol },
                  ]}
                />
                <Text style={styles.heatmapDayLabel}>{day.dayLabel}</Text>
              </RNView>
            );
          })}
        </RNView>
      </RNView>

      {/* Preferences Section */}
      <RNView style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Preferences</Text>
      </RNView>

      <RNView style={[styles.card, { backgroundColor: cardCol, borderColor: borderCol }]}>
        {renderSettingRow(
          'Push Notifications',
          'Get notified about new Odia heritage topics and insights.',
          notifications,
          setNotifications
        )}
        {renderSettingRow(
          'Offline Mode',
          'Cache articles locally to read them without internet.',
          offlineMode,
          setOfflineMode
        )}
      </RNView>

      {/* Permissions Section */}
      <RNView style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Permissions</Text>
      </RNView>

      <RNView style={[styles.card, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={styles.row}>
          <RNView style={styles.textContainer}>
            <Text style={styles.rowTitle}>Microphone Access</Text>
            <Text style={styles.rowDesc}>Required for voice-based translation features.</Text>
          </RNView>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.permissionButton,
              {
                backgroundColor: microphoneGranted ? '#E6F4EA' : tintCol + '15',
                borderColor: microphoneGranted ? '#10B981' : tintCol,
              },
            ]}
            onPress={handleRequestMicrophone}
            disabled={microphoneGranted}
          >
            <Text style={[styles.permissionButtonText, { color: microphoneGranted ? '#137333' : tintCol }]}>
              {microphoneGranted ? 'Granted ✓' : 'Grant'}
            </Text>
          </TouchableOpacity>
        </RNView>
      </RNView>

      {/* About App Section */}
      <RNView style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>About App</Text>
      </RNView>

      <RNView style={[styles.card, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={[styles.row, { borderBottomColor: borderCol }]}>
          <RNView style={styles.textContainer}>
            <Text style={styles.rowTitle}>Version</Text>
            <Text style={styles.rowDesc}>Application build version</Text>
          </RNView>
          <Text style={styles.valueText}>1.0.0 (Expo SDK 56)</Text>
        </RNView>
        <RNView style={styles.row}>
          <RNView style={styles.textContainer}>
            <Text style={styles.rowTitle}>Developer</Text>
            <Text style={styles.rowDesc}>Designed & Developed by</Text>
          </RNView>
          <Text style={[styles.valueText, { color: tintCol }]}>Antigravity AI</Text>
        </RNView>
      </RNView>

      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.resetButton, { borderColor: tintCol }]}
        onPress={handleResetStats}
      >
        <Text style={[styles.resetButtonText, { color: tintCol }]}>Reset all progress</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Theme.spacing.lg,
  },
  sectionHeader: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xs,
    marginBottom: Theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.bold,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  card: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: Theme.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.lg,
    borderBottomWidth: 1,
  },
  textContainer: {
    flex: 1,
    paddingRight: Theme.spacing.lg,
  },
  rowTitle: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.semibold,
    marginBottom: Theme.spacing.xs,
  },
  rowDesc: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#6B7280',
    lineHeight: Theme.typography.lineHeight.xs,
  },
  valueText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.medium,
    color: '#4B5563',
  },
  resetButton: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.sm,
    backgroundColor: 'transparent',
  },
  resetButtonText: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.lg,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: Theme.spacing.xs,
  },
  statValue: {
    fontSize: Theme.typography.fontSize.lg,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  heatmapTitle: {
    fontSize: Theme.typography.fontSize.xs - 1,
    fontWeight: Theme.typography.fontWeight.semibold,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    paddingTop: Theme.spacing.md,
  },
  heatmapGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  heatmapDay: {
    alignItems: 'center',
  },
  heatmapSquare: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.xs + 2,
    marginBottom: Theme.spacing.xs,
  },
  heatmapDayLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  permissionButton: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.sm,
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.bold,
  },
});
