import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  View as RNView,
  Alert,
  FlatList,
  Dimensions,
  Animated,
  RefreshControl,
} from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useAuthStore } from '../stores/useAuthStore';
import { getRealLeagueState } from '../services/league';

import { CURRICULUM } from '../services/curriculumData';
import {
  FriendProfile,
  FriendRequest,
  ActivityFeedItem,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectOrCancelFriendRequest,
  removeFriend,
  getFriendships,
  getLeagueSuggestions,
  getRecentFriendActivity,
  subscribeToFriendships,
  subscribeToProgress,
} from '../services/friends';
import {
  createXPChallenge,
  acceptXPChallenge,
  declineXPChallenge,
  getActiveChallenges,
  subscribeToUserChallenges,
  checkAndExpireChallenges,
  XPChallenge,
} from '../services/challenges';
import { setupNotifications, showLocalNotification, scheduleNotificationAt } from '../services/notifications';
import { trackEvent, EVENTS } from '../services/analytics';


const { width } = Dimensions.get('window');

export default function FriendsScreen({ navigation }: any) {
  const session = useAuthStore((state) => state.session);
  const isGuest = useAuthStore((state) => state.isGuest);
  const userId = session?.user?.id;

  const [activeTab, setActiveTab] = useState<'activity' | 'find' | 'requests'>('activity');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Friends & Requests lists
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [suggestions, setSuggestions] = useState<FriendProfile[]>([]);
  const [challenges, setChallenges] = useState<XPChallenge[]>([]);

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Animations
  const tabLineAnim = useRef(new Animated.Value(0)).current;

  // Colors
  const backgroundCol = useThemeColor({}, 'background');
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');
  const textMutedCol = useThemeColor({}, 'textMuted');

  // Map lesson ID to lesson title
  const getLessonTitle = (lessonId: string) => {
    for (const unit of CURRICULUM) {
      for (const lesson of unit.lessons) {
        if (lesson.id === lessonId) {
          return lesson.title;
        }
      }
    }
    return 'Lesson Complete';
  };

  // Main loader function
  const loadData = useCallback(async (showIndicator = true) => {
    if (!userId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (showIndicator) setLoading(true);

    try {
      // 1. Fetch friendships (friends, incoming, outgoing)
      const relationships = await getFriendships(userId);
      setFriends(relationships.friends);
      setIncomingRequests(relationships.incomingRequests);
      setOutgoingRequests(relationships.outgoingRequests);

      const friendIds = relationships.friends.map((f) => f.id);

      // 2. Fetch recent friend activities
      const activities = await getRecentFriendActivity(friendIds);
      setActivityFeed(activities);

      // 3. Fetch league details for suggestions
      const leagueState = await getRealLeagueState(userId, 'global');
      const userTier = leagueState.userTier || 'Bronze';


      // 4. Determine list of IDs to exclude from suggestions
      // Exclude: current user, all current friends, all outgoing requested, all incoming requested
      const excludedIds = [
        userId,
        ...relationships.friends.map((f) => f.id),
        ...relationships.incomingRequests.map((r) => r.friend.id),
        ...relationships.outgoingRequests.map((r) => r.friend.id),
      ];

      // 5. Fetch recommendations
      const suggestedUsers = await getLeagueSuggestions(userId, userTier, excludedIds);
      setSuggestions(suggestedUsers);

      // 6. Check and fetch active/pending challenges
      await checkAndExpireChallenges(userId);
      const activeChallenges = await getActiveChallenges(userId);
      setChallenges(activeChallenges);
    } catch (e) {
      console.error('Failed to load friends system data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  // Set up realtime updates
  useEffect(() => {
    if (!userId) return;

    loadData(true);

    // Setup push notifications permission on mount
    setupNotifications().catch(console.error);

    // Subscribe to friendships database updates
    const friendshipsSub = subscribeToFriendships(userId, () => {
      // Trigger silent reload on updates
      loadData(false);
    });

    // Subscribe to challenges database updates
    const challengesSub = subscribeToUserChallenges(userId, (payload) => {
      if (
        payload.eventType === 'INSERT' &&
        payload.new.challengee_id === userId &&
        payload.new.status === 'pending'
      ) {
        showLocalNotification(
          "Challenge Received! ⚔️",
          "A friend has challenged you to a 7-day XP battle! Accept it now in the Friends tab."
        );
      }
      loadData(false);
    });

    // Subscribe to progress changes (for real-time activity feed)
    const friendIds = friends.map((f) => f.id);
    const progressSub = subscribeToProgress(friendIds, (newProgress) => {
      // If we see a new progress record for a friend:
      // Try to find the friend details in local state
      const matchingFriend = friends.find((f) => f.id === newProgress.user_id);
      if (matchingFriend) {
        const activityItem: ActivityFeedItem = {
          id: newProgress.id.toString(),
          userId: newProgress.user_id,
          username: matchingFriend.username,
          avatarUrl: matchingFriend.avatar_url,
          lessonId: newProgress.lesson_id,
          unitId: newProgress.unit_id,
          completedAt: Date.now(),
        };
        // Add to the top of feed state in real-time
        setActivityFeed((prev) => [activityItem, ...prev]);
      } else {
        // If not found (e.g. newly added friend), reload the list and feed
        loadData(false);
      }
    });

    return () => {
      friendshipsSub.unsubscribe();
      challengesSub.unsubscribe();
      progressSub?.unsubscribe();
    };
  }, [userId, loadData, friends.length]);

  // Handle Search Input Change
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const results = await searchUsers(text, userId || '');
    setSearchResults(results);
    setSearchLoading(false);
  };

  // Perform pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  // tab animation trigger
  const handleTabPress = (tab: 'activity' | 'find' | 'requests', index: number) => {
    setActiveTab(tab);
    Animated.spring(tabLineAnim, {
      toValue: index * (width / 3),
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  // Actions
  const handleSendRequest = async (receiverId: string) => {
    if (!userId) return;
    const { error } = await sendFriendRequest(userId, receiverId);
    if (error) {
      Alert.alert('Error ⚠️', 'Failed to send request. Please try again.');
    } else {
      Alert.alert('Success 🎉', 'Friend request sent!');
      loadData(false);
      // Reset search
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleAcceptRequest = async (requestId: number) => {
    const { error } = await acceptFriendRequest(requestId);
    if (error) {
      Alert.alert('Error ⚠️', 'Failed to accept friend request.');
    } else {
      // Analytics: new friend added
      trackEvent(EVENTS.FRIEND_ADDED).catch(console.error);
      loadData(false);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    const { error } = await rejectOrCancelFriendRequest(requestId);
    if (error) {
      Alert.alert('Error ⚠️', 'Failed to reject friend request.');
    } else {
      loadData(false);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    const { error } = await rejectOrCancelFriendRequest(requestId);
    if (error) {
      Alert.alert('Error ⚠️', 'Failed to cancel request.');
    } else {
      loadData(false);
    }
  };

  const handleUnfriend = (friendId: string, friendName: string) => {
    Alert.alert(
      'Remove Friend 👥',
      `Are you sure you want to remove ${friendName} from your friends list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            const { error } = await removeFriend(userId, friendId);
            if (error) {
              Alert.alert('Error ⚠️', 'Failed to remove friend.');
            } else {
              loadData(false);
            }
          },
        },
      ]
    );
  };

  const handleChallengeFriend = async (friendId: string, friendName: string) => {
    if (!userId) return;
    const { error } = await createXPChallenge(userId, friendId);
    if (error) {
      Alert.alert('Challenge Failed ⚔️', error.message || 'Could not challenge this friend.');
    } else {
      // Analytics: challenge sent
      trackEvent(EVENTS.CHALLENGE_SENT, { friendId }).catch(console.error);
      Alert.alert('Challenge Sent! ⚔️', `You challenged ${friendName} to a 7-day XP battle!`);
      loadData(false);
    }
  };

  const handleAcceptChallenge = async (challengeId: string, challengerName: string) => {
    const { error } = await acceptXPChallenge(challengeId);
    if (error) {
      Alert.alert('Error ⚠️', 'Failed to accept challenge.');
    } else {
      Alert.alert('Challenge Accepted! ⚔️', `Let the battle with ${challengerName} begin!`);
      
      // Schedule ending notification (24 hours before 7 days, i.e., 6 days from now)
      const triggerDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
      await scheduleNotificationAt(
        "Battle ending in 24 hours! ⏳",
        `Your 7-day XP battle with ${challengerName} has 24 hours remaining! Earn some XP to secure your lead.`,
        triggerDate
      );

      loadData(false);
    }
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    const { error } = await declineXPChallenge(challengeId);
    if (error) {
      Alert.alert('Error ⚠️', 'Failed to decline challenge.');
    } else {
      loadData(false);
    }
  };

  // Helper helper to check relationship status in searches
  const getRelationStatus = (id: string) => {
    if (friends.some((f) => f.id === id)) return 'friends';
    if (outgoingRequests.some((r) => r.friend.id === id)) return 'requested';
    if (incomingRequests.some((r) => r.friend.id === id)) return 'incoming';
    return 'none';
  };

  // ----------------------------------------------------
  // GUEST SCREEN FALLBACK
  // ----------------------------------------------------
  if (isGuest || !userId) {
    return (
      <View style={[styles.guestContainer, { backgroundColor: backgroundCol }]}>
        <RNView style={[styles.guestCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.guestIcon}>👥</Text>
          <Text style={styles.guestTitle}>Unlock Social Features</Text>
          <Text style={[styles.guestDesc, { color: textMutedCol }]}>
            Create an account or sign in to Odia Boli to search for friends, accept requests, see real-time learning feeds, and compete on the weekly league leaderboards!
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

  return (
    <View style={{ flex: 1, backgroundColor: backgroundCol }}>
      {/* ─── TAB NAVIGATION HEADER ─── */}
      <RNView style={[styles.tabBar, { borderBottomColor: borderCol, backgroundColor: cardCol }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress('activity', 0)}
          style={styles.tabItem}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'activity' ? tintCol : textMutedCol },
              activeTab === 'activity' && styles.tabTextActive,
            ]}
          >
            📊 Activity
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress('find', 1)}
          style={styles.tabItem}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'find' ? tintCol : textMutedCol },
              activeTab === 'find' && styles.tabTextActive,
            ]}
          >
            🔍 Find
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress('requests', 2)}
          style={styles.tabItem}
        >
          <RNView style={styles.tabItemWithBadge}>
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'requests' ? tintCol : textMutedCol },
                activeTab === 'requests' && styles.tabTextActive,
              ]}
            >
              ✉️ Requests
            </Text>
            {incomingRequests.length > 0 && (
              <RNView style={[styles.requestBadge, { backgroundColor: tintCol }]}>
                <Text style={styles.requestBadgeText}>{incomingRequests.length}</Text>
              </RNView>
            )}
          </RNView>
        </TouchableOpacity>

        {/* Sliding active bar */}
        <Animated.View
          style={[
            styles.tabLine,
            {
              backgroundColor: tintCol,
              transform: [{ translateX: tabLineAnim }],
            },
          ]}
        />
      </RNView>

      {/* ─── CONTENT TABS ─── */}
      {loading ? (
        <RNView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tintCol} />
          <Text style={[styles.loadingText, { color: textMutedCol }]}>Connecting to friends network...</Text>
        </RNView>
      ) : (
        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[tintCol]} />}
        >
          {/* TAB 1: ACTIVITY & FRIENDS LIST */}
          {activeTab === 'activity' && (
            <>
              {/* Friend Challenges ⚔️ */}
              <Text style={styles.sectionHeading}>Friend Challenges ⚔️</Text>
              <RNView style={styles.challengesContainer}>
                {challenges.length === 0 ? (
                  <RNView style={[styles.emptyCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
                    <Text style={styles.emptyCardEmoji}>⚔️</Text>
                    <Text style={[styles.emptyCardTitle, { color: textCol }]}>No Active Battles</Text>
                    <Text style={[styles.emptyCardDesc, { color: textMutedCol }]}>
                      Challenge your friends to a 7-day XP showdown! Earning XP helps you both learn while competing.
                    </Text>
                  </RNView>
                ) : (
                  challenges.map((challenge) => {
                    const isChallenger = challenge.challenger_id === userId;
                    const opponent = isChallenger ? challenge.challengee : challenge.challenger;
                    
                    if (challenge.status === 'pending') {
                      return (
                        <RNView key={challenge.id} style={[styles.challengeCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
                          <RNView style={styles.challengeInfo}>
                            <Text style={styles.challengeTitle}>⚔️ XP Battle Request</Text>
                            <Text style={[styles.challengeSubtitle, { color: textMutedCol }]}>
                              {isChallenger
                                ? `Waiting for ${opponent?.username || 'friend'} to accept...`
                                : `${opponent?.username || 'Friend'} challenged you to a 7-day battle!`}
                            </Text>
                          </RNView>
                          {!isChallenger ? (
                            <RNView style={styles.challengeActions}>
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => handleAcceptChallenge(challenge.id, opponent?.username || 'Friend')}
                                style={[styles.acceptChallengeButton, { backgroundColor: tintCol }]}
                              >
                                <Text style={styles.challengeActionText}>Accept</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => handleDeclineChallenge(challenge.id)}
                                style={[styles.declineChallengeButton, { borderColor: '#EF4444' }]}
                              >
                                <Text style={styles.challengeActionTextDecline}>Decline</Text>
                              </TouchableOpacity>
                            </RNView>
                          ) : (
                            <RNView style={[styles.miniStatusBadge, { backgroundColor: borderCol, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Theme.borderRadius.sm }]}>
                              <Text style={[styles.miniStatusText, { color: textMutedCol, fontWeight: '700', fontSize: 12 }]}>Pending ⏳</Text>
                            </RNView>
                          )}
                        </RNView>
                      );
                    } else if (challenge.status === 'accepted') {
                      // Active battle
                      return (
                        <RNView key={challenge.id} style={[styles.challengeCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
                          <RNView style={styles.challengeInfo}>
                            <Text style={styles.challengeTitleActive}>🔥 XP Battle: Active</Text>
                            <Text style={[styles.challengeSubtitle, { color: textMutedCol }]}>
                              Competing with <Text style={{ fontWeight: 'bold', color: textCol }}>{opponent?.username}</Text>
                            </Text>
                          </RNView>
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('Challenge', { challengeId: challenge.id })}
                            style={[styles.viewChallengeButton, { backgroundColor: tintCol }]}
                          >
                            <Text style={styles.viewChallengeText}>View Battle ⚔️</Text>
                          </TouchableOpacity>
                        </RNView>
                      );
                    }
                    return null;
                  })
                )}
              </RNView>

              {/* Friends Activity Feed */}
              <Text style={styles.sectionHeading}>Friends Activity Feed</Text>
              <RNView style={styles.feedContainer}>
                {activityFeed.length === 0 ? (
                  <RNView style={[styles.emptyCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
                    <Text style={styles.emptyCardEmoji}>✨</Text>
                    <Text style={[styles.emptyCardTitle, { color: textCol }]}>Quiet on the feed</Text>
                    <Text style={[styles.emptyCardDesc, { color: textMutedCol }]}>
                      Once your friends complete lessons, their live learning milestones will show up here. Add more friends to see them grow!
                    </Text>
                  </RNView>
                ) : (
                  activityFeed.map((item) => (
                    <RNView key={item.id} style={[styles.feedCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
                      {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={styles.feedAvatar} />
                      ) : (
                        <RNView style={[styles.feedAvatarPlaceholder, { backgroundColor: tintCol + '15' }]}>
                          <Text style={styles.feedAvatarEmoji}>🦚</Text>
                        </RNView>
                      )}
                      <RNView style={styles.feedDetails}>
                        <Text style={styles.feedText}>
                          <Text style={styles.feedUsername}>{item.username}</Text> completed{' '}
                          <Text style={{ fontWeight: '700', color: tintCol }}>{getLessonTitle(item.lessonId)}</Text> 🎉
                        </Text>
                        <Text style={[styles.feedTime, { color: textMutedCol }]}>
                          {new Date(item.completedAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </Text>
                      </RNView>
                    </RNView>
                  ))
                )}
              </RNView>

              {/* Friends Leaderboard / Directory */}
              <Text style={styles.sectionHeading}>Your Friends ({friends.length})</Text>
              <RNView style={styles.friendsListContainer}>
                {friends.length === 0 ? (
                  <RNView style={[styles.emptyCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
                    <Text style={styles.emptyCardEmoji}>👥</Text>
                    <Text style={[styles.emptyCardTitle, { color: textCol }]}>No friends added yet</Text>
                    <Text style={[styles.emptyCardDesc, { color: textMutedCol }]}>
                      Odia Boli is more fun with friends. Go to the "Find" tab to search by username or find people in your league!
                    </Text>
                  </RNView>
                ) : (
                  friends
                    .sort((a, b) => b.weeklyXp - a.weeklyXp) // Sort by weekly XP
                    .map((friend) => {
                      const existingChallenge = challenges.find(
                        (c) =>
                          (c.challenger_id === friend.id && c.challengee_id === userId) ||
                          (c.challenger_id === userId && c.challengee_id === friend.id)
                      );
                      return (
                        <RNView key={friend.id} style={[styles.friendCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
                          {friend.avatar_url ? (
                            <Image source={{ uri: friend.avatar_url }} style={styles.friendAvatar} />
                          ) : (
                            <RNView style={[styles.friendAvatarPlaceholder, { backgroundColor: tintCol + '15' }]}>
                              <Text style={styles.friendAvatarEmoji}>🦚</Text>
                            </RNView>
                          )}
                          <RNView style={styles.friendMeta}>
                            <Text style={styles.friendName}>{friend.username}</Text>
                            <RNView style={styles.friendStatsRow}>
                              <RNView style={[styles.statBadge, { backgroundColor: borderCol }]}>
                                <Text style={styles.statBadgeText}>⭐ Lv. {friend.level}</Text>
                              </RNView>
                              <RNView style={[styles.statBadge, { backgroundColor: borderCol }]}>
                                <Text style={styles.statBadgeText}>🔥 {friend.streak}d streak</Text>
                              </RNView>
                            </RNView>
                            
                            <RNView style={{ flexDirection: 'row', marginTop: 8, gap: 8, backgroundColor: 'transparent' }}>
                              {existingChallenge ? (
                                existingChallenge.status === 'pending' ? (
                                  existingChallenge.challenger_id === userId ? (
                                    <RNView style={[styles.miniStatusBadge, { backgroundColor: borderCol }]}>
                                      <Text style={[styles.miniStatusText, { color: textMutedCol }]}>Pending ⏳</Text>
                                    </RNView>
                                  ) : (
                                    <TouchableOpacity
                                      activeOpacity={0.7}
                                      onPress={() => handleAcceptChallenge(existingChallenge.id, friend.username)}
                                      style={[styles.miniBattleButton, { backgroundColor: '#10B981' }]}
                                    >
                                      <Text style={styles.miniBattleButtonText}>Accept ⚔️</Text>
                                    </TouchableOpacity>
                                  )
                                ) : (
                                  <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => navigation.navigate('Challenge', { challengeId: existingChallenge.id })}
                                    style={[styles.miniBattleButton, { backgroundColor: tintCol }]}
                                  >
                                    <Text style={styles.miniBattleButtonText}>Active ⚔️</Text>
                                  </TouchableOpacity>
                                )
                              ) : (
                                <TouchableOpacity
                                  activeOpacity={0.7}
                                  onPress={() => handleChallengeFriend(friend.id, friend.username)}
                                  style={[styles.miniBattleButton, { backgroundColor: tintCol }]}
                                >
                                  <Text style={styles.miniBattleButtonText}>Battle ⚔️</Text>
                                </TouchableOpacity>
                              )}
                            </RNView>
                          </RNView>

                          <RNView style={styles.friendRightColumn}>
                            <Text style={[styles.weeklyXpText, { color: tintCol }]}>{friend.weeklyXp} XP</Text>
                            <Text style={[styles.weeklyXpLabel, { color: textMutedCol }]}>This week</Text>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => handleUnfriend(friend.id, friend.username)}
                              style={styles.unfriendButton}
                            >
                              <Text style={styles.unfriendText}>Remove</Text>
                            </TouchableOpacity>
                          </RNView>
                        </RNView>
                      );
                    })
                )}
              </RNView>
            </>
          )}

          {/* TAB 2: FIND FRIENDS & SEARCH */}
          {activeTab === 'find' && (
            <>
              {/* Search input bar */}
              <RNView style={[styles.searchContainer, { backgroundColor: cardCol, borderColor: borderCol }]}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  value={searchQuery}
                  onChangeText={handleSearch}
                  placeholder="Search learners by username..."
                  placeholderTextColor={textMutedCol}
                  style={[styles.searchInput, { color: textCol }]}
                />
                {searchQuery ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <Text style={{ fontSize: 16, color: textMutedCol }}>✖️</Text>
                  </TouchableOpacity>
                ) : null}
              </RNView>

              {/* Search Results */}
              {searchQuery && (
                <RNView style={styles.searchResultsContainer}>
                  <Text style={styles.sectionHeading}>Search Results ({searchResults.length})</Text>
                  {searchLoading ? (
                    <ActivityIndicator size="small" color={tintCol} style={{ marginVertical: 20 }} />
                  ) : searchResults.length === 0 ? (
                    <Text style={[styles.noResultsText, { color: textMutedCol }]}>No learners found with that username.</Text>
                  ) : (
                    searchResults.map((user) => {
                      const status = getRelationStatus(user.id);
                      return (
                        <RNView key={user.id} style={[styles.userCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
                          {user.avatar_url ? (
                            <Image source={{ uri: user.avatar_url }} style={styles.userAvatar} />
                          ) : (
                            <RNView style={[styles.userAvatarPlaceholder, { backgroundColor: tintCol + '15' }]}>
                              <Text style={styles.userAvatarEmoji}>🦚</Text>
                            </RNView>
                          )}
                          <RNView style={styles.userMeta}>
                            <Text style={styles.userName}>{user.username}</Text>
                            <Text style={[styles.userLevel, { color: textMutedCol }]}>Level {user.level} • {user.streak}d streak</Text>
                          </RNView>
                          {status === 'friends' && (
                            <RNView style={[styles.actionBadge, { backgroundColor: '#10B98115' }]}>
                              <Text style={{ color: '#10B981', fontWeight: 'bold', fontSize: 12 }}>Friends</Text>
                            </RNView>
                          )}
                          {status === 'requested' && (
                            <RNView style={[styles.actionBadge, { backgroundColor: borderCol }]}>
                              <Text style={{ color: textMutedCol, fontWeight: 'bold', fontSize: 12 }}>Pending</Text>
                            </RNView>
                          )}
                          {status === 'incoming' && (
                            <RNView style={[styles.actionBadge, { backgroundColor: tintCol + '15' }]}>
                              <Text style={{ color: tintCol, fontWeight: 'bold', fontSize: 12 }}>Invited You</Text>
                            </RNView>
                          )}
                          {status === 'none' && (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => handleSendRequest(user.id)}
                              style={[styles.addFriendButton, { backgroundColor: tintCol }]}
                            >
                              <Text style={styles.addFriendButtonText}>+ Add</Text>
                            </TouchableOpacity>
                          )}
                        </RNView>
                      );
                    })
                  )}
                </RNView>
              )}

              {/* League-based suggestions */}
              <Text style={styles.sectionHeading}>Suggested Friends (From Your League)</Text>
              <RNView style={styles.suggestionsContainer}>
                {suggestions.length === 0 ? (
                  <Text style={[styles.noSuggestionsText, { color: textMutedCol }]}>
                    No new suggestions in your league tier right now. Check back later!
                  </Text>
                ) : (
                  <FlatList
                    horizontal
                    data={suggestions}
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.suggestionsScrollContent}
                    renderItem={({ item }) => (
                      <RNView style={[styles.suggestionCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
                        {item.avatar_url ? (
                          <Image source={{ uri: item.avatar_url }} style={styles.suggestionAvatar} />
                        ) : (
                          <RNView style={[styles.suggestionAvatarPlaceholder, { backgroundColor: tintCol + '15' }]}>
                            <Text style={styles.suggestionAvatarEmoji}>🦚</Text>
                          </RNView>
                        )}
                        <Text style={styles.suggestionName} numberOfLines={1}>
                          {item.username}
                        </Text>
                        <Text style={[styles.suggestionStats, { color: textMutedCol }]}>
                          Lv. {item.level} • 🔥 {item.streak}d
                        </Text>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handleSendRequest(item.id)}
                          style={[styles.suggestionAddButton, { backgroundColor: tintCol }]}
                        >
                          <Text style={styles.suggestionAddButtonText}>Add Friend</Text>
                        </TouchableOpacity>
                      </RNView>
                    )}
                  />
                )}
              </RNView>
            </>
          )}

          {/* TAB 3: REQUESTS */}
          {activeTab === 'requests' && (
            <>
              {/* Incoming Requests */}
              <Text style={styles.sectionHeading}>Incoming Requests ({incomingRequests.length})</Text>
              <RNView style={styles.requestsContainer}>
                {incomingRequests.length === 0 ? (
                  <RNView style={[styles.emptyCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
                    <Text style={styles.emptyCardEmoji}>📬</Text>
                    <Text style={[styles.emptyCardTitle, { color: textCol }]}>Inboxes are empty</Text>
                    <Text style={[styles.emptyCardDesc, { color: textMutedCol }]}>
                      You don't have any incoming friend requests at the moment. Invite friends to connect!
                    </Text>
                  </RNView>
                ) : (
                  incomingRequests.map((req) => (
                    <RNView key={req.id} style={[styles.requestCardItem, { backgroundColor: cardCol, borderColor: borderCol }]}>
                      {req.friend.avatar_url ? (
                        <Image source={{ uri: req.friend.avatar_url }} style={styles.requestAvatar} />
                      ) : (
                        <RNView style={[styles.requestAvatarPlaceholder, { backgroundColor: tintCol + '15' }]}>
                          <Text style={styles.requestAvatarEmoji}>🦚</Text>
                        </RNView>
                      )}
                      <RNView style={styles.requestMeta}>
                        <Text style={styles.requestName}>{req.friend.username}</Text>
                        <Text style={[styles.requestLevel, { color: textMutedCol }]}>
                          Level {req.friend.level} • {req.friend.streak}d streak
                        </Text>
                      </RNView>
                      <RNView style={styles.requestActionsRow}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handleAcceptRequest(req.id)}
                          style={[styles.actionButtonAccept, { backgroundColor: '#10B981' }]}
                        >
                          <Text style={styles.actionButtonText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handleRejectRequest(req.id)}
                          style={[styles.actionButtonReject, { borderColor: '#EF4444' }]}
                        >
                          <Text style={styles.actionButtonRejectText}>Decline</Text>
                        </TouchableOpacity>
                      </RNView>
                    </RNView>
                  ))
                )}
              </RNView>

              {/* Sent Pending Requests */}
              <Text style={styles.sectionHeading}>Sent Pending Requests ({outgoingRequests.length})</Text>
              <RNView style={styles.requestsContainer}>
                {outgoingRequests.length === 0 ? (
                  <Text style={[styles.noPendingText, { color: textMutedCol }]}>No outgoing pending friend requests.</Text>
                ) : (
                  outgoingRequests.map((req) => (
                    <RNView key={req.id} style={[styles.requestCardItem, { backgroundColor: cardCol, borderColor: borderCol }]}>
                      {req.friend.avatar_url ? (
                        <Image source={{ uri: req.friend.avatar_url }} style={styles.requestAvatar} />
                      ) : (
                        <RNView style={[styles.requestAvatarPlaceholder, { backgroundColor: tintCol + '15' }]}>
                          <Text style={styles.requestAvatarEmoji}>🦚</Text>
                        </RNView>
                      )}
                      <RNView style={styles.requestMeta}>
                        <Text style={styles.requestName}>{req.friend.username}</Text>
                        <Text style={[styles.requestLevel, { color: textMutedCol }]}>
                          Level {req.friend.level} • {req.friend.streak}d streak
                        </Text>
                      </RNView>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleCancelRequest(req.id)}
                        style={[styles.actionButtonCancel, { borderColor: borderCol }]}
                      >
                        <Text style={[styles.actionButtonCancelText, { color: textMutedCol }]}>Cancel</Text>
                      </TouchableOpacity>
                    </RNView>
                  ))
                )}
              </RNView>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    height: 48,
    borderBottomWidth: 1,
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabItemWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  requestBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  requestBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  tabLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: width / 3,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  contentScroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Theme.spacing.lg,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: '800',
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    color: '#6B7280',
  },
  feedContainer: {
    backgroundColor: 'transparent',
    gap: 12,
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
  },
  feedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  feedAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedAvatarEmoji: {
    fontSize: 22,
  },
  feedDetails: {
    flex: 1,
    backgroundColor: 'transparent',
    marginLeft: Theme.spacing.md,
  },
  feedText: {
    fontSize: 13,
    lineHeight: 18,
  },
  feedUsername: {
    fontWeight: '800',
  },
  feedTime: {
    fontSize: 11,
    marginTop: 2,
  },
  friendsListContainer: {
    backgroundColor: 'transparent',
    gap: 12,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  friendAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarEmoji: {
    fontSize: 24,
  },
  friendMeta: {
    flex: 1,
    backgroundColor: 'transparent',
    marginLeft: Theme.spacing.md,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  friendStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    gap: 6,
  },
  statBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.sm,
  },
  statBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  friendRightColumn: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  weeklyXpText: {
    fontSize: 14,
    fontWeight: '800',
  },
  weeklyXpLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  unfriendButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  unfriendText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.xl,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    marginVertical: Theme.spacing.xs,
  },
  emptyCardEmoji: {
    fontSize: 40,
    marginBottom: Theme.spacing.md,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyCardDesc: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Theme.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md - 4,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: Theme.spacing.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  searchResultsContainer: {
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.lg,
  },
  noResultsText: {
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: Theme.spacing.sm,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarEmoji: {
    fontSize: 20,
  },
  userMeta: {
    flex: 1,
    backgroundColor: 'transparent',
    marginLeft: Theme.spacing.md,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
  },
  userLevel: {
    fontSize: 11,
    marginTop: 2,
  },
  addFriendButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.sm,
  },
  addFriendButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.sm,
  },
  suggestionsContainer: {
    backgroundColor: 'transparent',
  },
  suggestionsScrollContent: {
    paddingRight: Theme.spacing.lg,
    paddingVertical: 6,
  },
  suggestionCard: {
    width: 140,
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    marginRight: 12,
  },
  suggestionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 6,
  },
  suggestionAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  suggestionAvatarEmoji: {
    fontSize: 24,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  suggestionStats: {
    fontSize: 10,
    marginBottom: Theme.spacing.md,
  },
  suggestionAddButton: {
    width: '100%',
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.sm,
    alignItems: 'center',
  },
  suggestionAddButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  noSuggestionsText: {
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 12,
  },
  requestsContainer: {
    backgroundColor: 'transparent',
    gap: 12,
    marginBottom: Theme.spacing.xl,
  },
  requestCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  requestAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestAvatarEmoji: {
    fontSize: 22,
  },
  requestMeta: {
    flex: 1,
    backgroundColor: 'transparent',
    marginLeft: Theme.spacing.md,
  },
  requestName: {
    fontSize: 14,
    fontWeight: '700',
  },
  requestLevel: {
    fontSize: 11,
    marginTop: 2,
  },
  requestActionsRow: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    gap: 8,
  },
  actionButtonAccept: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionButtonReject: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
  },
  actionButtonRejectText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionButtonCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
  },
  actionButtonCancelText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  noPendingText: {
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 8,
  },
  // Guest mode lock styles
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
  challengesContainer: {
    backgroundColor: 'transparent',
    gap: 12,
    marginBottom: Theme.spacing.lg,
  },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
  },
  challengeInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  challengeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF9800',
    marginBottom: 4,
  },
  challengeTitleActive: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 4,
  },
  challengeSubtitle: {
    fontSize: 12,
  },
  challengeActions: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    gap: 8,
  },
  acceptChallengeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.sm,
  },
  declineChallengeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.sm,
    borderWidth: 1,
  },
  challengeActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  challengeActionTextDecline: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: 'bold',
  },
  viewChallengeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.sm,
  },
  viewChallengeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  miniStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
  },
  miniStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  miniBattleButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
  },
  miniBattleButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
