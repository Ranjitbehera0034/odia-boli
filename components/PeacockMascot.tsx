/**
 * PeacockMascot — an animated peacock mascot for the Odia Agent app.
 *
 * States:
 *   idle      — gentle float + slow blink
 *   happy     — bounce up + scale pulse
 *   sad       — droop down + slight tilt
 *   celebrate — full spin + scale burst
 *   sleeping  — gentle sway + z-z-z particles
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  Text,
  Easing,
} from 'react-native';

export type MascotState = 'idle' | 'happy' | 'sad' | 'celebrate' | 'sleeping';

interface Props {
  state: MascotState;
  size?: number;
}

export default function PeacockMascot({ state, size = 120 }: Props) {
  // Core transform values
  const translateY  = useRef(new Animated.Value(0)).current;
  const rotate      = useRef(new Animated.Value(0)).current;
  const scale       = useRef(new Animated.Value(1)).current;
  const bodyTilt    = useRef(new Animated.Value(0)).current;
  const eyeScale    = useRef(new Animated.Value(1)).current;

  // Sleeping Z particles
  const z1Opacity   = useRef(new Animated.Value(0)).current;
  const z1Translate = useRef(new Animated.Value(0)).current;
  const z2Opacity   = useRef(new Animated.Value(0)).current;
  const z2Translate = useRef(new Animated.Value(0)).current;

  const stopAll = useCallback(() => {
    translateY.stopAnimation();
    rotate.stopAnimation();
    scale.stopAnimation();
    bodyTilt.stopAnimation();
    eyeScale.stopAnimation();
    z1Opacity.stopAnimation();
    z1Translate.stopAnimation();
    z2Opacity.stopAnimation();
    z2Translate.stopAnimation();
  }, []);

  const resetAll = useCallback(() => {
    translateY.setValue(0);
    rotate.setValue(0);
    scale.setValue(1);
    bodyTilt.setValue(0);
    eyeScale.setValue(1);
    z1Opacity.setValue(0);
    z1Translate.setValue(0);
    z2Opacity.setValue(0);
    z2Translate.setValue(0);
  }, []);

  useEffect(() => {
    stopAll();
    resetAll();

    switch (state) {
      case 'idle':
        // Gentle float: up/down loop
        Animated.loop(
          Animated.sequence([
            Animated.timing(translateY, { toValue: -6, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0,  duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ).start();
        // Slow blink every 3s
        Animated.loop(
          Animated.sequence([
            Animated.delay(2800),
            Animated.timing(eyeScale, { toValue: 0.15, duration: 80,  useNativeDriver: true }),
            Animated.timing(eyeScale, { toValue: 1,    duration: 80,  useNativeDriver: true }),
          ])
        ).start();
        break;

      case 'happy':
        // Quick bounce: up-down × 3, then settle
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateY, { toValue: -22, duration: 140, useNativeDriver: true }),
            Animated.timing(scale,      { toValue: 1.15, duration: 140, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, { toValue: 0,   duration: 120, useNativeDriver: true }),
            Animated.timing(scale,      { toValue: 0.92, duration: 120, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, { toValue: -14, duration: 120, useNativeDriver: true }),
            Animated.timing(scale,      { toValue: 1.10, duration: 120, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, { toValue: 0,   duration: 100, useNativeDriver: true }),
            Animated.timing(scale,      { toValue: 1.0,  duration: 100, useNativeDriver: true }),
          ]),
        ]).start(() => {
          // After bounce, gentle idle float
          Animated.loop(
            Animated.sequence([
              Animated.timing(translateY, { toValue: -5, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.timing(translateY, { toValue: 0,  duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
          ).start();
        });
        break;

      case 'sad':
        // Droop down + tilt to side
        Animated.parallel([
          Animated.timing(translateY, { toValue: 12,  duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(bodyTilt,   { toValue: -12, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(scale,      { toValue: 0.90, duration: 400, useNativeDriver: true }),
        ]).start(() => {
          // Slow sag loop
          Animated.loop(
            Animated.sequence([
              Animated.timing(bodyTilt, { toValue: -14, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
              Animated.timing(bodyTilt, { toValue: -10, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
          ).start();
        });
        break;

      case 'celebrate':
        // Full spin + scale burst × 2
        Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.parallel([
                Animated.timing(scale,      { toValue: 1.25, duration: 250, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: -28,  duration: 250, useNativeDriver: true }),
              ]),
              Animated.parallel([
                Animated.timing(scale,      { toValue: 0.95, duration: 200, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0,    duration: 200, useNativeDriver: true }),
              ]),
            ]),
            Animated.timing(rotate, {
              toValue: 1,
              duration: 800,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;

      case 'sleeping':
        // Slow sway
        Animated.loop(
          Animated.sequence([
            Animated.timing(bodyTilt, { toValue: 8,  duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(bodyTilt, { toValue: -8, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ).start();
        // Z1 particle
        const animateZ1 = () => {
          z1Opacity.setValue(0);
          z1Translate.setValue(0);
          Animated.parallel([
            Animated.timing(z1Opacity,   { toValue: 1,   duration: 600, useNativeDriver: true }),
            Animated.timing(z1Translate, { toValue: -20, duration: 1400, useNativeDriver: true }),
          ]).start(() => {
            Animated.timing(z1Opacity, { toValue: 0, duration: 400, useNativeDriver: true })
              .start(() => animateZ1());
          });
        };
        // Z2 particle (delayed)
        const animateZ2 = () => {
          z2Opacity.setValue(0);
          z2Translate.setValue(0);
          Animated.sequence([
            Animated.delay(700),
            Animated.parallel([
              Animated.timing(z2Opacity,   { toValue: 1,   duration: 600, useNativeDriver: true }),
              Animated.timing(z2Translate, { toValue: -28, duration: 1600, useNativeDriver: true }),
            ]),
          ]).start(() => {
            Animated.timing(z2Opacity, { toValue: 0, duration: 400, useNativeDriver: true })
              .start(() => animateZ2());
          });
        };
        animateZ1();
        animateZ2();
        break;
    }

    return () => stopAll();
  }, [state]);

  const rotateDeg = rotate.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const tiltDeg = bodyTilt.interpolate({
    inputRange:  [-20, 20],
    outputRange: ['-20deg', '20deg'],
  });

  const s = size;

  return (
    <View style={[styles.container, { width: s, height: s * 1.3 }]}>
      {/* Sleeping Z particles */}
      {state === 'sleeping' && (
        <>
          <Animated.Text style={[
            styles.zParticle,
            { top: s * 0.05, right: s * 0.02, fontSize: s * 0.14, opacity: z1Opacity, transform: [{ translateY: z1Translate }] },
          ]}>
            z
          </Animated.Text>
          <Animated.Text style={[
            styles.zParticle,
            { top: s * -0.05, right: s * 0.12, fontSize: s * 0.20, opacity: z2Opacity, transform: [{ translateY: z2Translate }] },
          ]}>
            Z
          </Animated.Text>
        </>
      )}

      {/* Main mascot body */}
      <Animated.View style={[
        styles.mascot,
        {
          transform: [
            { translateY },
            { rotate: rotateDeg },
            { scale },
          ],
        },
      ]}>
        {/* Body (tilted separately so rotation keeps correct center) */}
        <Animated.View style={{ transform: [{ rotate: tiltDeg }], alignItems: 'center' }}>

          {/* === TAIL FEATHERS === */}
          <View style={[styles.tailRow, { marginBottom: -s * 0.06 }]}>
            {/* Left feathers */}
            <Text style={[styles.feather, { fontSize: s * 0.28, transform: [{ rotate: '-50deg' }], color: '#10B981' }]}>🪶</Text>
            <Text style={[styles.feather, { fontSize: s * 0.32, transform: [{ rotate: '-25deg' }], color: '#3B82F6' }]}>🪶</Text>
            {/* Center tall feather */}
            <Text style={[styles.feather, { fontSize: s * 0.36, color: '#8B5CF6' }]}>🪶</Text>
            {/* Right feathers */}
            <Text style={[styles.feather, { fontSize: s * 0.32, transform: [{ rotate: '25deg' }],  color: '#3B82F6' }]}>🪶</Text>
            <Text style={[styles.feather, { fontSize: s * 0.28, transform: [{ rotate: '50deg' }],  color: '#10B981' }]}>🪶</Text>
          </View>

          {/* Eye ocelli (decorative circles on feathers) */}
          <View style={[styles.ocolliRow, { width: s * 0.9, marginBottom: -s * 0.04 }]}>
            <View style={[styles.ocellus, { width: s*0.13, height: s*0.13, borderRadius: s*0.065, backgroundColor: '#60A5FA' }]} />
            <View style={[styles.ocellus, { width: s*0.16, height: s*0.16, borderRadius: s*0.08,  backgroundColor: '#818CF8' }]} />
            <View style={[styles.ocellus, { width: s*0.13, height: s*0.13, borderRadius: s*0.065, backgroundColor: '#60A5FA' }]} />
          </View>

          {/* === BODY === */}
          <View style={[
            styles.body,
            {
              width: s * 0.55,
              height: s * 0.48,
              borderRadius: s * 0.24,
              backgroundColor: '#1E3A5F',
            },
          ]}>
            {/* Belly highlight */}
            <View style={[
              styles.belly,
              {
                width: s * 0.30,
                height: s * 0.28,
                borderRadius: s * 0.15,
                backgroundColor: '#3B82F6',
                top: s * 0.10,
              },
            ]} />
          </View>

          {/* === NECK === */}
          <View style={[styles.neck, {
            width: s * 0.18,
            height: s * 0.16,
            backgroundColor: '#10B981',
            borderRadius: s * 0.09,
            marginTop: -s * 0.06,
          }]} />

          {/* === HEAD === */}
          <View style={[styles.head, {
            width: s * 0.38,
            height: s * 0.36,
            borderRadius: s * 0.19,
            backgroundColor: '#1E3A5F',
            marginTop: -s * 0.08,
          }]}>
            {/* Crest */}
            <View style={styles.crestRow}>
              <Text style={{ fontSize: s * 0.10, marginTop: -s * 0.14, color: '#60A5FA' }}>●</Text>
              <Text style={{ fontSize: s * 0.13, marginTop: -s * 0.18, color: '#818CF8' }}>●</Text>
              <Text style={{ fontSize: s * 0.10, marginTop: -s * 0.14, color: '#60A5FA' }}>●</Text>
            </View>

            {/* Eyes */}
            <View style={styles.eyeRow}>
              <Animated.View style={[
                styles.eye,
                {
                  width: s * 0.10,
                  height: s * 0.10,
                  borderRadius: s * 0.05,
                  transform: [{ scaleY: eyeScale }],
                },
              ]}>
                <View style={[styles.pupil, { width: s*0.05, height: s*0.05, borderRadius: s*0.025 }]} />
                <View style={[styles.eyeShine, { width: s*0.025, height: s*0.025, top: s*0.01, right: s*0.01 }]} />
              </Animated.View>

              <Animated.View style={[
                styles.eye,
                {
                  width: s * 0.10,
                  height: s * 0.10,
                  borderRadius: s * 0.05,
                  transform: [{ scaleY: eyeScale }],
                },
              ]}>
                <View style={[styles.pupil, { width: s*0.05, height: s*0.05, borderRadius: s*0.025 }]} />
                <View style={[styles.eyeShine, { width: s*0.025, height: s*0.025, top: s*0.01, right: s*0.01 }]} />
              </Animated.View>
            </View>

            {/* Beak */}
            <View style={[styles.beak, {
              width: s * 0.10,
              height: s * 0.07,
              borderRadius: s * 0.035,
              backgroundColor: '#F59E0B',
              marginTop: s * 0.02,
            }]} />

            {/* Expression overlay for sad state */}
            {state === 'sad' && (
              <Text style={[styles.sadMark, { fontSize: s * 0.12, bottom: s * 0.02 }]}>〜</Text>
            )}
          </View>

          {/* === FEET === */}
          <View style={styles.feetRow}>
            <Text style={{ fontSize: s * 0.14, color: '#F59E0B' }}>🦶</Text>
            <Text style={{ fontSize: s * 0.14, color: '#F59E0B' }}>🦶</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Shadow */}
      <View style={[styles.shadow, { width: s * 0.4, height: s * 0.05, borderRadius: s * 0.025, opacity: 0.15 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mascot: {
    alignItems: 'center',
  },
  tailRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  feather: {
    lineHeight: undefined,
  },
  ocolliRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  ocellus: {
    borderWidth: 2,
    borderColor: '#1E3A5F',
  },
  body: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  belly: {
    position: 'absolute',
  },
  neck: {},
  head: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  crestRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    position: 'absolute',
    top: 0,
  },
  eyeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  eye: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pupil: {
    backgroundColor: '#1E3A5F',
  },
  eyeShine: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
  },
  beak: {},
  sadMark: {
    position: 'absolute',
    color: '#3B82F6',
    fontWeight: '900',
  },
  feetRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  shadow: {
    backgroundColor: '#000000',
    marginTop: 4,
  },
  zParticle: {
    position: 'absolute',
    color: '#8B5CF6',
    fontWeight: '900',
  },
});
