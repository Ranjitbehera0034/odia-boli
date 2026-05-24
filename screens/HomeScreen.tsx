import React, { useEffect, useState } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, View as RNView } from 'react-native';
import { Text, View } from '../components/Themed';
import { fetchOdiaItems, OdiaItem } from '../services/api';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { HomeScreenNavigationProp } from '../navigation/types';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { logActivity } from '../services/streak';
import { getDueCount } from '../services/srs';
import { getUserProfile } from '../services/curriculum';

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<OdiaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueCount, setDueCount] = useState(0);
  const [totalXp, setTotalXp] = useState(0);

  const cardBackground = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');

  useEffect(() => {
    logActivity().catch(console.error);
    fetchOdiaItems().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isFocused) {
      getDueCount().then(setDueCount).catch(console.error);
      
      // Load XP from SQLite user profile
      getUserProfile()
        .then((profile) => setTotalXp(profile.xp))
        .catch(console.error);
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
      <RNView style={styles.header}>
        <RNView style={styles.titleRow}>
          <Text style={styles.title}>Odia Agent</Text>
          <RNView style={[styles.xpBadge, { backgroundColor: '#FBBF2415', borderColor: '#FBBF24' }]}>
            <Text style={styles.xpText}>🏆 {totalXp} XP</Text>
          </RNView>
        </RNView>
        <Text style={styles.subtitle}>Explore the rich history, art, and heritage of Odisha.</Text>

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
});
