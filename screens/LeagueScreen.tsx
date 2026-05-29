import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View as RNView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useIsFocused } from '@react-navigation/native';
import { useAuthStore } from '../stores/useAuthStore';
import {
  getRealLeagueState,
  LeagueEntry,
  LeagueState,
  Tier,
  TIERS,
  TIER_COLORS,
  getDaysUntilReset,
  LeaderboardScope,
} from '../services/league';
import { useLeaderboardQuery } from '../hooks/useLeaderboardQuery';

const TIER_ICONS: Record<Tier, string> = {
  Bronze: '🥉',
  Silver: '🥈',
  Gold:   '🥇',
};

export default function LeagueScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const session = useAuthStore((state) => state.session);
  const isGuest = useAuthStore((state) => state.isGuest);
  const userId = session?.user?.id;

  const [selectedTier, setSelectedTier] = useState<Tier>('Bronze');
  const [scope, setScope] = useState<LeaderboardScope>('global');

  // React Query leaderboard fetcher with 5m caching & background updates
  const {
    data: state,
    isLoading: loading,
    isRefetching: refreshing,
    refetch,
  } = useLeaderboardQuery(scope);

  const daysLeft = getDaysUntilReset();

  const cardCol   = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol   = useThemeColor({}, 'tint');
  const textMutedCol = useThemeColor({}, 'textMuted');
  const backgroundCol = useThemeColor({}, 'background');

  // Sync selected tier when state changes/loads
  useEffect(() => {
    if (state?.userTier) {
      setSelectedTier(state.userTier);
    }
  }, [state?.userTier]);

  const handleScopeChange = (newScope: LeaderboardScope) => {
    setScope(newScope);
  };

  // ----------------------------------------------------
  // GUEST SCREEN FALLBACK
  // ----------------------------------------------------
  if (isGuest || !userId) {
    return (
      <View style={[styles.guestContainer, { backgroundColor: backgroundCol }]}>
        <RNView style={[styles.guestCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.guestIcon}>🏆</Text>
          <Text style={styles.guestTitle}>Join the Competitive Leagues</Text>
          <Text style={[styles.guestDesc, { color: textMutedCol }]}>
            Create an account or sign in to Odia Boli to compete with others, earn weekly XP, promote across Bronze, Silver, and Gold tiers, and check your rank globally or locally!
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Signup')}
            style={[styles.primaryButton, { backgroundColor: tintCol }]}
          >
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Login')}
            style={[styles.secondaryButton, { borderColor: borderCol }]}
          >
            <Text style={[styles.secondaryButtonText, { color: tintCol }]}>Log In</Text>
          </TouchableOpacity>
        </RNView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={tintCol} />
        <Text style={[styles.loadingText, { color: textMutedCol }]}>Loading league standings…</Text>
      </View>
    );
  }

  if (!state) return null;

  // Global scope shows list filtered by selected tier; Friends/City/India scopes show all tiers together
  const leaderboardEntries = scope === 'global'
    ? state.entries.filter(e => e.tier === selectedTier)
    : state.entries;

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

        {/* Scopes Navigation bar */}
        <RNView style={[styles.scopeBar, { backgroundColor: borderCol + '30', borderRadius: Theme.borderRadius.md }]}>
          {(['global', 'friends', 'city', 'india'] as LeaderboardScope[]).map((s) => {
            const isActive = scope === s;
            return (
              <TouchableOpacity
                key={s}
                activeOpacity={0.7}
                onPress={() => handleScopeChange(s)}
                style={[
                  styles.scopeTab,
                  isActive && { backgroundColor: cardCol, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, borderRadius: Theme.borderRadius.sm }
                ]}
              >
                <Text style={[
                  styles.scopeText,
                  { color: isActive ? tintCol : textMutedCol, fontWeight: isActive ? '800' : '600' }
                ]}>
                  {s === 'global' ? 'Global' : s === 'friends' ? 'Friends' : s === 'city' ? 'City' : 'India'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </RNView>

        {/* Tier tabs (Only show when scope is 'global' to allow browsing tiers) */}
        {scope === 'global' && (
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
        )}
      </RNView>

      {/* Leaderboard rows */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refetch()} tintColor={tintCol} />}
      >
        {leaderboardEntries.length === 0 && (
          <RNView style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>No players in this category yet.</Text>
          </RNView>
        )}

        {leaderboardEntries.map((entry, idx) => {
          const isPromoting = scope === 'global' && state.promotionIds.includes(entry.id);
          const isDemoting  = scope === 'global' && state.demotionIds.includes(entry.id);

          const rankStyle =
            entry.rank === 1 ? styles.rank1 :
            entry.rank === 2 ? styles.rank2 :
            entry.rank === 3 ? styles.rank3 : null;

          // Rank change calculation
          let rankChangeText = '—';
          let rankChangeColor = '#9CA3AF';
          
          if (entry.previousRank !== null && entry.previousRank !== undefined) {
            const diff = entry.previousRank - entry.rank;
            if (diff > 0) {
              rankChangeText = `↑${diff}`;
              rankChangeColor = '#10B981'; // Green
            } else if (diff < 0) {
              rankChangeText = `↓${Math.abs(diff)}`;
              rankChangeColor = '#EF4444'; // Red
            }
          } else {
            rankChangeText = 'New';
            rankChangeColor = tintCol;
          }

          return (
            <Animated.View
              key={entry.id}
              entering={FadeInDown.delay(idx * 30).duration(200)}
              layout={Layout.springify()}
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
                {/* Rank Badge */}
                <RNView style={[styles.rankBadge, rankStyle]}>
                  <Text style={[styles.rankText, rankStyle && styles.rankTextTop]}>
                    {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : `#${entry.rank}`}
                  </Text>
                </RNView>

                {/* Rank Change Indicator */}
                <RNView style={styles.rankChangeBadge}>
                  <Text style={[styles.rankChangeText, { color: rankChangeColor }]}>
                    {rankChangeText}
                  </Text>
                </RNView>

                {/* Avatar Symbol / Image */}
                {entry.avatar.startsWith('http') ? (
                  <Image source={{ uri: entry.avatar }} style={styles.avatarImage} />
                ) : (
                  <RNView style={[styles.avatarPlaceholder, { backgroundColor: tintCol + '15' }]}>
                    <Text style={styles.avatarText}>{entry.avatar}</Text>
                  </RNView>
                )}

                {/* Username details */}
                <RNView style={styles.nameCol}>
                  <Text style={[styles.name, entry.isUser && { color: tintCol, fontWeight: '800' }]}>
                    {entry.name}{entry.isUser ? '  (You)' : ''}
                  </Text>
                  {scope !== 'global' && (
                    <Text style={[styles.tierTagText, { color: TIER_COLORS[entry.tier].text }]}>
                      {TIER_ICONS[entry.tier]} {entry.tier} League
                    </Text>
                  )}
                  {isPromoting && (
                    <Text style={styles.promotionBadge}>Upgrade Zone ⬆</Text>
                  )}
                  {isDemoting && !isPromoting && (
                    <Text style={styles.demotionBadge}>Demotion Zone ⬇</Text>
                  )}
                </RNView>

                {/* XP Column */}
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
          🔄 Leagues are reset dynamically every Monday at midnight. Top 3 promote, bottom 3 demote. Standings sync in real-time.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },

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

  // Scope selectors styling
  scopeBar: {
    flexDirection: 'row',
    padding: 3,
    marginBottom: Theme.spacing.md,
  },
  scopeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeText: {
    fontSize: 12,
  },

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

  // Rank change indicator style
  rankChangeBadge: {
    width: 28,
    alignItems: 'center',
    marginRight: 2,
  },
  rankChangeText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // Avatars
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  nameCol: { flex: 1 },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  tierTagText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
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

  // Guest lock styling
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  guestCard: {
    width: '100%',
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.xl,
    alignItems: 'center',
  },
  guestIcon: {
    fontSize: 60,
    marginBottom: Theme.spacing.lg,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  guestDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Theme.spacing.xl,
    paddingHorizontal: 10,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
