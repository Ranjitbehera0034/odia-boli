import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
  RefreshControl,
  View as RNView,
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useUserStore } from '../stores/useUserStore';
import { useAuthStore } from '../stores/useAuthStore';
import { getStreakClubLeaderboard, StreakLeaderboardEntry } from '../services/streakSociety';
import { useIsFocused } from '@react-navigation/native';

const { width } = Dimensions.get('window');

interface ClubCard {
  milestone: number;
  title: string;
  emoji: string;
  badgeId: string;
  color: string;
  badgeColor: string;
  motto: string;
}

const CLUBS: ClubCard[] = [
  {
    milestone: 7,
    title: 'Beginner',
    emoji: '🏃',
    badgeId: 'streak_club_7',
    color: '#3B82F6',
    badgeColor: 'rgba(59, 130, 246, 0.15)',
    motto: 'Starting the Habit',
  },
  {
    milestone: 30,
    title: 'Committed',
    emoji: '🧗',
    badgeId: 'streak_club_30',
    color: '#10B981',
    badgeColor: 'rgba(16, 185, 129, 0.15)',
    motto: 'Power of Daily Action',
  },
  {
    milestone: 100,
    title: 'Dedicated',
    emoji: '🛡️',
    badgeId: 'streak_club_100',
    color: '#8B5CF6',
    badgeColor: 'rgba(139, 92, 246, 0.15)',
    motto: 'Unstoppable Momentum',
  },
  {
    milestone: 365,
    title: 'Legend',
    emoji: '👑',
    badgeId: 'streak_club_365',
    color: '#F59E0B',
    badgeColor: 'rgba(245, 158, 11, 0.15)',
    motto: 'A Year of Daily Devotion',
  },
];

