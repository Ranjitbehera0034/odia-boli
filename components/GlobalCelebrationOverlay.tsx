import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
  View as RNView,
} from 'react-native';
import { Text, View } from './Themed';
import LottieView from 'lottie-react-native';
import { useUserStore } from '../stores/useUserStore';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

const { width, height } = Dimensions.get('window');

interface ClubInfo {
  title: string;
  badge: string;
  emoji: string;
  color: string;
  desc: string;
}

const CLUB_INFOS: Record<number, ClubInfo> = {
  7: {
    title: 'Beginner Club',
    badge: 'streak_club_7',
    emoji: '🏃',
    color: '#3B82F6',
    desc: 'You have entered the first rank of consistency! Keep walking!',
  },
  30: {
    title: 'Committed Club',
    badge: 'streak_club_30',
    emoji: '🧗',
    color: '#10B981',
    desc: '30 Days of dedication! You are forming a powerful daily habit!',
  },
  100: {
    title: 'Dedicated Club',
    badge: 'streak_club_100',
    emoji: '🛡️',
    color: '#8B5CF6',
    desc: 'Unstoppable! 100 days of preserving and learning Odia!',
  },
  365: {
    title: 'Legend Club',
    badge: 'streak_club_365',
    emoji: '👑',
    color: '#F59E0B',
    desc: 'Absolute Legend! A full year of daily Odia devotion! 🌟',
  },
};

export default function GlobalCelebrationOverlay() {
  const activeMilestone = useUserStore((state) => state.activeCelebrationMilestone);
  const setCelebration = useUserStore((state) => state.setCelebrationMilestone);
  const username = useUserStore((state) => state.username);
  const avatarUrl = useUserStore((state) => state.avatarUrl);
  const level = useUserStore((state) => state.level);

  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<RNView>(null);

  const tintCol = useThemeColor({}, 'tint');
  const cardCol = useThemeColor({}, 'card');

  if (activeMilestone === null || !CLUB_INFOS[activeMilestone]) {
    return null;
  }

  const club = CLUB_INFOS[activeMilestone];

  const handleShare = async () => {
    if (!cardRef.current) return;
    setSharing(true);

    try {
      // Capture the card View as a PNG image
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 0.95,
      });

      // Check if sharing is available on device
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Share my ${activeMilestone}-Day Streak!`,
        });
      } else {
        Alert.alert('Sharing Unavailable 📲', 'Sharing is not supported on this device.');
      }
    } catch (error) {
      console.error('Failed to generate or share streak card:', error);
      Alert.alert('Error ⚠️', 'Failed to generate or share your streak milestone card.');
    } finally {
      setSharing(false);
    }
  };

  const handleDismiss = () => {
    setCelebration(null);
  };

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (username) return username.charAt(0).toUpperCase();
    return '🧑🏽';
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={activeMilestone !== null}
      onRequestClose={handleDismiss}
    >
      <RNView style={styles.overlay}>
        {/* Confetti & Star animations layer */}
        <LottieView
          source={require('../assets/animations/confetti.json')}
          autoPlay
          loop={true}
          style={styles.fullscreenAnimation}
          resizeMode="cover"
        />
        <LottieView
          source={require('../assets/animations/stars.json')}
          autoPlay
          loop={true}
          style={styles.fullscreenAnimation}
          resizeMode="contain"
        />

        <RNView style={styles.scrollContainer}>
          {/* Congrats Title */}
          <Text style={styles.congratsTitle}>CONGRATULATIONS!</Text>
          <Text style={styles.congratsSubtitle}>You unlocked a new Milestone Club</Text>

          {/* ──────────────── SHARE CARD PREVIEW ──────────────── */}
          {/* This is the card view we take screenshot of */}
          <RNView
            ref={cardRef}
            style={[styles.shareCard, { backgroundColor: '#111827' }]}
            collapsable={false}
          >
            {/* Top branding bar */}
            <RNView style={styles.cardHeader}>
              <Text style={styles.cardBrandingText}>Odia Boli App</Text>
              <RNView style={styles.brandingDot} />
              <Text style={styles.cardLanguageText}>Odia Learning</Text>
            </RNView>

            {/* Cultural peacock feather background graphic or stylized overlay */}
            <RNView style={styles.cardMain}>
              {/* Badge visual */}
              <RNView style={[styles.badgeContainer, { borderColor: club.color }]}>
                <Text style={styles.badgeEmoji}>{club.emoji}</Text>
              </RNView>

              {/* Streak Big Days */}
              <Text style={[styles.daysCountText, { color: club.color }]}>
                {activeMilestone} DAYS
              </Text>
              <Text style={styles.streakLabelText}>ACTIVE STREAK</Text>

              <Text style={styles.clubTitle}>{club.title} Member</Text>
              <Text style={styles.clubDesc}>{club.desc}</Text>
            </RNView>

            {/* Divider */}
            <RNView style={styles.cardDivider} />

            {/* Bottom Profile section */}
            <RNView style={styles.cardFooter}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
              ) : (
                <RNView style={[styles.avatarFallback, { backgroundColor: club.color + '30' }]}>
                  <Text style={[styles.avatarFallbackText, { color: club.color }]}>
                    {getInitials()}
                  </Text>
                </RNView>
              )}
              <RNView style={styles.profileDetails}>
                <Text style={styles.profileUsername}>{username || 'Odia Learner'}</Text>
                <Text style={styles.profileLevel}>Level {level} Explorer</Text>
              </RNView>

              <RNView style={styles.qrMockPlaceholder}>
                <Text style={styles.qrIcon}>📱</Text>
                <Text style={styles.qrText}>Join Me</Text>
              </RNView>
            </RNView>
          </RNView>

          {/* ──────────────── ACTION BUTTONS ──────────────── */}
          <RNView style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleShare}
              disabled={sharing}
              style={[styles.shareButton, { backgroundColor: tintCol }]}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.shareButtonText}>Share Streak Card 📲</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleDismiss}
              style={[styles.dismissButton, { borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1.5 }]}
            >
              <Text style={styles.dismissButtonText}>Continue</Text>
            </TouchableOpacity>
          </RNView>
        </RNView>
      </RNView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenAnimation: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    pointerEvents: 'none',
  },
  scrollContainer: {
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  congratsTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FBBF24',
    letterSpacing: 2.0,
    textAlign: 'center',
    textShadowColor: 'rgba(251, 191, 36, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  congratsSubtitle: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 24,
    textAlign: 'center',
  },
  // Share Card styling
  shareCard: {
    width: width - 48,
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 2,
    borderColor: '#374151',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginBottom: 20,
    gap: 8,
  },
  cardBrandingText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#EF4444',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  brandingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4B5563',
  },
  cardLanguageText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  cardMain: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 20,
  },
  badgeContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  badgeEmoji: {
    fontSize: 42,
  },
  daysCountText: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 1.0,
  },
  streakLabelText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 2.0,
    marginTop: 2,
  },
  clubTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F9FAFB',
    marginTop: 16,
  },
  clubDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#4B5563',
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 15,
    fontWeight: '800',
  },
  profileDetails: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: 'transparent',
  },
  profileUsername: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F3F4F6',
  },
  profileLevel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 2,
  },
  qrMockPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#374151',
  },
  qrIcon: {
    fontSize: 13,
  },
  qrText: {
    fontSize: 7,
    color: '#9CA3AF',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 1,
  },
  // Buttons
  actionRow: {
    width: '100%',
    maxWidth: 340,
    gap: 12,
    marginTop: 32,
    backgroundColor: 'transparent',
  },
  shareButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  dismissButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dismissButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
