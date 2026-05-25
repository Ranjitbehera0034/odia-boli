import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Text } from './Themed';
import { useUserStore } from '../stores/useUserStore';

interface Props {
  onPress?: () => void;
}

export default function StreakBadge({ onPress }: Props) {
  const streak = useUserStore((state) => state.streak);
  const streakFreezeCount = useUserStore((state) => state.streakFreezeCount);

  // Glow pulse for streaks > 2
  const glowAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Entry pop animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    }).start();

    // Glow pulse if streak is meaningful
    if (streak >= 3) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1.15,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [streak]);

  const fireColor = streak === 0
    ? '#9CA3AF'   // grey for 0
    : streak < 3
    ? '#F97316'   // orange for early streak
    : '#EF4444';  // blazing red for 3+

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.touchable}>
      <Animated.View
        style={[
          styles.badge,
          {
            backgroundColor: fireColor + '18',
            borderColor: fireColor + '60',
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.fireEmoji,
            streak >= 3 && { transform: [{ scale: glowAnim }] },
          ]}
        >
          {streak === 0 ? '🔥' : '🔥'}
        </Animated.Text>
        <Text style={[styles.streakText, { color: fireColor }]}>{streak}</Text>
        {streakFreezeCount > 0 && (
          <View style={[styles.freezePill, { backgroundColor: '#3B82F615', borderColor: '#3B82F660' }]}>
            <Text style={styles.freezeText}>🧊{streakFreezeCount}</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginRight: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 2,
  },
  fireEmoji: {
    fontSize: 14,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 1,
  },
  freezePill: {
    marginLeft: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  freezeText: {
    fontSize: 10,
    color: '#3B82F6',
    fontWeight: '700',
  },
});