export default function StreakSocietyScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const session = useAuthStore((state) => state.session);
  const isGuest = useAuthStore((state) => state.isGuest);
  const userId = session?.user?.id;

  const currentStreak = useUserStore((state) => state.streak);
  const longestStreak = useUserStore((state) => state.longestStreak);
  const badges = useUserStore((state) => state.badges);
  const username = useUserStore((state) => state.username);
  const triggerCelebration = useUserStore((state) => state.setCelebrationMilestone);

  const [selectedMilestone, setSelectedMilestone] = useState<number>(7);
  const [leaderboard, setLeaderboard] = useState<StreakLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Theme colors
  const backgroundCol = useThemeColor({}, 'background');
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');
  const textMutedCol = useThemeColor({}, 'textMuted');

  const loadLeaderboard = useCallback(
    async (isRefresh = false) => {
      if (!userId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await getStreakClubLeaderboard(
          userId,
          selectedMilestone,
          currentStreak,
          longestStreak,
          username
        );
        setLeaderboard(data);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, selectedMilestone, currentStreak, longestStreak, username]
  );

  useEffect(() => {
    if (isFocused && userId) {
      loadLeaderboard();
    }
  }, [isFocused, selectedMilestone, userId]);

  // GUEST STATE LOCK
  if (isGuest || !userId) {
    return (
      <View style={[styles.guestContainer, { backgroundColor: backgroundCol }]}>
        <RNView style={[styles.guestCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.guestIcon}>🏪</Text>
          <Text style={styles.guestTitle}>Welcome to the Streak Society</Text>
          <Text style={[styles.guestDesc, { color: textMutedCol }]}>
            The Streak Society is an exclusive club for learners who maintain active streaks of 7, 30, 100, or 365 days. Register or log in to track your streak, earn premium badges, and view private club leaderboards!
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Signup')}
            style={[styles.primaryButton, { backgroundColor: tintCol }]}
          >
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Login')}
            style={[styles.secondaryButton, { borderColor: borderCol }]}
          >
            <Text style={[styles.secondaryButtonText, { color: tintCol }]}>Log In</Text>
          </TouchableOpacity>
        </RNView>
      </View>
    );
  }

  const selectedClub = CLUBS.find((c) => c.milestone === selectedMilestone)!;
  const isClubUnlocked = longestStreak >= selectedClub.milestone || badges.includes(selectedClub.badgeId);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: backgroundCol }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadLeaderboard(true)} tintColor={tintCol} />
      }
    >
      {/* ─── STREAK STATUS BANNER ─── */}
      <RNView style={[styles.statusCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={styles.statusRow}>
          <RNView style={styles.statusColumn}>
            <Text style={[styles.statusLabel, { color: textMutedCol }]}>Current Streak</Text>
            <Text style={[styles.statusValue, { color: '#EF4444' }]}>🔥 {currentStreak} Days</Text>
          </RNView>
          <RNView style={styles.statusDivider} />
          <RNView style={styles.statusColumn}>
            <Text style={[styles.statusLabel, { color: textMutedCol }]}>Personal Record</Text>
            <Text style={[styles.statusValue, { color: '#FBBF24' }]}>👑 {longestStreak} Days</Text>
          </RNView>
        </RNView>
      </RNView>

      <Text style={styles.sectionHeading}>Streak Society Clubs</Text>

      {/* ─── HORIZONTAL CLUBS CAROUSEL ─── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContainer}
      >
        {CLUBS.map((club) => {
          const unlocked = longestStreak >= club.milestone || badges.includes(club.badgeId);
          const isSelected = selectedMilestone === club.milestone;

          return (
            <TouchableOpacity
              key={club.milestone}
              activeOpacity={0.9}
              onPress={() => setSelectedMilestone(club.milestone)}
              style={[
                styles.clubCard,
                {
                  backgroundColor: cardCol,
                  borderColor: isSelected ? club.color : borderCol,
                  borderWidth: isSelected ? 2 : 1,
                  shadowColor: isSelected ? club.color : '#000',
                  shadowOpacity: isSelected ? 0.15 : 0.04,
                },
              ]}
            >
              {/* Unlocked / Locked visual indicator */}
              {!unlocked && (
                <RNView style={styles.lockOverlay}>
                  <Text style={styles.lockIcon}>🔒</Text>
                  <Text style={styles.lockDaysText}>Requires {club.milestone}d</Text>
                </RNView>
              )}

              <RNView style={[styles.clubBadgeBg, { backgroundColor: club.badgeColor }]}>
                <Text style={styles.clubBadgeEmoji}>{club.emoji}</Text>
              </RNView>
              <Text style={styles.clubCardTitle}>{club.title} Club</Text>
              <Text style={[styles.clubCardMotto, { color: textMutedCol }]}>{club.motto}</Text>

              {unlocked && (
                <RNView style={[styles.unlockedPill, { backgroundColor: club.color + '20' }]}>
                  <Text style={[styles.unlockedPillText, { color: club.color }]}>Joined</Text>
                </RNView>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ─── SELECTED CLUB OVERVIEW ─── */}
      <RNView style={[styles.detailsCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={styles.detailsHeader}>
          <Text style={styles.detailsEmoji}>{selectedClub.emoji}</Text>
          <RNView style={styles.detailsTitleCol}>
            <Text style={styles.detailsClubTitle}>{selectedClub.title} Streak Society</Text>
            <Text style={[styles.detailsClubSub, { color: textMutedCol }]}>
              Entry Requirement: {selectedClub.milestone} Days Streak
            </Text>
          </RNView>
        </RNView>

        <Text style={[styles.detailsDesc, { color: textCol }]}>
          {isClubUnlocked
            ? `Congratulations! You have unlocked entry to the exclusive ${selectedClub.title} Club. You qualify for the private leaderboard standings and are recognized as a dedicated learner.`
            : `Keep practicing daily to reach a ${selectedClub.milestone}-day streak. Once reached, you will unlock this club's exclusive profile badge, celebrate with a cinematic splash, and join the private leaderboard!`}
        </Text>

        {isClubUnlocked && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => triggerCelebration(selectedClub.milestone as any)}
            style={[styles.celebrateButton, { backgroundColor: selectedClub.color }]}
          >
            <Text style={styles.celebrateButtonText}>Replay Cinematic Celebration 🎬</Text>
          </TouchableOpacity>
        )}
      </RNView>

      {/* ─── PRIVATE LEADERBOARD SECTION ─── */}
      <Text style={styles.sectionHeading}>🏆 Private Leaderboard ({selectedClub.title} Club)</Text>

      {loading ? (
        <RNView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={selectedClub.color} />
          <Text style={[styles.loadingText, { color: textMutedCol }]}>
            Loading club members...
          </Text>
        </RNView>
      ) : (
        <RNView style={styles.leaderboardContainer}>
          {leaderboard.length === 0 ? (
            <RNView style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={[styles.emptyText, { color: textMutedCol }]}>
                No users have unlocked this club level yet. Be the first!
              </Text>
            </RNView>
          ) : (
            leaderboard.map((entry, index) => {
              const isFirst = entry.rank === 1;
              const isSecond = entry.rank === 2;
              const isThird = entry.rank === 3;

              const rankIcon = isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : `#${entry.rank}`;

              return (
                <Animated.View
                  key={entry.id}
                  entering={FadeInDown.delay(index * 30).duration(200)}
                  layout={Layout.springify()}
                >
                  <RNView
                    style={[
                      styles.row,
                      {
                        backgroundColor: entry.isUser ? selectedClub.color + '12' : cardCol,
                        borderColor: entry.isUser ? selectedClub.color + '60' : borderCol,
                        borderWidth: entry.isUser ? 1.5 : 1,
                      },
                    ]}
                  >
                    {/* Rank */}
                    <RNView style={styles.rankCol}>
                      <Text style={[styles.rankText, (isFirst || isSecond || isThird) && styles.topRankText]}>
                        {rankIcon}
                      </Text>
                    </RNView>

                    {/* Avatar */}
                    {entry.avatarUrl ? (
                      <Image source={{ uri: entry.avatarUrl }} style={styles.avatarImage} />
                    ) : (
                      <RNView
                        style={[
                          styles.avatarPlaceholder,
                          { backgroundColor: entry.isUser ? selectedClub.color + '25' : borderCol },
                        ]}
                      >
                        <Text style={[styles.avatarText, { color: entry.isUser ? selectedClub.color : textCol }]}>
                          {entry.username.charAt(0).toUpperCase()}
                        </Text>
                      </RNView>
                    )}

                    {/* User Profile Info */}
                    <RNView style={styles.userCol}>
                      <Text
                        style={[
                          styles.username,
                          { color: textCol },
                          entry.isUser && { color: selectedClub.color, fontWeight: '800' },
                        ]}
                      >
                        {entry.username} {entry.isUser ? ' (You)' : ''}
                      </Text>
                      <Text style={[styles.longestStreakLabel, { color: textMutedCol }]}>
                        Longest Streak: {entry.longestStreak} days
                      </Text>
                    </RNView>

                    {/* Streak Count */}
                    <RNView style={styles.streakCol}>
                      <Text style={[styles.streakVal, { color: '#EF4444' }]}>🔥 {entry.currentStreak}</Text>
                      <Text style={[styles.streakLabel, { color: textMutedCol }]}>streak</Text>
                    </RNView>
                  </RNView>
                </Animated.View>
              );
            })
          )}
        </RNView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Theme.spacing.lg,
    paddingBottom: 40,
  },
  statusCard: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  statusColumn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  statusDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#374151',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
  },
  // Carousel selector
  carouselContainer: {
    paddingBottom: 8,
    gap: 12,
    marginBottom: Theme.spacing.lg,
  },
  clubCard: {
    width: 135,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  clubBadgeBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  clubBadgeEmoji: {
    fontSize: 28,
  },
  clubCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  clubCardMotto: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    height: 24,
  },
  unlockedPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
  },
  unlockedPillText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  lockIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  lockDaysText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  // Details Card
  detailsCard: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 12,
    gap: 12,
  },
  detailsEmoji: {
    fontSize: 32,
  },
  detailsTitleCol: {
    backgroundColor: 'transparent',
  },
  detailsClubTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  detailsClubSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  detailsDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  celebrateButton: {
    marginTop: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  // Leaderboards
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  leaderboardContainer: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.borderRadius.lg,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rankCol: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  topRankText: {
    fontSize: 18,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  userCol: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  username: {
    fontSize: 13,
    fontWeight: '700',
  },
  longestStreakLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  streakCol: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  streakVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  streakLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Guest state
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  guestCard: {
    width: '100%',
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.xl,
    alignItems: 'center',
  },
  guestIcon: {
    fontSize: 60,
    marginBottom: Theme.spacing.lg,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  guestDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Theme.spacing.xl,
    paddingHorizontal: 10,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
