import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View as RNView, Alert } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useProgressStore, HistoryEntry } from '../stores/useProgressStore';
import { SwipeableItem } from '../components/SwipeableItem';

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const history = useProgressStore((state) => state.translationHistory);

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');

  useEffect(() => {
    if (isFocused) {
      useProgressStore.getState().loadProgress().catch(console.error);
    }
  }, [isFocused]);

  const handleDelete = async (id: string) => {
    await useProgressStore.getState().deleteHistoryItem(id);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all translation history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await useProgressStore.getState().clearHistory();
          },
        },
      ]
    );
  };

  // Configure navigation header Right action dynamically based on list presence
  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        history.length > 0 ? (
          <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7} style={styles.clearHeaderButton}>
            <Text style={[styles.clearHeaderText, { color: tintCol }]}>Clear All</Text>
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, history, tintCol]);

  const renderHistoryItem = ({ item }: { item: HistoryEntry }) => (
    <SwipeableItem onDelete={() => handleDelete(item.id)} cardBg={cardCol} borderCol={borderCol}>
      <RNView style={styles.cardHeader}>
        <Text style={styles.timestampText}>{formatTimestamp(item.timestamp)}</Text>
      </RNView>
      <Text style={styles.odiaText}>{item.odia}</Text>
      <Text style={styles.englishText}>{item.english}</Text>
    </SwipeableItem>
  );

  return (
    <View style={styles.container}>
      {history.length > 0 ? (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <RNView style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyTitle}>Your History is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Translations you perform in the Translate tab will be listed here.
          </Text>
        </RNView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Theme.spacing.xl,
    paddingBottom: 40,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Theme.spacing.xs,
  },
  timestampText: {
    fontSize: Theme.typography.fontSize.xs - 2,
    color: '#9CA3AF',
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  odiaText: {
    fontSize: Theme.typography.fontSize.lg,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.xs,
  },
  englishText: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
    lineHeight: Theme.typography.lineHeight.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Theme.spacing.md,
  },
  emptyTitle: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeight.sm,
  },
  clearHeaderButton: {
    marginRight: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearHeaderText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
  },
});
