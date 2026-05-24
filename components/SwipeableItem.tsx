import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View, Text } from 'react-native';
import Theme from '../constants/Theme';

interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  cardBg: string;
  borderCol: string;
}

export function SwipeableItem({ children, onDelete, cardBg, borderCol }: SwipeableItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only set responder for horizontal movements (swipes)
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swiping left (negative dx)
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -100) {
          // Swipe left threshold exceeded, slide all the way off
          Animated.timing(translateX, {
            toValue: -500,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            onDelete();
          });
        } else {
          // Snap back to original position
          Animated.spring(translateX, {
            toValue: 0,
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Red Action Panel Revealed Behind Card */}
      <View style={[styles.backgroundAction, { backgroundColor: '#EF4444' }]}>
        <Text style={styles.deleteText}>Delete 🗑️</Text>
      </View>

      {/* Slideable Foreground Card */}
      <Animated.View
        style={[
          styles.foregroundCard,
          {
            backgroundColor: cardBg,
            borderColor: borderCol,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: Theme.spacing.md,
  },
  backgroundAction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: Theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: Theme.spacing.xl,
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: Theme.typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  foregroundCard: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
});
