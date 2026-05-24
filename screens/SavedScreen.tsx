import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  View as RNView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import * as Speech from 'expo-speech';

interface SavedTranslation {
  id: string;
  odia: string;
  english: string;
  timestamp: number;
}

const STORAGE_KEY = '@odia_agent:saved_translations';

export default function SavedScreen() {
  const [items, setItems] = useState<SavedTranslation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');

  useEffect(() => {
    loadSavedTranslations();
  }, []);

  const loadSavedTranslations = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedTranslation[];
        setItems(parsed.sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const nextItems = items.filter((item) => item.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
      setItems(nextItems);
      if (activeSpeechId === id) {
        Speech.stop();
        setActiveSpeechId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSpeak = (item: SavedTranslation) => {
    Speech.stop();
    if (activeSpeechId === item.id) {
      setActiveSpeechId(null);
      return;
    }

    setActiveSpeechId(item.id);
    Speech.speak(item.english, {
      onDone: () => setActiveSpeechId(null),
      onStopped: () => setActiveSpeechId(null),
      onError: (err) => {
        console.error(err);
        setActiveSpeechId(null);
      },
    });
  };

  const filteredItems = items.filter(
    (item) =>
      item.odia.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.english.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: SavedTranslation }) => {
    const isSpeaking = activeSpeechId === item.id;
    return (
      <RNView style={[styles.card, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={styles.cardContent}>
          <Text style={styles.odiaText}>{item.odia}</Text>
          <Text style={styles.englishText}>{item.english}</Text>
        </RNView>
        
        <RNView style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleSpeak(item)}
            style={[
              styles.actionButton,
              { borderColor: borderCol },
              isSpeaking && { backgroundColor: tintCol, borderColor: tintCol },
            ]}
          >
            <Text style={[styles.actionIcon, isSpeaking && { color: '#FFFFFF' }]}>
              {isSpeaking ? '🔊' : '🔈'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleDelete(item.id)}
            style={[styles.actionButton, { borderColor: borderCol }]}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </RNView>
      </RNView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <RNView style={[styles.searchBarContainer, { borderBottomColor: borderCol }]}>
        <TextInput
          placeholder="Search saved translations..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={[styles.searchInput, { borderColor: borderCol, backgroundColor: cardCol, color: textCol }]}
        />
      </RNView>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <RNView style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching translations found.' : 'Your bookmarked translations will appear here.'}
            </Text>
          </RNView>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarContainer: {
    borderBottomWidth: 1,
    padding: Theme.spacing.md,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: Theme.typography.fontSize.sm,
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
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.xs,
  },
  englishText: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
    lineHeight: Theme.typography.lineHeight.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.round,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Theme.spacing.xs,
  },
  actionIcon: {
    fontSize: 14,
  },
  deleteIcon: {
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
});
