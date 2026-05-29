import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ScrollView, View as RNView } from 'react-native';
import { Text, View } from '../components/Themed';
import { PRACTICAL_PHRASES, Phrase } from '../services/phrases';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import * as Speech from 'expo-speech';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useProgressStore } from '../stores/useProgressStore';

type Category = 'Greetings' | 'Shopping' | 'Travel' | 'Food' | 'Emergency';

const CATEGORIES: Category[] = ['Greetings', 'Shopping', 'Travel', 'Food', 'Emergency'];

export default function PracticeScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [selectedCategory, setSelectedCategory] = useState<Category>('Greetings');
  const [activePhraseId, setActivePhraseId] = useState<string | null>(null);
  const dueCount = useProgressStore((state) => state.dueCount);

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');

  useEffect(() => {
    if (isFocused) {
      useProgressStore.getState().loadProgress().catch(console.error);
    }
  }, [isFocused]);

  // Stop speech when leaving screen
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const handleSpeak = (phrase: Phrase) => {
    Speech.stop();

    if (activePhraseId === phrase.id) {
      setActivePhraseId(null);
      return;
    }

    setActivePhraseId(phrase.id);
    Speech.speak(phrase.english, {
      onDone: () => setActivePhraseId(null),
      onStopped: () => setActivePhraseId(null),
      onError: (err) => {
        console.error(err);
        setActivePhraseId(null);
      },
    });
  };

  const filteredPhrases = PRACTICAL_PHRASES.filter((p) => p.category === selectedCategory);

  const renderPhraseCard = ({ item }: { item: Phrase }) => {
    const isPlaying = activePhraseId === item.id;
    return (
      <RNView style={[styles.card, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={styles.cardContent}>
          <Text style={styles.odiaText}>{item.odia}</Text>
          <Text style={styles.englishText}>{item.english}</Text>
        </RNView>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleSpeak(item)}
          style={[
            styles.speakButton,
            { borderColor: borderCol },
            isPlaying && { backgroundColor: tintCol, borderColor: tintCol },
          ]}
        >
          <Text style={[styles.speakIcon, isPlaying && { color: '#FFFFFF' }]}>
            {isPlaying ? '🔊' : '🔈'}
          </Text>
        </TouchableOpacity>
      </RNView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Learning Path Banner */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Curriculum')}
        style={[styles.studyBanner, { backgroundColor: tintCol + '15', borderColor: tintCol }]}
      >
        <RNView style={styles.bannerTextContainer}>
          <Text style={[styles.bannerTitle, { color: tintCol }]}>🗺️ Learning Path</Text>
          <Text style={styles.bannerSubtitle}>
            Learn Odia step-by-step through units, lessons, and interactive exercises.
          </Text>
        </RNView>
        <Text style={[styles.bannerArrow, { color: tintCol }]}>→</Text>
      </TouchableOpacity>

      {/* Study Banner */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Flashcard')}
        style={[styles.studyBanner, { backgroundColor: tintCol + '15', borderColor: tintCol, marginTop: Theme.spacing.sm }]}
      >
        <RNView style={styles.bannerTextContainer}>
          <Text style={[styles.bannerTitle, { color: tintCol }]}>🗂 Study Flashcards</Text>
          <Text style={styles.bannerSubtitle}>
            {dueCount > 0
              ? `${dueCount} ${dueCount === 1 ? 'card' : 'cards'} due for review today.`
              : 'Interactive flip cards (all caught up!).'}
          </Text>
        </RNView>
        <Text style={[styles.bannerArrow, { color: tintCol }]}>→</Text>
      </TouchableOpacity>

      {/* Quiz Banner */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Quiz')}
        style={[styles.studyBanner, { backgroundColor: tintCol + '15', borderColor: tintCol, marginTop: Theme.spacing.sm }]}
      >
        <RNView style={styles.bannerTextContainer}>
          <Text style={[styles.bannerTitle, { color: tintCol }]}>📝 Quiz Challenge</Text>
          <Text style={styles.bannerSubtitle}>Test your Odia vocabulary with multiple choice questions.</Text>
        </RNView>
        <Text style={[styles.bannerArrow, { color: tintCol }]}>→</Text>
      </TouchableOpacity>

      {/* AI Conversation Partner Banner */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('AiChat')}
        style={[styles.studyBanner, { backgroundColor: tintCol + '15', borderColor: tintCol, marginTop: Theme.spacing.sm }]}
      >
        <RNView style={styles.bannerTextContainer}>
          <Text style={[styles.bannerTitle, { color: tintCol }]}>🤖 Speak with AI Tutor</Text>
          <Text style={styles.bannerSubtitle}>Practice your conversational English with an AI voice partner.</Text>
        </RNView>
        <Text style={[styles.bannerArrow, { color: tintCol }]}>→</Text>
      </TouchableOpacity>

      {/* AI Pronunciation Coach Banner */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('PronunciationCoach')}
        style={[styles.studyBanner, { backgroundColor: tintCol + '15', borderColor: tintCol, marginTop: Theme.spacing.sm }]}
      >
        <RNView style={styles.bannerTextContainer}>
          <Text style={[styles.bannerTitle, { color: tintCol }]}>🗣️ AI Pronunciation Coach</Text>
          <Text style={styles.bannerSubtitle}>Speak English sentences and get instant feedback on your accent.</Text>
        </RNView>
        <Text style={[styles.bannerArrow, { color: tintCol }]}>→</Text>
      </TouchableOpacity>

      {/* Category selector */}
      <RNView style={[styles.filterBar, { borderBottomColor: borderCol }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedCategory(cat);
                  Speech.stop();
                  setActivePhraseId(null);
                }}
                style={[
                  styles.filterTab,
                  { borderColor: borderCol },
                  isSelected && { backgroundColor: tintCol, borderColor: tintCol },
                ]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    isSelected && { color: '#FFFFFF', fontWeight: '700' },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </RNView>

      <FlatList
        data={filteredPhrases}
        keyExtractor={(item) => item.id}
        renderItem={renderPhraseCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBar: {
    borderBottomWidth: 1,
    paddingVertical: Theme.spacing.md,
  },
  filterScroll: {
    paddingHorizontal: Theme.spacing.xl,
  },
  filterTab: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.xl,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    marginRight: Theme.spacing.sm,
  },
  filterTabText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  listContent: {
    padding: Theme.spacing.xl,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  cardContent: {
    flex: 1,
    paddingRight: Theme.spacing.md,
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
  speakButton: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.round,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakIcon: {
    fontSize: 18,
  },
  studyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginHorizontal: Theme.spacing.xl,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.xs,
  },
  bannerTextContainer: {
    flex: 1,
    paddingRight: Theme.spacing.md,
  },
  bannerTitle: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#6B7280',
  },
  bannerArrow: {
    fontSize: Theme.typography.fontSize.lg,
    fontWeight: Theme.typography.fontWeight.bold,
  },
});
