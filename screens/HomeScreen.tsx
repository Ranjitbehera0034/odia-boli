import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, View as RNView, Modal, Animated, Alert } from 'react-native';
import { Text, View } from '../components/Themed';
import { fetchOdiaItems, OdiaItem } from '../services/api';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { HomeScreenNavigationProp } from '../navigation/types';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useUserStore } from '../stores/useUserStore';
import { useProgressStore } from '../stores/useProgressStore';
import StreakBadge from '../components/StreakBadge';
import PeacockMascot, { MascotState } from '../components/PeacockMascot';
import { CURRICULUM } from '../services/curriculumData';
import { useChallengeStore } from '../stores/useChallengeStore';
import DailyChestAnimation from '../components/DailyChestAnimation';

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<OdiaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSadModal, setShowSadModal] = useState(false);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset idle timer — call on any user interaction
  const resetIdleTimer = () => {
    setMascotState('idle');
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setMascotState('sleeping'), 30000);
  };

  const streak = useUserStore((state) => state.streak);
  const wasStreakBroken = useUserStore((state) => state.wasStreakBroken);
  const totalXp = useUserStore((state) => state.xp);
  const hearts = useUserStore((state) => state.hearts);
  const gems = useUserStore((state) => state.gems);
  const dueCount = useProgressStore((state) => state.dueCount);
  const weakAreas = useProgressStore((state) => state.weakAreas);
  const recommendedLessons = useProgressStore((state) => state.recommendedLessons);
  const focusVocabulary = useProgressStore((state) => state.focusVocabulary);

  // Daily challenges
  const challenges = useChallengeStore((state) => state.challenges);
  const chestClaimed = useChallengeStore((state) => state.chestClaimed);
  const challengesLoading = useChallengeStore((state) => state.loading);
  const [chestAnimState, setChestAnimState] = useState<'locked' | 'unlocked' | 'open'>('locked');
  const [rewardToast, setRewardToast] = useState<{ xp: number; gems: number } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Countdown to midnight reset
  const [timeToReset, setTimeToReset] = useState('');
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeToReset(`${h}h ${m}m ${s}s`);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync chest animation state
  useEffect(() => {
    if (chestClaimed) {
      setChestAnimState('locked'); // treat already-claimed as locked (greyed)
    } else {
      const allDone = challenges.length === 3 && challenges.every((c) => c.is_completed === 1);
      setChestAnimState(allDone ? 'unlocked' : 'locked');
    }
  }, [challenges, chestClaimed]);

  const sadFadeAnim = useRef(new Animated.Value(0)).current;
  const sadScaleAnim = useRef(new Animated.Value(0.6)).current;

  const cardBackground = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');

  useEffect(() => {
    fetchOdiaItems().then((data) => {
      setItems(data);
      setLoading(false);
    });
    // Start idle timer when home screen mounts
    resetIdleTimer();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, []);

  // Show sad animation when streak is broken
  useEffect(() => {
    if (wasStreakBroken) {
      setShowSadModal(true);
      Animated.parallel([
        Animated.timing(sadFadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(sadScaleAnim, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      ]).start();
      // Auto-dismiss after 3s
      setTimeout(() => setShowSadModal(false), 3000);
    }
  }, [wasStreakBroken]);

  useEffect(() => {
    if (isFocused) {
      useProgressStore.getState().loadProgress();
      useUserStore.getState().checkRefill();
      useChallengeStore.getState().loadDailyChallenges().catch(console.error);
    }
  }, [isFocused]);

  const handleClaimChest = async () => {
    if (chestAnimState !== 'unlocked') return;
    setChestAnimState('open');
    const reward = await useChallengeStore.getState().claimDailyChest();
    if (reward) {
      setRewardToast(reward);
      // Animate toast in
      Animated.sequence([
        Animated.timing(toastAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(toastAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start(() => setRewardToast(null));
    }
  };

  const getLessonTitle = (lessonId: string): string => {
    for (const unit of CURRICULUM) {
      const lesson = unit.lessons.find((l) => l.id === lessonId);
      if (lesson) return lesson.title;
    }
    return lessonId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const renderDailyChallengesCard = () => {
    if (challengesLoading) return null;
    const allDone = challenges.length === 3 && challenges.every((c) => c.is_completed === 1);

    return (
      <RNView style={[styles.challengesCard, { backgroundColor: cardBackground, borderColor: borderCol }]}>
        {/* Header row */}
        <RNView style={styles.challengesHeader}>
          <RNView>
            <Text style={[styles.challengesTitle, { color: tintCol }]}>🎯 Daily Challenges</Text>
            <Text style={styles.challengesSubtitle}>Resets in {timeToReset}</Text>
          </RNView>
          <RNView style={[styles.gemsBadge, { borderColor: tintCol + '50' }]}>
            <Text style={styles.gemsText}>💎 {gems}</Text>
          </RNView>
        </RNView>

        {/* Challenge rows */}
        {challenges.map((ch) => {
          const progress = Math.min(ch.current_progress / ch.target_count, 1);
          const done = ch.is_completed === 1;
          return (
            <RNView key={ch.id} style={styles.challengeRow}>
              <RNView style={styles.challengeInfo}>
                <Text style={[styles.challengeCheck, done && styles.challengeCheckDone]}>
                  {done ? '✅' : '⬜'}
                </Text>
                <RNView style={styles.challengeTexts}>
                  <Text style={[styles.challengeDesc, done && { color: '#6B7280', textDecorationLine: 'line-through' }]}>
                    {ch.description}
                  </Text>
                  <Text style={styles.challengeReward}>
                    +{ch.reward_xp} XP · {ch.reward_gems} 💎
                  </Text>
                </RNView>
                <Text style={styles.challengeCount}>
                  {ch.current_progress}/{ch.target_count}
                </Text>
              </RNView>
              {/* Progress bar */}
              <RNView style={[styles.progressBarTrack, { borderColor: borderCol }]}>
                <RNView
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progress * 100}%` as any,
                      backgroundColor: done ? '#10B981' : tintCol,
                    },
                  ]}
                />
              </RNView>
            </RNView>
          );
        })}

        {/* Chest */}
        <TouchableOpacity
          activeOpacity={chestAnimState === 'unlocked' ? 0.75 : 1}
          onPress={handleClaimChest}
          disabled={chestAnimState !== 'unlocked'}
          style={styles.chestWrapper}
        >
          <DailyChestAnimation state={chestClaimed ? 'locked' : chestAnimState} size={52} />
          <Text style={[
            styles.chestLabel,
            chestAnimState === 'unlocked' && !chestClaimed && { color: tintCol, fontWeight: '700' },
          ]}>
            {chestClaimed
              ? 'Chest claimed! 🎉'
              : allDone
              ? 'Tap to claim your chest!'
              : `${challenges.filter((c) => c.is_completed === 1).length} / 3 complete`}
          </Text>
        </TouchableOpacity>

        {/* Reward toast */}
        {rewardToast && (
          <Animated.View style={[styles.rewardToast, { opacity: toastAnim }]}>
            <Text style={styles.rewardToastText}>
              🎁 +{rewardToast.xp} XP · +{rewardToast.gems} 💎 Claimed!
            </Text>
          </Animated.View>
        )}
      </RNView>
    );
  };

  const renderPersonalizedCard = () => {
    if (!weakAreas || weakAreas.length === 0) return null;

    return (
      <RNView style={[styles.personalCard, { backgroundColor: cardBackground, borderColor: borderCol }]}>
        <RNView style={styles.personalHeader}>
          <Text style={[styles.personalTitle, { color: tintCol }]}>✨ Personalized For You</Text>
          <Text style={[styles.personalSubtitle, { color: '#6B7280' }]}>Based on your recent mistakes</Text>
        </RNView>
        
        <Text style={styles.sectionHeading}>Weak Areas to Improve</Text>
        <RNView style={styles.weakAreasList}>
          {weakAreas.map((area, idx) => (
            <RNView key={idx} style={styles.weakAreaItem}>
              <Text style={styles.bulletSymbol}>⚠️</Text>
              <Text style={styles.weakAreaText}>{area}</Text>
            </RNView>
          ))}
        </RNView>

        {recommendedLessons && recommendedLessons.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Recommended Lessons to Review</Text>
            <RNView style={styles.lessonsContainer}>
              {recommendedLessons.map((lessonId) => {
                const title = getLessonTitle(lessonId);
                return (
                  <TouchableOpacity
                    key={lessonId}
                    activeOpacity={0.7}
                    onPress={() => (navigation as any).navigate('Lesson', { lessonId })}
                    style={[styles.lessonButton, { borderColor: tintCol + '40', backgroundColor: tintCol + '05' }]}
                  >
                    <Text style={[styles.lessonButtonText, { color: tintCol }]}>📖 {title}</Text>
                  </TouchableOpacity>
                );
              })}
            </RNView>
          </>
        )}

        {focusVocabulary && focusVocabulary.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Vocabulary Focus</Text>
            <RNView style={styles.vocabContainer}>
              {focusVocabulary.map((vocab, idx) => (
                <RNView key={idx} style={[styles.vocabChip, { backgroundColor: borderCol }]}>
                  <Text style={styles.vocabText}>{vocab}</Text>
                </RNView>
              ))}
            </RNView>
          </>
        )}
      </RNView>
    );
  };

  const renderItem = ({ item }: { item: OdiaItem }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => navigation.navigate('Details', { itemId: item.id })}
      style={[styles.card, { backgroundColor: cardBackground, borderColor: borderCol }]}
    >
      <RNView style={styles.cardHeader}>
        <Text style={[styles.category, { color: tintCol }]}>{item.category.toUpperCase()}</Text>
      </RNView>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDescription} numberOfLines={2}>
        {item.description}
      </Text>
      <RNView style={styles.learnMoreRow}>
        <Text style={[styles.learnMoreText, { color: tintCol }]}>Learn More →</Text>
      </RNView>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Sad streak-broken modal */}
      <Modal transparent visible={showSadModal} animationType="none">
        <RNView style={styles.sadOverlay}>
          <Animated.View style={[
            styles.sadCard,
            { opacity: sadFadeAnim, transform: [{ scale: sadScaleAnim }] },
          ]}>
            <Text style={styles.sadEmoji}>😢</Text>
            <Text style={styles.sadTitle}>Streak Lost!</Text>
            <Text style={styles.sadSub}>Your streak has been reset. Start fresh today! 💪</Text>
            <RNView style={styles.sadStreakReset}>
              <Text style={styles.sadResetText}>🔥 0</Text>
            </RNView>
          </Animated.View>
        </RNView>
      </Modal>
      <RNView style={styles.header}>
        <RNView style={styles.titleRow}>
          <Text style={styles.title}>Odia Agent</Text>
          <RNView style={styles.badgeRow}>
            <StreakBadge onPress={() => (navigation as any).navigate('StreakSociety')} />
            <RNView style={[styles.xpBadge, { backgroundColor: '#FBBF2415', borderColor: '#FBBF24', marginRight: Theme.spacing.xs }]}>
              <Text style={styles.xpText}>🏆 {totalXp} XP</Text>
            </RNView>
            <RNView style={[styles.xpBadge, { backgroundColor: '#EF444415', borderColor: '#EF4444' }]}>
              <Text style={[styles.xpText, { color: '#EF4444' }]}>❤️ {hearts}</Text>
            </RNView>
          </RNView>
        </RNView>
        <Text style={styles.subtitle}>Explore the rich history, art, and heritage of Odisha.</Text>

        {/* Mascot — reacts to idle time */}
        <RNView style={styles.mascotContainer}>
          <PeacockMascot state={mascotState} size={100} />
        </RNView>

        {dueCount > 0 ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Flashcard')}
            style={[styles.dueBanner, { backgroundColor: tintCol + '10', borderColor: tintCol }]}
          >
            <RNView style={styles.dueBannerContent}>
              <Text style={[styles.dueBannerTitle, { color: tintCol }]}>📚 Cards Due Today</Text>
              <Text style={styles.dueBannerSubtitle}>
                You have {dueCount} {dueCount === 1 ? 'phrase' : 'phrases'} ready for spaced repetition review.
              </Text>
            </RNView>
            <Text style={[styles.dueBannerAction, { color: tintCol }]}>Review →</Text>
          </TouchableOpacity>
        ) : (
          <RNView style={[styles.dueBanner, styles.dueBannerCompleted, { borderColor: borderCol, backgroundColor: cardBackground }]}>
            <Text style={styles.dueCompletedText}>🎉 All caught up in Spaced Repetition for today!</Text>
          </RNView>
        )}
      </RNView>

      {loading ? (
        <RNView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintCol} />
          <Text style={styles.loadingText}>Fetching heritage details...</Text>
        </RNView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={(
            <>
              {renderDailyChallengesCard()}
              {renderPersonalizedCard()}
            </>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.lg,
  },
  title: {
    fontSize: Theme.typography.fontSize.xxl,
    fontWeight: Theme.typography.fontWeight.heavy,
    letterSpacing: 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs - 2,
  },
  xpText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: 'bold',
    color: '#D97706',
  },
  subtitle: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
    marginTop: Theme.spacing.xs,
    lineHeight: Theme.typography.lineHeight.sm,
  },
  mascotContainer: {
    alignItems: 'center',
    marginTop: Theme.spacing.sm,
    marginBottom: Theme.spacing.xs,
  },
  listContent: {
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xxl,
  },
  challengesCard: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  challengesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.md,
    backgroundColor: 'transparent',
  },
  challengesTitle: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: '700',
  },
  challengesSubtitle: {
    fontSize: Theme.typography.fontSize.xs - 1,
    color: '#9CA3AF',
    marginTop: 2,
  },
  gemsBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gemsText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  challengeRow: {
    marginBottom: Theme.spacing.md,
  },
  challengeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  challengeCheck: {
    fontSize: 16,
    marginRight: 8,
  },
  challengeCheckDone: {
    opacity: 0.7,
  },
  challengeTexts: {
    flex: 1,
  },
  challengeDesc: {
    fontSize: Theme.typography.fontSize.sm - 1,
    fontWeight: '600',
  },
  challengeReward: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },
  challengeCount: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: '700',
    color: '#9CA3AF',
    marginLeft: 6,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(156,163,175,0.15)',
    overflow: 'hidden',
    borderWidth: 0,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  chestWrapper: {
    alignItems: 'center',
    marginTop: Theme.spacing.md,
    paddingTop: Theme.spacing.sm,
  },
  chestLabel: {
    marginTop: 4,
    fontSize: Theme.typography.fontSize.xs,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
  },
  rewardToast: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rewardToastText: {
    backgroundColor: '#1F2937',
    color: '#F9FAFB',
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xs,
  },
  category: {
    fontSize: Theme.typography.fontSize.xs - 2,
    fontWeight: Theme.typography.fontWeight.bold,
    letterSpacing: 1.2,
  },
  cardTitle: {
    fontSize: Theme.typography.fontSize.lg,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.xs,
  },
  cardDescription: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
    lineHeight: Theme.typography.lineHeight.sm,
    marginBottom: Theme.spacing.md,
  },
  learnMoreRow: {
    alignItems: 'flex-end',
  },
  learnMoreText: {
    fontSize: Theme.typography.fontSize.sm - 1,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
  },
  dueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  dueBannerContent: {
    flex: 1,
    paddingRight: Theme.spacing.sm,
  },
  dueBannerTitle: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: 2,
  },
  dueBannerSubtitle: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#6B7280',
  },
  dueBannerAction: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  dueBannerCompleted: {
    justifyContent: 'center',
    paddingVertical: Theme.spacing.sm,
  },
  dueCompletedText: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#10B981',
    fontWeight: Theme.typography.fontWeight.semibold,
    textAlign: 'center',
  },
  sadOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sadCard: {
    backgroundColor: '#1F2937',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  sadEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  sadTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: 8,
  },
  sadSub: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  sadStreakReset: {
    backgroundColor: '#EF444420',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sadResetText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#EF4444',
  },
  personalCard: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  personalHeader: {
    marginBottom: Theme.spacing.md,
    backgroundColor: 'transparent',
  },
  personalTitle: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  personalSubtitle: {
    fontSize: Theme.typography.fontSize.xs,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
    textTransform: 'uppercase',
  },
  weakAreasList: {
    gap: 4,
    backgroundColor: 'transparent',
  },
  weakAreaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  bulletSymbol: {
    marginRight: 6,
    fontSize: 12,
  },
  weakAreaText: {
    fontSize: Theme.typography.fontSize.sm - 1,
    fontWeight: '500',
  },
  lessonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  lessonButton: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 8,
  },
  lessonButtonText: {
    fontSize: Theme.typography.fontSize.xs - 1,
    fontWeight: '600',
  },
  vocabContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: 'transparent',
  },
  vocabChip: {
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  vocabText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
