import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, View as RNView, Modal, Animated } from 'react-native';
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
  const dueCount = useProgressStore((state) => state.dueCount);

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
    }
  }, [isFocused]);

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
            <StreakBadge onPress={() => (navigation as any).navigate('Settings')} />
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
});
