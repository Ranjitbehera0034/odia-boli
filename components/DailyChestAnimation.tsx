import React, { useEffect, useRef } from 'react';
import { StyleSheet, View as RNView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Text } from './Themed';

interface Particle {
  id: number;
  emoji: string;
  tx: number;
  ty: number;
  delay: number;
}

interface DailyChestAnimationProps {
  /** true = locked (all grey), false = unlocked glow, 'open' = burst animation */
  state: 'locked' | 'unlocked' | 'open';
  onOpenComplete?: () => void;
  size?: number;
}

const PARTICLES: Particle[] = [
  { id: 0, emoji: '💎', tx: -60, ty: -80, delay: 0 },
  { id: 1, emoji: '⭐', tx: 55,  ty: -90, delay: 60 },
  { id: 2, emoji: '✨', tx: -80, ty: -30, delay: 30 },
  { id: 3, emoji: '💫', tx: 80,  ty: -40, delay: 90 },
  { id: 4, emoji: '🌟', tx: -40, ty: -110, delay: 45 },
  { id: 5, emoji: '💎', tx: 35,  ty: -105, delay: 75 },
];

export default function DailyChestAnimation({
  state,
  onOpenComplete,
  size = 72,
}: DailyChestAnimationProps) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  // Per-particle shared values
  const particleValues = PARTICLES.map(() => ({
    // eslint-disable-next-line react-hooks/rules-of-hooks
    x: useSharedValue(0),
    // eslint-disable-next-line react-hooks/rules-of-hooks
    y: useSharedValue(0),
    // eslint-disable-next-line react-hooks/rules-of-hooks
    opacity: useSharedValue(0),
    // eslint-disable-next-line react-hooks/rules-of-hooks
    particleScale: useSharedValue(0),
  }));

  useEffect(() => {
    if (state === 'unlocked') {
      // Gentle pulsing glow to invite tap
      glowOpacity.value = withSequence(
        withTiming(0.7, { duration: 600 }),
        withTiming(0.3, { duration: 600 }),
      );
      scale.value = withSequence(
        withSpring(1.08, { damping: 8, stiffness: 200 }),
        withSpring(1.0, { damping: 12, stiffness: 200 }),
      );
    } else if (state === 'open') {
      // Big pop spring
      scale.value = withSequence(
        withSpring(1.35, { damping: 5, stiffness: 280 }),
        withSpring(1.0, { damping: 10, stiffness: 200 }),
      );
      // Slight wobble
      rotate.value = withSequence(
        withTiming(-12, { duration: 80 }),
        withTiming(12, { duration: 80 }),
        withTiming(-8, { duration: 80 }),
        withTiming(8, { duration: 80 }),
        withTiming(0, { duration: 80 }),
      );
      // Burst particles
      PARTICLES.forEach((p, i) => {
        const pv = particleValues[i];
        pv.opacity.value = withDelay(p.delay, withTiming(1, { duration: 150 }));
        pv.particleScale.value = withDelay(p.delay, withSpring(1, { damping: 7, stiffness: 300 }));
        pv.x.value = withDelay(p.delay, withSpring(p.tx, { damping: 14, stiffness: 180 }));
        pv.y.value = withDelay(
          p.delay,
          withSequence(
            withSpring(p.ty, { damping: 12, stiffness: 160 }),
            withDelay(350, withTiming(p.ty + 20, { duration: 300 })),
          ),
        );
        // Fade out after peak
        pv.opacity.value = withDelay(
          p.delay + 400,
          withTiming(0, { duration: 400 }),
        );
      });
      // Notify parent after animation
      if (onOpenComplete) {
        setTimeout(() => runOnJS(onOpenComplete)(), 900);
      }
    } else {
      // locked — reset everything
      glowOpacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [state]);

  const chestAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <RNView style={[styles.wrapper, { width: size * 2, height: size * 2 }]}>
      {/* Glow halo */}
      <Animated.View
        style={[
          styles.glow,
          { width: size * 1.6, height: size * 1.6, borderRadius: size * 0.8 },
          glowStyle,
        ]}
      />

      {/* Burst particles */}
      {PARTICLES.map((p, i) => {
        const pv = particleValues[i];
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const particleStyle = useAnimatedStyle(() => ({
          transform: [
            { translateX: pv.x.value },
            { translateY: pv.y.value },
            { scale: pv.particleScale.value },
          ],
          opacity: pv.opacity.value,
        }));
        return (
          <Animated.View key={p.id} style={[styles.particle, particleStyle]}>
            <Text style={styles.particleEmoji}>{p.emoji}</Text>
          </Animated.View>
        );
      })}

      {/* Chest emoji */}
      <Animated.View style={chestAnimStyle}>
        <Text style={[styles.chestEmoji, { fontSize: size }]}>
          {state === 'locked' ? '🔒' : state === 'open' ? '🎁' : '🏆'}
        </Text>
      </Animated.View>
    </RNView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: '#FBBF24',
  },
  particle: {
    position: 'absolute',
  },
  particleEmoji: {
    fontSize: 20,
  },
  chestEmoji: {
    textAlign: 'center',
  },
});
