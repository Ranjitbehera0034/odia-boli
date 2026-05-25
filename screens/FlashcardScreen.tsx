import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
  View as RNView,
} from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useProgressStore, SRSCard } from '../stores/useProgressStore';
import { useUserStore } from '../stores/useUserStore';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function FlashcardScreen() {
  const [queue, setQueue] = useState<SRSCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isStudyAhead, setIsStudyAhead] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');

  // Animation values
  const pan = useRef(new Animated.ValueXY()).current;
  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async (forceStudyAll = false) => {
    setLoading(true);
    try {
      await useProgressStore.getState().loadProgress();
      const allCards = useProgressStore.getState().srsCards;
      const now = Date.now();
      let items = allCards.filter((card) => card.nextReview <= now);
      if (items.length === 0 || forceStudyAll) {
        items = allCards;
        setIsStudyAhead(true);
      } else {
        setIsStudyAhead(false);
      }
      setQueue(items);
      setCurrentIndex(0);
      setFlipped(false);
      flipAnim.setValue(0);
      pan.setValue({ x: 0, y: 0 });
    } catch (e) {
      console.error('Failed to load SRS queue:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await useProgressStore.getState().resetSRSCards();
      await loadQueue();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRateCard = (quality: number) => {
    const currentItem = queue[currentIndex];
    if (!currentItem) return;

    // Trigger swipe exit animation
    // Quality 1 (Again/Forgot) swipes left; Quality 3, 4, 5 (Passed) swipes right
    const toValueX = quality < 3 ? -SCREEN_WIDTH - 120 : SCREEN_WIDTH + 120;
    
    Animated.timing(pan, {
      toValue: { x: toValueX, y: 0 },
      duration: 250,
      useNativeDriver: Platform.OS !== 'web',
    }).start(async () => {
      // 1. Save results to database
      await useProgressStore.getState().reviewSRSCard(currentItem.id, quality);
      
      // 2. Track activity streak
      useUserStore.getState().updateStreak().catch(console.error);

      // 3. Reset card orientation/pan coordinates for the incoming card
      setFlipped(false);
      flipAnim.setValue(0);
      pan.setValue({ x: 0, y: 0 });

      // 4. Update pointer to next card index
      if (currentIndex < queue.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Refresh queue at the end of the session
        await loadQueue();
      }
    });
  };

  // Flip Card Action
  const toggleFlip = () => {
    const toValue = flipped ? 0 : 180;
    setFlipped(!flipped);
    Animated.spring(flipAnim, {
      toValue,
      friction: 8,
      tension: 15,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  // Rotation Interpolations
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
  });

  // Rotation interpolation while exiting/swiping
  const rotateCard = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-15deg', '0deg', '15deg'],
    extrapolate: 'clamp',
  });

  const cardStyle = {
    transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate: rotateCard }],
  };

  const currentItem = queue[currentIndex];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tintCol} />
        <Text style={styles.loadingText}>Syncing schedule...</Text>
      </View>
    );
  }

  // All Caught Up State
  if (!currentItem || queue.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.successIcon}>🎉</Text>
        <Text style={styles.emptyTitle}>You're All Caught Up!</Text>
        <Text style={styles.emptySubtitle}>
          You have reviewed all due cards for today. Keep up the great work!
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.primaryActionBtn, { backgroundColor: tintCol }]}
          onPress={() => loadQueue(true)}
        >
          <Text style={styles.primaryActionBtnText}>Review Ahead (Study All)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.outlineActionBtn, { borderColor: tintCol }]}
          onPress={handleReset}
        >
          <Text style={[styles.outlineActionBtnText, { color: tintCol }]}>Reset Review Intervals</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header Stats */}
      <RNView style={styles.statsContainer}>
        <RNView>
          <Text style={styles.sessionModeText}>
            {isStudyAhead ? '🌟 Study Ahead Mode' : '📅 Today\'s Reviews'}
          </Text>
          <Text style={styles.statsText}>
            Card {currentIndex + 1} of {queue.length}
          </Text>
        </RNView>
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Text style={[styles.resetText, { color: tintCol }]}>Reset Progress</Text>
        </TouchableOpacity>
      </RNView>

      {/* Card Wrapper */}
      <RNView style={styles.cardContainer}>
        <Animated.View style={[styles.animatedCard, cardStyle]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={toggleFlip}
            style={StyleSheet.absoluteFill}
          >
            {/* Front of Card (Odia phrase) */}
            <Animated.View
              style={[
                styles.cardSide,
                {
                  backgroundColor: cardCol,
                  borderColor: borderCol,
                  transform: [{ rotateY: frontInterpolate }],
                  opacity: frontOpacity,
                },
              ]}
            >
              <Text style={styles.categoryLabel}>{currentItem.category.toUpperCase()}</Text>
              
              <RNView style={styles.contentCenter}>
                <Text style={styles.odiaText}>{currentItem.odia}</Text>
                <Text style={styles.tapInstruction}>Tap card to reveal meaning</Text>
              </RNView>

              <RNView style={styles.cardFooter}>
                <Text style={[styles.flipBtnText, { color: tintCol }]}>Tap to Flip ↻</Text>
              </RNView>
            </Animated.View>

            {/* Back of Card (English meaning) */}
            <Animated.View
              style={[
                styles.cardSide,
                {
                  backgroundColor: cardCol,
                  borderColor: borderCol,
                  transform: [{ rotateY: backInterpolate }],
                  opacity: backOpacity,
                },
              ]}
            >
              <Text style={styles.categoryLabel}>{currentItem.category.toUpperCase()}</Text>

              <RNView style={styles.contentCenter}>
                <Text style={styles.englishText}>{currentItem.english}</Text>
              </RNView>

              <RNView style={styles.cardFooter}>
                <Text style={[styles.flipBtnText, { color: tintCol }]}>Tap to Flip ↻</Text>
              </RNView>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </RNView>

      {/* Spaced Repetition Quality Feedback Buttons */}
      <RNView style={styles.feedbackContainer}>
        {flipped ? (
          <RNView style={styles.buttonsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleRateCard(1)}
              style={[styles.rateBtn, styles.againBtn]}
            >
              <Text style={styles.rateBtnIcon}>🔴</Text>
              <Text style={styles.rateBtnLabel}>Again</Text>
              <Text style={styles.rateBtnDesc}>Forgot</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleRateCard(3)}
              style={[styles.rateBtn, styles.hardBtn]}
            >
              <Text style={styles.rateBtnIcon}>🟡</Text>
              <Text style={styles.rateBtnLabel}>Hard</Text>
              <Text style={styles.rateBtnDesc}>Recall ok</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleRateCard(4)}
              style={[styles.rateBtn, styles.goodBtn]}
            >
              <Text style={styles.rateBtnIcon}>🟢</Text>
              <Text style={styles.rateBtnLabel}>Good</Text>
              <Text style={styles.rateBtnDesc}>hesitate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleRateCard(5)}
              style={[styles.rateBtn, styles.easyBtn]}
            >
              <Text style={styles.rateBtnIcon}>🔵</Text>
              <Text style={styles.rateBtnLabel}>Easy</Text>
              <Text style={styles.rateBtnDesc}>Perfect</Text>
            </TouchableOpacity>
          </RNView>
        ) : (
          <RNView style={styles.initialFeedbackPlaceholder}>
            <Text style={styles.placeholderText}>Flip card to rate your recall ease</Text>
          </RNView>
        )}
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Theme.spacing.xl,
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  sessionModeText: {
    fontSize: Theme.typography.fontSize.xs - 1,
    color: '#6B7280',
    fontWeight: Theme.typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  statsText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.semibold,
    marginTop: 2,
  },
  resetButton: {
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
  },
  resetText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  cardContainer: {
    flex: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animatedCard: {
    width: '100%',
    height: '90%',
    maxWidth: 400,
    maxHeight: 460,
  },
  cardSide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  categoryLabel: {
    fontSize: Theme.typography.fontSize.xs - 2,
    fontWeight: Theme.typography.fontWeight.bold,
    letterSpacing: 1.5,
    color: '#6B7280',
  },
  contentCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  odiaText: {
    fontSize: Theme.typography.fontSize.xxl + 4,
    fontWeight: Theme.typography.fontWeight.bold,
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeight.xxl + 6,
    marginBottom: Theme.spacing.sm,
  },
  tapInstruction: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: Theme.spacing.md,
  },
  englishText: {
    fontSize: Theme.typography.fontSize.xl + 2,
    fontWeight: Theme.typography.fontWeight.semibold,
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeight.xl + 4,
  },
  cardFooter: {
    alignItems: 'center',
  },
  flipBtnText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  feedbackContainer: {
    marginTop: Theme.spacing.lg,
    minHeight: 110,
    justifyContent: 'center',
  },
  initialFeedbackPlaceholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  rateBtn: {
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  againBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  hardBtn: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  goodBtn: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  easyBtn: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  rateBtnIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  rateBtnLabel: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: '700',
    color: '#1F2937',
  },
  rateBtnDesc: {
    fontSize: 9,
    color: '#4B5563',
    marginTop: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.xxl,
  },
  successIcon: {
    fontSize: 60,
    marginBottom: Theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: Theme.typography.fontSize.xl,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeight.sm,
    marginBottom: Theme.spacing.xl,
  },
  primaryActionBtn: {
    width: '100%',
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: Theme.spacing.md,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontWeight: Theme.typography.fontWeight.bold,
    fontSize: Theme.typography.fontSize.sm,
  },
  outlineActionBtn: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  outlineActionBtnText: {
    fontWeight: Theme.typography.fontWeight.bold,
    fontSize: Theme.typography.fontSize.sm,
  },
});
