import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, Animated, View as RNView, Modal, ActivityIndicator } from 'react-native';
import { Text, View } from './Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useSyncStore } from '../stores/useSyncStore';
import { useAuthStore } from '../stores/useAuthStore';

export default function SyncIndicator() {
  const syncState = useSyncStore((state) => state.syncState);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const isOnline = useSyncStore((state) => state.isOnline);
  const sync = useSyncStore((state) => state.sync);
  const session = useAuthStore((state) => state.session);

  const [modalVisible, setModalVisible] = useState(false);

  const spinAnim = useRef(new Animated.Value(0)).current;

  const tintCol = useThemeColor({}, 'tint');
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const textCol = useThemeColor({}, 'text');

  // Trigger spin animation when syncing
  useEffect(() => {
    if (syncState === 'syncing') {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [syncState]);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Render tiny badge details on the header
  const getBadgeConfig = () => {
    switch (syncState) {
      case 'syncing':
        return { emoji: '🔄', label: 'Syncing', color: '#3B82F6' };
      case 'offline':
        return { emoji: '☁️', label: 'Offline', color: '#9CA3AF' };
      case 'error':
        return { emoji: '⚠️', label: 'Error', color: '#F59E0B' };
      case 'idle':
      default:
        return { emoji: '☁️', label: 'Synced', color: '#10B981' };
    }
  };

  const badge = getBadgeConfig();

  // Guard: If there is no authenticated session, we do not show the sync indicator
  if (!session) return null;

  const handleManualSync = async () => {
    if (!isOnline) {
      alert('You are offline. Please reconnect to sync.');
      return;
    }
    await sync();
  };

  const formatLastSynced = () => {
    if (lastSyncedAt === 0) return 'Never';
    const date = new Date(lastSyncedAt);
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  return (
    <RNView style={styles.outerContainer}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setModalVisible(true)}
        style={[styles.triggerButton, { borderColor: borderCol, backgroundColor: cardCol }]}
      >
        {syncState === 'syncing' ? (
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Text style={styles.triggerEmoji}>🔄</Text>
          </Animated.View>
        ) : (
          <RNView style={styles.triggerBadgeRow}>
            <Text style={[styles.triggerEmoji, { color: badge.color }]}>{badge.emoji}</Text>
            <RNView style={[styles.statusDot, { backgroundColor: badge.color }]} />
          </RNView>
        )}
      </TouchableOpacity>

      {/* Sync Status Details Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <RNView style={styles.modalOverlay}>
          <RNView style={[styles.modalCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
            <RNView style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cloud Sync Status</Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </RNView>

            {/* Current Sync State Graphic */}
            <RNView style={styles.stateGraphicContainer}>
              {syncState === 'syncing' ? (
                <RNView style={styles.pulseContainer}>
                  <ActivityIndicator size="large" color={tintCol} />
                  <Text style={[styles.stateLabel, { color: tintCol, marginTop: 12 }]}>Synchronizing progress...</Text>
                </RNView>
              ) : (
                <RNView style={styles.graphicCenter}>
                  <Text style={[styles.largeGraphicEmoji, { textShadowColor: badge.color }]}>
                    {syncState === 'idle' ? '✅' : syncState === 'offline' ? '📴' : '⚠️'}
                  </Text>
                  <Text style={[styles.stateTextLabel, { color: badge.color }]}>
                    {badge.label.toUpperCase()}
                  </Text>
                </RNView>
              )}
            </RNView>

            {/* Info details */}
            <RNView style={[styles.infoSection, { borderColor: borderCol }]}>
              <RNView style={styles.infoRow}>
                <Text style={styles.infoKey}>Connection Status:</Text>
                <Text style={[styles.infoValue, { color: isOnline ? '#10B981' : '#EF4444', fontWeight: 'bold' }]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </RNView>
              <RNView style={styles.infoRow}>
                <Text style={styles.infoKey}>Last Cloud Sync:</Text>
                <Text style={[styles.infoValue, { color: textCol }]}>
                  {formatLastSynced()}
                </Text>
              </RNView>
            </RNView>

            <Text style={styles.descText}>
              Odia Boli works offline automatically. Any XP, lesson progress, or saved words earned while offline are stored on your device and will sync to the cloud once you reconnect.
            </Text>

            {/* Action buttons */}
            <RNView style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={syncState === 'syncing' || !isOnline}
                style={[
                  styles.syncNowButton,
                  {
                    backgroundColor: tintCol,
                    opacity: syncState === 'syncing' || !isOnline ? 0.6 : 1,
                  },
                ]}
                onPress={handleManualSync}
              >
                <Text style={styles.syncNowText}>Sync Now</Text>
              </TouchableOpacity>
            </RNView>
          </RNView>
        </RNView>
      </Modal>
    </RNView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  triggerButton: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.round,
    padding: Theme.spacing.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
  },
  triggerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  triggerEmoji: {
    fontSize: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    right: -4,
    bottom: -4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', // Slate 900 tint overlay
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.lg,
  },
  modalTitle: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  closeButton: {
    padding: 6,
  },
  closeText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: 'bold',
  },
  stateGraphicContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.lg,
  },
  pulseContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  stateLabel: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  graphicCenter: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  largeGraphicEmoji: {
    fontSize: 50,
    marginBottom: 8,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  stateTextLabel: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.heavy,
    letterSpacing: 1.5,
  },
  infoSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    backgroundColor: 'transparent',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xs,
    backgroundColor: 'transparent',
  },
  infoKey: {
    fontSize: Theme.typography.fontSize.sm - 1,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: Theme.typography.fontSize.sm - 1,
  },
  descText: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#6B7280',
    lineHeight: Theme.typography.lineHeight.xs + 2,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  modalActions: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  syncNowButton: {
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncNowText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
  },
});
