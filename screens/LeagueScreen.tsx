import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View as RNView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useIsFocused } from '@react-navigation/native';
import {
  getLeagueState,
  LeagueEntry,
  LeagueState,
  Tier,
  TIERS,
  TIER_COLORS,
  getDaysUntilReset,
} from '../services/league';

const TIER_ICONS: Record<Tier, string> = {
  Bronze: '🥉',
  Silver: '🥈',
  Gold:   '🥇',
};

export default function LeagueScreen() {
  const isFocused = useIsFocused();
  const [state, setState] = useState<LeagueState | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier>('Bronze');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const daysLeft = getDaysUntilReset();

  const cardCol   = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol   = useThemeColor({}, 'tint');

  // Row slide-in animations
  const rowAnims = useRef<Animated.Value[]>(
    Array.from({ length: 10 }, () => new Animated.Value(40))
  ).current;
  const rowOpacities = useRef<Animated.Value[]>(
    Array.from({ length: 10 }, () => new Animated.Value(0))
  ).current;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await getLeagueState();
      setState(data);
      setSelectedTier(data.userTier);

      // Animate rows in
      rowAnims.forEach(a => a.setValue(40));
      rowOpacities.forEach(a => a.setValue(0));
      Animated.stagger(
        55,
        rowAnims.map((anim, i) =>
          Animated.parallel([
            Animated.spring(anim, { toValue: 0, useNativeDriver: true, friction: 7 }),
            Animated.timing(rowOpacities[i], { toValue: 1, duration: 220, useNativeDriver: true }),
          ])
        )
      ).start();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) load();
  }, [isFocused]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={tintCol} />
        <Text style={styles.loadingText}>Loading league…</Text>
      </View>
    );
  }

  if (!state) return null;

  const tierEntries = state.entries.filter(e => e.tier === selectedTier);

  return (
    <View style={styles.container}>
      {/* Header */}
      <RNView style={[styles.header, { borderBottomColor: borderCol }]}>
        <RNView style={styles.headerTop}>
          <Text style={styles.headerTitle}>🏟️ Weekly League</Text>
          <RNView style={[styles.resetPill, { backgroundColor: tintCol + '15', borderColor: tintCol + '40' }]}>
            <Text style={[styles.resetText, { color: tintCol }]}>
              Resets in {daysLeft}d
            </Text>
          </RNView>
        </RNView>

        {/* Current Tier badge */}
        <RNView style={[
          styles.myTierBadge,
          { backgroundColor: TIER_COLORS[state.userTier].bg, borderColor: TIER_COLORS[state.userTier].border },
        ]}>
          <Text style={styles.myTierEmoji}>{TIER_ICONS[state.userTier]}</Text>
          <RNView>
            <Text style={[styles.myTierLabel, { color: TIER_COLORS[state.userTier].text }]}>
              Your Tier
            </Text>
            <Text style={[styles.myTierName, { color: TIER_COLORS[state.userTier].text }]}>
              {state.userTier} League
            </Text>
          </RNView>
          <RNView style={styles.promotionKey}>
            <Text style={styles.promotionKeyText}>⬆ Top 3 promote</Text>
            <Text style={styles.promotionKeyText}>⬇ Bottom 3 demote</Text>
          </RNView>
        </RNView>

        {/* Tier tabs */}
        <RNView style={styles.tierTabs}>
          {TIERS.map(tier => {
            const isActive = tier === selectedTier;
            const colors = TIER_COLORS[tier];
            return (
              <TouchableOpacity
                key={tier}
                activeOpacity={0.75}
                onPress={() => setSelectedTier(tier)}
                style={[
                  styles.tierTab,
                  {
                    backgroundColor: isActive ? colors.bg : 'transparent',
                    borderColor: isActive ? colors.border : borderCol,
                  },
                ]}
              >
                <Text style={styles.tierTabIcon}>{TIER_ICONS[tier]}</Text>
                <Text style={[styles.tierTabLabel, { color: isActive ? colors.text : '#6B7280' }]}>
                  {tier}
                </Text>
              </TouchableOpacity>
            );
          })}
        </RNView>
      </RNView>

      {/* Leaderboard rows */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tintCol} />}
      >
        {tierEntries.length === 0 && (
          <RNView style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>No players in this tier yet.</Text>
          </RNView>
        )}

        {tierEntries.map((entry, idx) => {
          const globalRank = state.entries.findIndex(e => e.id === entry.id);
          const isPromoting = state.promotionIds.includes(entry.id);
          const isDemoting  = state.demotionIds.includes(entry.id);
          const animIdx     = Math.min(globalRank, rowAnims.length - 1);

          const rankStyle =
            entry.rank === 1 ? styles.rank1 :
            entry.rank === 2 ? styles.rank2 :
            entry.rank === 3 ? styles.rank3 : null;

          return (
            <Animated.View
              key={entry.id}
              style={{
                opacity: rowOpacities[animIdx],
                transform: [{ translateY: rowAnims[animIdx] }],
              }}
            >
              <RNView
                style={[
                  styles.row,
                  {
                    backgroundColor: entry.isUser
                      ? tintCol + '12'
                      : cardCol,
                    borderColor: entry.isUser ? tintCol + '50' : borderCol,
                    borderWidth: entry.isUser ? 1.5 : 1,
                  },
                ]}
              >
                {/* Rank */}
                <RNView style={[styles.rankBadge, rankStyle]}>
                  <Text style={[styles.rankText, rankStyle && styles.rankTextTop]}>
                    {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : `#${entry.rank}`}
                  </Text>
                </RNView>

                {/* Avatar + Name */}
                <Text style={styles.avatar}>{entry.avatar}</Text>
                <RNView style={styles.nameCol}>
                  <Text style={[styles.name, entry.isUser && { color: tintCol, fontWeight: '800' }]}>
                    {entry.name}{entry.isUser ? '  (You)' : ''}
                  </Text>
                  {isPromoting && (
                    <Text style={styles.promotionBadge}>⬆ Promotion Zone</Text>
                  )}
                  {isDemoting && !isPromoting && (
                    <Text style={styles.demotionBadge}>⬇ Demotion Zone</Text>
                  )}
                </RNView>

                {/* XP */}
                <RNView style={styles.xpCol}>
                  <Text style={[styles.xpValue, entry.isUser && { color: tintCol }]}>
                    {entry.weeklyXp.toLocaleString()}
                  </Text>
                  <Text style={styles.xpLabel}>XP</Text>
                </RNView>
              </RNView>
            </Animated.View>
          );
        })}

        <Text style={styles.footerNote}>
          🔄 League resets every Monday at midnight. Top 3 promote, bottom 3 demote.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },

  header: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.md,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  headerTitle: {
    fontSize: Theme.typography.fontSize.xl,
    fontWeight: Theme.typography.fontWeight.heavy,
  },
  resetPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  resetText: {
    fontSize: 11,
    fontWeight: '700',
  },

  myTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    gap: 12,
  },
  myTierEmoji: { fontSize: 32 },
  myTierLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  myTierName:  { fontSize: 16, fontWeight: '800' },
  promotionKey: { marginLeft: 'auto', alignItems: 'flex-end' },
  promotionKeyText: { fontSize: 10, color: '#6B7280', marginBottom: 2 },

  tierTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  tierTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 8,
  },
  tierTabIcon: { fontSize: 14 },
  tierTabLabel: { fontSize: 12, fontWeight: '700' },

  listContent: {
    padding: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    gap: 8,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  rankBadge: {
    width: 32,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  rank1: {},
  rank2: {},
  rank3: {},
  rankTextTop: { fontSize: 18 },

  avatar: { fontSize: 28 },

  nameCol: { flex: 1 },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  promotionBadge: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '700',
    marginTop: 2,
  },
  demotionBadge: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '700',
    marginTop: 2,
  },

  xpCol: { alignItems: 'flex-end' },
  xpValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#374151',
  },
  xpLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText:  { fontSize: 14, color: '#6B7280' },

  footerNote: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    paddingBottom: 8,
    lineHeight: 17,
  },
});
