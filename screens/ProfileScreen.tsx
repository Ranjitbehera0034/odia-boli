import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Modal, TextInput, ActivityIndicator, View as RNView, Alert } from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useUserStore } from '../stores/useUserStore';
import { useProgressStore } from '../stores/useProgressStore';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { ProfileScreenNavigationProp } from '../navigation/types';


interface Badge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
}

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const user = useUserStore();
  const progress = useProgressStore();

  const [editModalVisible, setEditModalVisible] = useState(false);

  const [uploading, setUploading] = useState(false);

  // Edit fields state
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editNativeLanguage, setEditNativeLanguage] = useState('');
  const [editLearningGoal, setEditLearningGoal] = useState('conversational');
  const [editInterests, setEditInterests] = useState<string[]>([]);

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');
  const textMutedCol = useThemeColor({}, 'textMuted');
  const backgroundCol = useThemeColor({}, 'background');

  // Load state values into edit inputs when opening modal
  const openEditModal = () => {
    setEditUsername(user.username);
    setEditBio(user.bio);
    setEditLocation(user.location);
    setEditNativeLanguage(user.nativeLanguage);
    setEditLearningGoal(user.learningGoal);
    setEditInterests(user.interests || []);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editUsername.trim()) {
      Alert.alert('Required Field', 'Please enter a display name.');
      return;
    }
    await user.updateProfile({
      username: editUsername.trim(),
      bio: editBio.trim(),
      location: editLocation.trim(),
      nativeLanguage: editNativeLanguage.trim(),
      learningGoal: editLearningGoal,
      interests: editInterests,
    });
    setEditModalVisible(false);
    Alert.alert('Profile Saved 🎉', 'Your profile details have been updated.');
  };

  const handlePickAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required 📷', 'We need access to your camera roll to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets[0].uri) {
      setUploading(true);
      const url = await user.uploadAvatar(result.assets[0].uri);
      setUploading(false);
      if (url) {
        Alert.alert('Success 🎉', 'Profile picture updated.');
      }
    }
  };

  // Format Join Date
  const formatJoinDate = () => {
    const date = user.createdAt ? new Date(user.createdAt) : new Date();
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // Badge calculations
  const totalLearned = progress.vocabulary.filter((v) => v.isLearned).length;
  const totalSavedTranslations = progress.savedTranslations.length;

  const badges: Badge[] = [
    {
      id: 'first_steps',
      title: 'First Steps',
      description: 'Completed the placement onboarding test.',
      emoji: '🚶',
      unlocked: user.onboardingCompleted,
    },
    {
      id: 'odia_learner',
      title: 'Odia Learner',
      description: 'Learn at least 5 vocabulary words.',
      emoji: '📖',
      unlocked: totalLearned >= 5,
    },
    {
      id: 'vocab_star',
      title: 'Vocab Star',
      description: 'Learn 20 or more vocabulary words.',
      emoji: '🌟',
      unlocked: totalLearned >= 20,
    },
    {
      id: 'streak_starter',
      title: 'Streak Starter',
      description: 'Achieve a 3-day active streak.',
      emoji: '🔥',
      unlocked: user.streak >= 3 || user.longestStreak >= 3,
    },
    {
      id: 'streak_champion',
      title: 'Streak Champ',
      description: 'Achieve a 7-day active streak.',
      emoji: '👑',
      unlocked: user.streak >= 7 || user.longestStreak >= 7,
    },
    {
      id: 'quiz_master',
      title: 'Quiz Master',
      description: 'Take 3 or more quiz challenges.',
      emoji: '🧠',
      unlocked: user.quizzesTaken >= 3,
    },
    {
      id: 'perfect_score',
      title: 'Perfect Score',
      description: 'Score a perfect 10/10 on any quiz.',
      emoji: '💯',
      unlocked: user.quizHighScore >= 10,
    },
    {
      id: 'word_collector',
      title: 'Word Collector',
      description: 'Save 5 or more translated phrases.',
      emoji: '⭐',
      unlocked: totalSavedTranslations >= 5,
    },
    {
      id: 'challenge_champion',
      title: 'Challenge Champ',
      description: 'Win a 7-day competitive XP battle against a friend.',
      emoji: '🏆',
      unlocked: (user.badges || []).includes('challenge_champion'),
    },
    {
      id: 'streak_club_7',
      title: 'Beginner Club',
      description: 'Achieve a 7-day active streak to enter the Beginner Club.',
      emoji: '🏃',
      unlocked: (user.badges || []).includes('streak_club_7') || user.streak >= 7 || user.longestStreak >= 7,
    },
    {
      id: 'streak_club_30',
      title: 'Committed Club',
      description: 'Achieve a 30-day active streak to enter the Committed Club.',
      emoji: '🧗',
      unlocked: (user.badges || []).includes('streak_club_30') || user.streak >= 30 || user.longestStreak >= 30,
    },
    {
      id: 'streak_club_100',
      title: 'Dedicated Club',
      description: 'Achieve a 100-day active streak to enter the Dedicated Club.',
      emoji: '🛡️',
      unlocked: (user.badges || []).includes('streak_club_100') || user.streak >= 100 || user.longestStreak >= 100,
    },
    {
      id: 'streak_club_365',
      title: 'Legend Club',
      description: 'Achieve a 365-day active streak to enter the Legend Club.',
      emoji: '👑',
      unlocked: (user.badges || []).includes('streak_club_365') || user.streak >= 365 || user.longestStreak >= 365,
    },
  ];

  const handleShowBadgeDetails = (badge: Badge) => {
    Alert.alert(
      `${badge.emoji} ${badge.title}`,
      `${badge.description}\n\nStatus: ${badge.unlocked ? 'Unlocked! 🎉' : 'Locked 🔒'}`
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header section with profile photo & basic info */}
      <RNView style={[styles.profileHeaderCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handlePickAvatar}
          style={styles.avatarWrapper}
        >
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <RNView style={[styles.avatarPlaceholder, { backgroundColor: tintCol + '15' }]}>
              <Text style={styles.avatarPlaceholderEmoji}>🦚</Text>
            </RNView>
          )}
          {uploading ? (
            <RNView style={styles.avatarLoadingOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </RNView>
          ) : (
            <RNView style={[styles.avatarEditBadge, { backgroundColor: tintCol }]}>
              <Text style={styles.avatarEditIcon}>📷</Text>
            </RNView>
          )}
        </TouchableOpacity>

        <Text style={styles.profileName}>{user.username || 'Unspecified Name'}</Text>
        <Text style={[styles.profileEmail, { color: textMutedCol }]}>{user.email || 'guest@odiaboli.local'}</Text>
        <Text style={[styles.joinDateText, { color: textMutedCol }]}>📅 Joined {formatJoinDate()}</Text>

        {user.bio ? (
          <Text style={styles.bioText}>"{user.bio}"</Text>
        ) : (
          <TouchableOpacity activeOpacity={0.7} onPress={openEditModal}>
            <Text style={[styles.bioTextPlaceholder, { color: tintCol }]}>+ Add a bio to your profile</Text>
          </TouchableOpacity>
        )}

        {/* Location & Learning Language tag */}
        <RNView style={styles.tagsContainer}>
          {user.location ? (
            <RNView style={[styles.tag, { backgroundColor: borderCol }]}>
              <Text style={styles.tagText}>📍 {user.location}</Text>
            </RNView>
          ) : null}
          <RNView style={[styles.tag, { backgroundColor: borderCol }]}>
            <Text style={styles.tagText}>💬 Speaks {user.nativeLanguage || 'English'}</Text>
          </RNView>
          <RNView style={[styles.tag, { backgroundColor: borderCol }]}>
            <Text style={styles.tagText}>🎯 Goal: {user.learningGoal.toUpperCase()}</Text>
          </RNView>
        </RNView>

        {/* Edit Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={openEditModal}
          style={[styles.editButton, { borderColor: borderCol }]}
        >
          <Text style={[styles.editButtonText, { color: tintCol }]}>Edit Profile Details</Text>
        </TouchableOpacity>

        {/* Friends & Social Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Friends')}
          style={[styles.friendsNavButton, { backgroundColor: tintCol }]}
        >
          <Text style={styles.friendsNavButtonText}>👥 Friends & Social</Text>
        </TouchableOpacity>

        {/* Detailed Progress & Analytics Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('MyProgress' as any)}
          style={[styles.analyticsNavButton, { borderColor: borderCol, borderWidth: 1 }]}
        >
          <Text style={[styles.analyticsNavButtonText, { color: tintCol }]}>📊 My Progress & Analytics</Text>
        </TouchableOpacity>

        {/* Streak Society Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('StreakSociety' as any)}
          style={[styles.analyticsNavButton, { borderColor: borderCol, borderWidth: 1, marginTop: 8 }]}
        >
          <Text style={[styles.analyticsNavButtonText, { color: tintCol }]}>🏪 Streak Society Clubs</Text>
        </TouchableOpacity>

      </RNView>

      {/* Stats Grid Section */}
      <Text style={styles.sectionTitle}>Learning Statistics</Text>
      <RNView style={styles.statsGrid}>
        <RNView style={[styles.statItem, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.statEmoji}>⚡</Text>
          <Text style={styles.statNumber}>{user.xp}</Text>
          <Text style={[styles.statLabel, { color: textMutedCol }]}>Total XP</Text>
        </RNView>

        <RNView style={[styles.statItem, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.statEmoji}>⭐</Text>
          <Text style={styles.statNumber}>Lv. {user.level}</Text>
          <Text style={[styles.statLabel, { color: textMutedCol }]}>Current Level</Text>
        </RNView>

        <RNView style={[styles.statItem, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statNumber}>{user.streak} days</Text>
          <Text style={[styles.statLabel, { color: textMutedCol }]}>Current Streak</Text>
        </RNView>

        <RNView style={[styles.statItem, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.statEmoji}>👑</Text>
          <Text style={styles.statNumber}>{user.longestStreak} days</Text>
          <Text style={[styles.statLabel, { color: textMutedCol }]}>Longest Streak</Text>
        </RNView>
      </RNView>

      {/* Badges Grid Section */}
      <Text style={styles.sectionTitle}>Badges Earned</Text>
      <RNView style={[styles.badgesCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={styles.badgesGrid}>
          {badges.map((badge) => (
            <TouchableOpacity
              key={badge.id}
              activeOpacity={0.7}
              onPress={() => handleShowBadgeDetails(badge)}
              style={[
                styles.badgeItem,
                { opacity: badge.unlocked ? 1 : 0.4 }
              ]}
            >
              <RNView style={[
                styles.badgeIconBg, 
                { backgroundColor: badge.unlocked ? tintCol + '10' : borderCol }
              ]}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
              </RNView>
              <Text style={styles.badgeTitle} numberOfLines={1}>{badge.title}</Text>
            </TouchableOpacity>
          ))}
        </RNView>
      </RNView>

      {/* Privacy Settings Section */}
      <Text style={styles.sectionTitle}>Privacy Settings</Text>
      <RNView style={[styles.privacyCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={styles.privacyRow}>
          <RNView style={styles.privacyTextContent}>
            <Text style={styles.privacyTitle}>Public Profile</Text>
            <Text style={[styles.privacyDesc, { color: textMutedCol }]}>
              Allows other users to see your stats, weekly XP, and badges on the league leaderboards.
            </Text>
          </RNView>
          <Switch
            value={user.isPublic}
            onValueChange={(val) => user.updateProfile({ isPublic: val })}
            trackColor={{ false: '#D1D5DB', true: tintCol + '80' }}
            thumbColor={user.isPublic ? tintCol : '#F3F4F6'}
          />
        </RNView>
      </RNView>

      {/* Edit Profile slide-up Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: backgroundCol }]}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <RNView style={styles.modalHeaderRow}>
              <Text style={styles.modalHeading}>Edit Profile</Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.cancelText, { color: textMutedCol }]}>Cancel</Text>
              </TouchableOpacity>
            </RNView>

            {/* Fields Form */}
            <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
            <TextInput
              value={editUsername}
              onChangeText={setEditUsername}
              placeholder="Display name"
              placeholderTextColor="#9CA3AF"
              style={[styles.textInput, { borderColor: borderCol, backgroundColor: cardCol, color: textCol }]}
            />

            <Text style={styles.fieldLabel}>BIO</Text>
            <TextInput
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell other learners about yourself"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              style={[styles.textInput, styles.textArea, { borderColor: borderCol, backgroundColor: cardCol, color: textCol }]}
            />

            <Text style={styles.fieldLabel}>LOCATION (CITY / DIASPORA)</Text>
            <TextInput
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="e.g. Bhubaneswar, Cuttack, Diaspora"
              placeholderTextColor="#9CA3AF"
              style={[styles.textInput, { borderColor: borderCol, backgroundColor: cardCol, color: textCol }]}
            />

            <Text style={styles.fieldLabel}>NATIVE LANGUAGE</Text>
            <TextInput
              value={editNativeLanguage}
              onChangeText={setEditNativeLanguage}
              placeholder="e.g. English, Hindi, Odia"
              placeholderTextColor="#9CA3AF"
              style={[styles.textInput, { borderColor: borderCol, backgroundColor: cardCol, color: textCol }]}
            />

            <Text style={styles.fieldLabel}>LEARNING GOAL</Text>
            <RNView style={styles.goalButtonRow}>
              {['casual', 'conversational', 'fluent'].map((goal) => {
                const isSelected = editLearningGoal === goal;
                return (
                  <TouchableOpacity
                    key={goal}
                    activeOpacity={0.8}
                    style={[
                      styles.goalButton,
                      {
                        borderColor: isSelected ? tintCol : borderCol,
                        backgroundColor: isSelected ? tintCol + '10' : cardCol
                      }
                    ]}
                    onPress={() => setEditLearningGoal(goal)}
                  >
                    <Text style={[styles.goalButtonText, { color: isSelected ? tintCol : textCol }]}>
                      {goal.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </RNView>

            <Text style={styles.fieldLabel}>INTERESTS</Text>
            <RNView style={styles.interestsEditContainer}>
              {['sports', 'food', 'travel', 'business'].map((interest) => {
                const isSelected = editInterests.includes(interest);
                return (
                  <TouchableOpacity
                    key={interest}
                    activeOpacity={0.8}
                    style={[
                      styles.interestEditChip,
                      {
                        borderColor: isSelected ? tintCol : borderCol,
                        backgroundColor: isSelected ? tintCol + '10' : cardCol
                      }
                    ]}
                    onPress={() => {
                      setEditInterests((prev) =>
                        prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
                      );
                    }}
                  >
                    <Text style={[styles.interestEditChipText, { color: isSelected ? tintCol : textCol }]}>
                      {interest === 'sports' ? '⚽ Sports' : interest === 'food' ? '🍔 Food' : interest === 'travel' ? '✈️ Travel' : '💼 Business'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </RNView>
 
            {/* Save Action */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.saveButton, { backgroundColor: tintCol }]}
              onPress={handleSaveProfile}
            >
              <Text style={styles.saveButtonText}>Save Profile Details</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  profileHeaderCard: {
    width: '100%',
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: 'relative',
    marginBottom: Theme.spacing.md,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderEmoji: {
    fontSize: 50,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditIcon: {
    fontSize: 14,
  },
  profileName: {
    fontSize: Theme.typography.fontSize.xl,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: Theme.typography.fontSize.sm - 1,
    marginBottom: 4,
  },
  joinDateText: {
    fontSize: Theme.typography.fontSize.xs,
    marginBottom: Theme.spacing.md,
  },
  bioText: {
    fontSize: Theme.typography.fontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
  },
  bioTextPlaceholder: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.semibold,
    marginVertical: Theme.spacing.xs,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginTop: Theme.spacing.md,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  editButton: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.xl,
  },
  editButtonText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  friendsNavButton: {
    width: '100%',
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.md,
  },
  friendsNavButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  analyticsNavButton: {
    width: '100%',
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.md,
  },
  analyticsNavButtonText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
  },

  sectionTitle: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.md,
    marginLeft: Theme.spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.xl,
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  statNumber: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: Theme.typography.fontSize.xs - 1,
  },
  badgesCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'transparent',
    gap: 12,
  },
  badgeItem: {
    width: '21%',
    alignItems: 'center',
    marginVertical: Theme.spacing.xs,
  },
  badgeIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeEmoji: {
    fontSize: 24,
  },
  badgeTitle: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  privacyCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.lg,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  privacyTextContent: {
    flex: 1,
    backgroundColor: 'transparent',
    marginRight: Theme.spacing.md,
  },
  privacyTitle: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: 2,
  },
  privacyDesc: {
    fontSize: Theme.typography.fontSize.xs - 1,
    lineHeight: 14,
  },
  modalContainer: {
    flex: 1,
  },
  modalScrollContent: {
    padding: Theme.spacing.xl,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.xl,
    paddingTop: Theme.spacing.md,
  },
  modalHeading: {
    fontSize: Theme.typography.fontSize.xl,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  cancelText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1.2,
    marginBottom: Theme.spacing.xs,
    marginTop: Theme.spacing.lg,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md - 2,
    fontSize: Theme.typography.fontSize.sm,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
  },
  goalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    gap: 8,
  },
  goalButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalButtonText: {
    fontSize: 10,
    fontWeight: '800',
  },
  saveButton: {
    width: '100%',
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  interestsEditContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: Theme.spacing.sm,
    marginBottom: Theme.spacing.xl,
  },
  interestEditChip: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.xl,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  interestEditChipText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
