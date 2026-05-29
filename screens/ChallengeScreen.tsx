import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  Animated,
  View as RNView,
} from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/useAuthStore';
import {
  getChallengeDetails,
  subscribeToProfiles,
  subscribeToUserChallenges,
  checkAndExpireChallenges,
  XPChallenge,
} from '../services/challenges';
import { showLocalNotification } from '../services/notifications';

const { width } = Dimensions.get('window');

export default function ChallengeScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { challengeId } = route.params;
  const session = useAuthStore((state) => state.session);
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<XPChallenge | null>(null);

  // Live profile XP trackers
  const [challengerXP, setChallengerXP] = useState<number>(0);
  const [challengeeXP, setChallengeeXP] = useState<number>(0);

  // Countdown timer string
  const [timeLeft, setTimeLeft] = useState('');

  // Animation values
  const challengerWidthAnim = useRef(new Animated.Value(50)).current;

  // Lead transition tracking
  const previousLeadRef = useRef<'user' | 'friend' | 'tie' | null>(null);

  // Colors
  const backgroundCol = useThemeColor({}, 'background');
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');
  const textMutedCol = useThemeColor({}, 'textMuted');

  // Core load function
  const loadChallengeData = async (isRealtimeUpdate = false) => {
    if (!userId || !challengeId) return;
    if (!isRealtimeUpdate) setLoading(true);

    try {
      // 1. Expire check
      await checkAndExpireChallenges(userId);

      // 2. Fetch details
      const data = await getChallengeDetails(challengeId);
      if (!data) {
        Alert.alert('Not Found ⚠️', 'This challenge could not be retrieved.');
        navigation.goBack();
        return;
      }

      setChallenge(data);
      setChallengerXP(data.challenger?.xp || 0);
      setChallengeeXP(data.challengee?.xp || 0);
    } catch (e) {
      console.error('Failed to load challenge details:', e);
    } finally {
      if (!isRealtimeUpdate) setLoading(false);
    }
  };

  // Initial load & main subscriptions
  useEffect(() => {
    loadChallengeData();

    // 1. Subscribe to changes in the challenge record itself
    const challengeSub = subscribeToUserChallenges(userId || '', () => {
      loadChallengeData(true);
    });

    return () => {
      challengeSub.unsubscribe();
    };
  }, [challengeId, userId]);

  // 2. Subscribe to profile XP changes when challenger/challengee IDs are loaded
  useEffect(() => {
    if (!challenge) return;

    const userIds = [challenge.challenger_id, challenge.challengee_id];
    const profilesSub = subscribeToProfiles(userIds, (updatedProfile) => {
      if (updatedProfile.id === challenge.challenger_id) {
        setChallengerXP(updatedProfile.xp || 0);
      } else if (updatedProfile.id === challenge.challengee_id) {
        setChallengeeXP(updatedProfile.xp || 0);
      }
    });

    return () => {
      profilesSub.unsubscribe();
    };
  }, [challenge?.challenger_id, challenge?.challengee_id]);

  // 3. XP calculation & progress bar animations
  const challengerStartXP = challenge?.parameters?.challenger_start_xp || 0;
  const challengeeStartXP = challenge?.parameters?.challengee_start_xp || 0;

  const challengerEarned = Math.max(0, challengerXP - challengerStartXP);
  const challengeeEarned = Math.max(0, challengeeXP - challengeeStartXP);
  const totalEarned = challengerEarned + challengeeEarned;

  const targetPercent = totalEarned === 0 ? 50 : (challengerEarned / totalEarned) * 100;

  useEffect(() => {
    Animated.timing(challengerWidthAnim, {
      toValue: targetPercent,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [targetPercent]);

  // 4. Lead comparison and push notifications trigger
  const isCurrentUserChallenger = challenge?.challenger_id === userId;
  const userGained = isCurrentUserChallenger ? challengerEarned : challengeeEarned;
  const friendGained = isCurrentUserChallenger ? challengeeEarned : challengerEarned;

  useEffect(() => {
    if (!challenge || challenge.status !== 'accepted') return;

    let currentLead: 'user' | 'friend' | 'tie' = 'tie';
    if (userGained > friendGained) {
      currentLead = 'user';
    } else if (friendGained > userGained) {
      currentLead = 'friend';
    }

    if (previousLeadRef.current !== null && previousLeadRef.current !== 'friend' && currentLead === 'friend') {
      const opponentName = isCurrentUserChallenger ? challenge.challengee?.username : challenge.challenger?.username;
      showLocalNotification(
        "Friend took the lead! ⚔️",
        `Your opponent ${opponentName || 'Friend'} is now ahead by ${friendGained - userGained} XP! Earn some XP to reclaim the lead.`
      );
    }

    previousLeadRef.current = currentLead;
  }, [userGained, friendGained, challenge]);

  // 5. Countdown timer interval
  useEffect(() => {
    if (!challenge) return;

    if (challenge.status === 'completed' || challenge.status === 'expired') {
      setTimeLeft('Completed');
      return;
    }

    const updateTimer = () => {
      const difference = new Date(challenge.expires_at).getTime() - Date.now();
      if (difference <= 0) {
        setTimeLeft('Expired / Processing...');
        loadChallengeData(true);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [challenge]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: backgroundCol }]}>
        <ActivityIndicator size="large" color={tintCol} />
        <Text style={[styles.loadingText, { color: textMutedCol }]}>Loading battle details...</Text>
      </View>
    );
  }

  if (!challenge) return null;

  const opponent = isCurrentUserChallenger ? challenge.challengee : challenge.challenger;
  const userProfile = isCurrentUserChallenger ? challenge.challenger : challenge.challengee;

  return (
    <ScrollView style={[styles.container, { backgroundColor: backgroundCol }]} contentContainerStyle={styles.scrollContent}>
      {/* ─── STATUS CARD ─── */}
      <RNView style={[styles.statusCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <Text style={styles.statusBadge}>⚔️ 7-DAY XP BATTLE</Text>
        <Text style={styles.statusTitle}>
          {challenge.status === 'pending'
            ? 'Waiting for Accept'
            : challenge.status === 'completed'
            ? 'Battle Ended!'
            : 'Battle is Active!'}
        </Text>
        {challenge.status === 'accepted' && (
          <RNView style={styles.timerRow}>
            <Text style={[styles.timerLabel, { color: textMutedCol }]}>Time Remaining:</Text>
            <Text style={[styles.timerValue, { color: tintCol }]}>{timeLeft}</Text>
          </RNView>
        )}
        {challenge.status === 'completed' && (
          <RNView style={styles.winnerBlock}>
            {challenge.winner_id === userId ? (
              <Text style={styles.winnerText}>🏆 You won the Battle! Trophy Badge awarded! 🎉</Text>
            ) : challenge.winner_id ? (
              <Text style={[styles.winnerText, { color: '#EF4444' }]}>
                💀 {opponent?.username || 'Friend'} won the Battle. Better luck next time!
              </Text>
            ) : (
              <Text style={[styles.winnerText, { color: textMutedCol }]}>🤝 The battle ended in a tie!</Text>
            )}
          </RNView>
        )}
      </RNView>

      {/* ─── VERSUS ROW ─── */}
      <RNView style={styles.versusContainer}>
        {/* User Card */}
        <RNView style={[styles.playerCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          {userProfile?.avatar_url ? (
            <Image source={{ uri: userProfile.avatar_url }} style={styles.playerAvatar} />
          ) : (
            <RNView style={[styles.playerAvatarPlaceholder, { backgroundColor: tintCol + '15' }]}>
              <Text style={styles.playerAvatarEmoji}>🦚</Text>
            </RNView>
          )}
          <Text style={styles.playerName} numberOfLines={1}>
            {userProfile?.username || 'You'}
          </Text>
          <Text style={[styles.playerSub, { color: textMutedCol }]}>YOU</Text>
          <Text style={[styles.earnedXPText, { color: tintCol }]}>+{userGained} XP</Text>
          <Text style={[styles.earnedXPLabel, { color: textMutedCol }]}>earned</Text>
        </RNView>

        {/* VS Indicator */}
        <RNView style={styles.vsCircle}>
          <Text style={styles.vsText}>VS</Text>
        </RNView>

        {/* Opponent Card */}
        <RNView style={[styles.playerCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          {opponent?.avatar_url ? (
            <Image source={{ uri: opponent.avatar_url }} style={styles.playerAvatar} />
          ) : (
            <RNView style={[styles.playerAvatarPlaceholder, { backgroundColor: '#2196F315' }]}>
              <Text style={styles.playerAvatarEmoji}>🐨</Text>
            </RNView>
          )}
          <Text style={styles.playerName} numberOfLines={1}>
            {opponent?.username || 'Opponent'}
          </Text>
          <Text style={[styles.playerSub, { color: textMutedCol }]}>FRIEND</Text>
          <Text style={[styles.earnedXPText, { color: '#2196F3' }]}>+{friendGained} XP</Text>
          <Text style={[styles.earnedXPLabel, { color: textMutedCol }]}>earned</Text>
        </RNView>
      </RNView>

      {/* ─── ANIMATED SPLIT PROGRESS BAR ─── */}
      <RNView style={styles.progressBarSection}>
        <Text style={styles.progressHeading}>Battle XP Split</Text>
        <RNView style={[styles.progressBarTrack, { backgroundColor: borderCol }]}>
          <Animated.View
            style={[
              styles.challengerProgressBar,
              {
                width: challengerWidthAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: isCurrentUserChallenger ? tintCol : '#2196F3',
              },
            ]}
          />
          {/* Note: The right side automatically fills the rest of the space thanks to flex: 1 */}
          <RNView style={[styles.challengeeProgressBar, { backgroundColor: isCurrentUserChallenger ? '#2196F3' : tintCol }]} />
        </RNView>

        {/* Legend */}
        <RNView style={styles.legendRow}>
          <RNView style={styles.legendItem}>
            <RNView style={[styles.legendIndicator, { backgroundColor: tintCol }]} />
            <Text style={styles.legendText}>You</Text>
          </RNView>
          <RNView style={styles.legendItem}>
            <RNView style={[styles.legendIndicator, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>{opponent?.username || 'Friend'}</Text>
          </RNView>
        </RNView>
      </RNView>

      {/* ─── LEAD COMPARISON STATUS ─── */}
      {challenge.status === 'accepted' && (
        <RNView style={[styles.leadCompareCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          {userGained > friendGained ? (
            <Text style={[styles.leadCompareText, { color: '#10B981' }]}>
              👑 You are leading by <Text style={{ fontWeight: '800' }}>{userGained - friendGained} XP</Text>! Keep going!
            </Text>
          ) : friendGained > userGained ? (
            <Text style={[styles.leadCompareText, { color: '#EF4444' }]}>
              ⚔️ {opponent?.username || 'Friend'} is leading by <Text style={{ fontWeight: '800' }}>{friendGained - userGained} XP</Text>. Take a lesson to catch up!
            </Text>
          ) : (
            <Text style={[styles.leadCompareText, { color: textMutedCol }]}>
              🤝 It's a dead heat! Both of you are tied at {userGained} XP earned. Earni some XP to take the lead!
            </Text>
          )}
        </RNView>
      )}

      {/* ─── RULES AND REWARDS ─── */}
      <RNView style={[styles.rulesCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <Text style={styles.rulesHeading}>Battle Rules & Rewards</Text>
        <RNView style={styles.ruleItem}>
          <Text style={styles.ruleBullet}>🏆</Text>
          <Text style={[styles.ruleText, { color: textMutedCol }]}>
            First to earn more XP within the 7-day period wins a <Text style={{ fontWeight: 'bold', color: textCol }}>Challenge Champ</Text> badge shown on their profile.
          </Text>
        </RNView>
        <RNView style={styles.ruleItem}>
          <Text style={styles.ruleBullet}>⚡</Text>
          <Text style={[styles.ruleText, { color: textMutedCol }]}>
            All XP gained from lessons, practice, pronunciation practice, and quizzes counts toward your battle score.
          </Text>
        </RNView>
        <RNView style={styles.ruleItem}>
          <Text style={styles.ruleBullet}>🔔</Text>
          <Text style={[styles.ruleText, { color: textMutedCol }]}>
            Notifications will warn you when your friend takes the lead or when the battle is ending in 24 hours.
          </Text>
        </RNView>
      </RNView>

      {/* Manual Refresh */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => loadChallengeData(false)}
        style={[styles.refreshButton, { borderColor: borderCol }]}
      >
        <Text style={[styles.refreshButtonText, { color: tintCol }]}>Refresh Stats 🔄</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Theme.spacing.lg,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  statusCard: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF9800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: Theme.spacing.sm,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  timerLabel: {
    fontSize: 12,
    marginRight: 6,
  },
  timerValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  winnerBlock: {
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  winnerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
  },
  versusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.xl,
  },
  playerCard: {
    flex: 1,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    padding: Theme.spacing.md,
    alignItems: 'center',
    maxWidth: '43%',
  },
  playerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  playerAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  playerAvatarEmoji: {
    fontSize: 30,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
    width: '100%',
  },
  playerSub: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  earnedXPText: {
    fontSize: 18,
    fontWeight: '800',
  },
  earnedXPLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  vsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  vsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarSection: {
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.xl,
  },
  progressHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginBottom: Theme.spacing.md,
  },
  progressBarTrack: {
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  challengerProgressBar: {
    height: '100%',
  },
  challengeeProgressBar: {
    height: '100%',
    flex: 1,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginTop: Theme.spacing.md,
    backgroundColor: 'transparent',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  legendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  leadCompareCard: {
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    padding: Theme.spacing.md,
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  leadCompareText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  rulesCard: {
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
  },
  rulesHeading: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: Theme.spacing.md,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.sm,
    gap: Theme.spacing.sm,
  },
  ruleBullet: {
    fontSize: 16,
    lineHeight: 20,
  },
  ruleText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  refreshButton: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
