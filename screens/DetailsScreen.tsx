import React, { useEffect, useState } from 'react';
import { StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, View as RNView } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { fetchOdiaItemById, OdiaItem } from '../services/api';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';

type DetailsScreenRouteProp = RouteProp<RootStackParamList, 'Details'>;

export default function DetailsScreen() {
  const route = useRoute<DetailsScreenRouteProp>();
  const navigation = useNavigation();
  const { itemId } = route.params;

  const [item, setItem] = useState<OdiaItem | null>(null);
  const [loading, setLoading] = useState(true);

  const tintCol = useThemeColor({}, 'tint');
  const borderCol = useThemeColor({}, 'border');
  const cardCol = useThemeColor({}, 'card');

  useEffect(() => {
    fetchOdiaItemById(itemId).then((data) => {
      setItem(data || null);
      setLoading(false);
    });
  }, [itemId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tintCol} />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Item not found</Text>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: tintCol }]} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <RNView style={[styles.badge, { backgroundColor: tintCol + '15' }]}>
        <Text style={[styles.badgeText, { color: tintCol }]}>{item.category.toUpperCase()}</Text>
      </RNView>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>

      <RNView style={[styles.divider, { backgroundColor: borderCol }]} />

      <RNView style={[styles.contentCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <Text style={styles.contentText}>{item.content}</Text>
      </RNView>

      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.backButton, { backgroundColor: tintCol }]}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Back to List</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  errorText: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.semibold,
    marginBottom: Theme.spacing.lg,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs + 2,
    borderRadius: Theme.borderRadius.sm,
    marginBottom: Theme.spacing.md,
  },
  badgeText: {
    fontSize: Theme.typography.fontSize.xs - 1,
    fontWeight: Theme.typography.fontWeight.bold,
    letterSpacing: 1,
  },
  title: {
    fontSize: Theme.typography.fontSize.xxl,
    fontWeight: Theme.typography.fontWeight.heavy,
    lineHeight: Theme.typography.lineHeight.xxl,
    marginBottom: Theme.spacing.md,
  },
  description: {
    fontSize: Theme.typography.fontSize.md,
    color: '#6B7280',
    lineHeight: Theme.typography.lineHeight.md,
    marginBottom: Theme.spacing.xl,
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: Theme.spacing.xl,
  },
  contentCard: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxl,
  },
  contentText: {
    fontSize: Theme.typography.fontSize.md - 1,
    lineHeight: Theme.typography.lineHeight.md,
  },
  backButton: {
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
});
