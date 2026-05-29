import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Clipboard,
  Platform,
  useColorScheme,
  View as RNView,
} from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { translateOdiaToEnglish } from '../services/gemini';
import { OdiaTextInput } from '../components/OdiaTextInput';
import * as Speech from 'expo-speech';
import { useUserStore } from '../stores/useUserStore';
import { useProgressStore } from '../stores/useProgressStore';
import { useChallengeStore } from '../stores/useChallengeStore';

interface WordInfo {
  word: string;
  phonetic: string;
  startIndex: number;
  endIndex: number;
}

function parseWords(translation: string, rawWords: { word: string; phonetic: string }[]): WordInfo[] {
  let searchIndex = 0;
  return rawWords.map((item) => {
    const lowerTranslation = translation.toLowerCase();
    const cleanWord = item.word
      .toLowerCase()
      .replace(/^[.,\/#!$%\^&\*;:{}=\-_`~()?"']+|[.,\/#!$%\^&\*;:{}=\-_`~()?"']+$/g, '');

    let startIndex = lowerTranslation.indexOf(cleanWord, searchIndex);
    if (startIndex === -1) {
      startIndex = lowerTranslation.indexOf(cleanWord);
    }

    const wordLength = cleanWord.length > 0 ? cleanWord.length : item.word.length;
    const endIndex = startIndex !== -1 ? startIndex + wordLength : searchIndex + item.word.length;

    if (startIndex !== -1) {
      searchIndex = endIndex;
    }

    return {
      word: item.word,
      phonetic: item.phonetic,
      startIndex: startIndex !== -1 ? startIndex : 0,
      endIndex: endIndex,
    };
  });
}

export default function TranslateScreen() {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [parsedWords, setParsedWords] = useState<WordInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Speech states
  const [speechState, setSpeechState] = useState<'stopped' | 'speaking' | 'paused'>('stopped');
  const [speechRate, setSpeechRate] = useState<0.7 | 1.0 | 1.3>(1.0);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');

  const savedTranslations = useProgressStore((state) => state.savedTranslations);
  const getTranslationFromCache = useProgressStore((state) => state.getTranslationFromCache);
  const saveTranslationToCache = useProgressStore((state) => state.saveTranslationToCache);
  const addTranslationToHistory = useProgressStore((state) => state.addHistory);

  const netInfo = useNetInfo();
  const colorScheme = useColorScheme();
  const isOffline = netInfo.isConnected === false;
  const isDark = colorScheme === 'dark';

  // Stop speech when screen unmounts
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // Check if current translation is saved
  useEffect(() => {
    if (inputText.trim() && translatedText.trim()) {
      const exists = savedTranslations.some(
        (item) => item.odia.trim() === inputText.trim() && item.english.trim() === translatedText.trim()
      );
      setIsSaved(exists);
    } else {
      setIsSaved(false);
    }
  }, [inputText, translatedText, savedTranslations]);

  const handleToggleSave = async () => {
    if (!inputText.trim() || !translatedText.trim()) return;

    try {
      await useProgressStore.getState().toggleSaveTranslation(inputText, translatedText);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      setError('Empty Input: Please enter some Odia text to translate.');
      return;
    }

    // Validate if the input text contains Odia characters (Unicode block: 0B00-0B7F)
    const odiaRegex = /[\u0B00-\u0B7F]/;
    if (!odiaRegex.test(inputText)) {
      setError('Unsupported Characters: The input does not contain Odia script characters. Please type in Odia (e.g., ନମସ୍କାର).');
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setCopied(false);
    
    // Stop any active speech
    Speech.stop();
    useUserStore.getState().updateStreak().catch(console.error);
    setSpeechState('stopped');
    setActiveWordIndex(null);

    if (isOffline) {
      try {
        const cached = await getTranslationFromCache(inputText);
        if (cached) {
          setTranslatedText(cached.translation);
          const words = parseWords(cached.translation, cached.words);
          setParsedWords(words);
          // Log offline hit to history
          await addTranslationToHistory(inputText, cached.translation);
        } else {
          setError('No Internet Connection: You are currently offline and this phrase is not in your local cache. Please check your network and try again.');
          setTranslatedText('');
          setParsedWords([]);
        }
      } catch (err) {
        setError('Error retrieving translation from cache.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const result = await translateOdiaToEnglish(inputText);
      setTranslatedText(result.translation);
      
      const words = parseWords(result.translation, result.words);
      setParsedWords(words);

      // Save to local cache
      await saveTranslationToCache(inputText, result);
      // Log successful translation to history
      await addTranslationToHistory(inputText, result.translation);
      // Daily challenge progress
      useChallengeStore.getState().incrementProgress('translate_sentence', 1).catch(console.error);
    } catch (err: any) {
      // Fallback to cache if Gemini fails
      try {
        const cached = await getTranslationFromCache(inputText);
        if (cached) {
          setTranslatedText(cached.translation);
          const words = parseWords(cached.translation, cached.words);
          setParsedWords(words);
          setError(null);
          // Log fallback hit to history
          await addTranslationToHistory(inputText, cached.translation);
        } else {
          setError('API Translation Error: We encountered an issue communicating with the translation server. Please check your internet connection or try again later.');
          setTranslatedText('');
          setParsedWords([]);
        }
      } catch (cacheErr) {
        setError('API Translation Error: We encountered an issue communicating with the translation server. Please check your internet connection or try again later.');
        setTranslatedText('');
        setParsedWords([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSpeak = (rateOverride?: 0.7 | 1.0 | 1.3) => {
    if (!translatedText) return;

    const rate = rateOverride ?? speechRate;

    if (speechState === 'paused' && Platform.OS === 'ios') {
      Speech.resume();
      setSpeechState('speaking');
      return;
    }

    Speech.stop();

    Speech.speak(translatedText, {
      rate: rate,
      onStart: () => {
        setSpeechState('speaking');
        setActiveWordIndex(null);
      },
      onDone: () => {
        setSpeechState('stopped');
        setActiveWordIndex(null);
      },
      onStopped: () => {
        setSpeechState('stopped');
        setActiveWordIndex(null);
      },
      onBoundary: (event: { charIndex: number; charLength: number }) => {
        const { charIndex } = event;
        const wordIdx = parsedWords.findIndex(
          (w) => charIndex >= w.startIndex && charIndex <= w.endIndex
        );
        if (wordIdx !== -1) {
          setActiveWordIndex(wordIdx);
        }
      },
      onError: (err) => {
        console.error('Speech error:', err);
        setSpeechState('stopped');
        setActiveWordIndex(null);
      },
    });
  };

  const handlePause = () => {
    if (Platform.OS === 'ios') {
      Speech.pause();
      setSpeechState('paused');
    }
  };

  const handleStop = () => {
    Speech.stop();
    setSpeechState('stopped');
    setActiveWordIndex(null);
  };

  const handleCopyToClipboard = () => {
    if (translatedText) {
      Clipboard.setString(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const onTextChange = (text: string) => {
    setInputText(text);
    if (error) setError(null);
    if (speechState !== 'stopped') {
      handleStop();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {isOffline && (
        <RNView
          style={[
            styles.offlineBanner,
            {
              backgroundColor: isDark ? '#3E2723' : '#FFF3E0',
              borderColor: isDark ? '#D84315' : '#FFB74D',
            },
          ]}
        >
          <Text style={[styles.offlineBannerText, { color: isDark ? '#FFCC80' : '#E65100' }]}>
            ⚠️ You are offline. Translations are limited to cached history.
          </Text>
        </RNView>
      )}

      <Text style={styles.label}>Odia Text Input</Text>
      
      <OdiaTextInput
        value={inputText}
        onChangeText={onTextChange}
        placeholder="Odia text here..."
        maxCharacters={1000}
      />

      {error && (
        <RNView style={[styles.errorBox, { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }]}>
          <Text style={styles.errorText}>{error}</Text>
        </RNView>
      )}

      <RNView style={styles.buttonRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={loading || !inputText.trim()}
          style={[
            styles.translateButton,
            {
              backgroundColor: tintCol,
              opacity: loading || !inputText.trim() ? 0.6 : 1,
            },
          ]}
          onPress={handleTranslate}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.translateButtonText}>Translate</Text>
          )}
        </TouchableOpacity>
      </RNView>

      <Text style={styles.label}>English Translation & Pronunciation Breakdown</Text>
      <RNView style={[styles.resultContainer, { backgroundColor: cardCol, borderColor: borderCol }]}>
        {translatedText ? (
          <>
            <RNView style={styles.wordsWrapper}>
              {parsedWords.map((item, index) => {
                const isActive = activeWordIndex === index;
                return (
                  <RNView
                    key={index}
                    style={[
                      styles.wordCard,
                      { borderColor: borderCol },
                      isActive && { backgroundColor: tintCol, borderColor: tintCol },
                    ]}
                  >
                    <Text
                      style={[
                        styles.wordText,
                        isActive && { color: '#FFFFFF', fontWeight: '700' },
                      ]}
                    >
                      {item.word}
                    </Text>
                    <Text
                      style={[
                        styles.phoneticText,
                        isActive ? { color: '#FFE4E6' } : { color: '#9CA3AF' },
                      ]}
                    >
                      {item.phonetic}
                    </Text>
                  </RNView>
                );
              })}
            </RNView>

            <RNView style={styles.actionsRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.copyButton, { borderColor: borderCol, flex: 1, marginRight: Theme.spacing.sm }]}
                onPress={handleCopyToClipboard}
              >
                <Text style={[styles.copyButtonText, { color: tintCol }]}>
                  {copied ? 'Copied ✓' : 'Copy Sentence'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  styles.saveButton,
                  { borderColor: borderCol },
                  isSaved && { backgroundColor: tintCol + '15', borderColor: tintCol },
                ]}
                onPress={handleToggleSave}
              >
                <Text style={[styles.saveButtonText, { color: tintCol }]}>
                  {isSaved ? '★ Bookmarked' : '☆ Bookmark'}
                </Text>
              </TouchableOpacity>
            </RNView>
          </>
        ) : (
          <Text style={styles.placeholderText}>
            Translation will appear here after typing Odia text and tapping Translate.
          </Text>
        )}
      </RNView>

      {/* Speech Section */}
      {translatedText ? (
        <RNView style={[styles.speechContainer, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.speechTitle}>Read Translation Aloud</Text>
          
          <RNView style={styles.rateRow}>
            <Text style={styles.rateLabel}>Speed:</Text>
            <RNView style={styles.rateButtons}>
              {([0.7, 1.0, 1.3] as const).map((rate) => (
                <TouchableOpacity
                  key={rate}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSpeechRate(rate);
                    if (speechState === 'speaking') {
                      Speech.stop();
                      setTimeout(() => {
                        handleSpeak(rate);
                      }, 100);
                    }
                  }}
                  style={[
                    styles.rateButton,
                    { borderColor: borderCol },
                    speechRate === rate && { backgroundColor: tintCol, borderColor: tintCol },
                  ]}
                >
                  <Text
                    style={[
                      styles.rateButtonText,
                      speechRate === rate && { color: '#FFFFFF' },
                    ]}
                  >
                    {rate === 0.7 ? 'Slow' : rate === 1.0 ? 'Normal' : 'Fast'}
                  </Text>
                </TouchableOpacity>
              ))}
            </RNView>
          </RNView>

          <RNView style={styles.controlsRow}>
            {speechState !== 'speaking' ? (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.controlButton, { backgroundColor: tintCol }]}
                onPress={() => handleSpeak()}
              >
                <Text style={styles.controlButtonText}>
                  {speechState === 'paused' ? '▶ Resume' : '🔊 Read Aloud'}
                </Text>
              </TouchableOpacity>
            ) : (
              <RNView style={styles.multiControlsRow}>
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.controlButton, { backgroundColor: '#F59E0B', flex: 1, marginRight: Theme.spacing.sm }]}
                    onPress={handlePause}
                  >
                    <Text style={styles.controlButtonText}>⏸ Pause</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.controlButton,
                    { backgroundColor: '#EF4444', flex: 1 },
                    Platform.OS !== 'ios' && { marginLeft: 0 },
                  ]}
                  onPress={handleStop}
                >
                  <Text style={styles.controlButtonText}>⏹ Stop</Text>
                </TouchableOpacity>
              </RNView>
            )}
          </RNView>
        </RNView>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Theme.spacing.xl,
    paddingBottom: 40,
  },
  label: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.bold,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xs,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  errorText: {
    color: '#DC2626',
    fontSize: Theme.typography.fontSize.sm,
    lineHeight: Theme.typography.lineHeight.sm,
  },
  buttonRow: {
    marginBottom: Theme.spacing.xl,
  },
  translateButton: {
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
  translateButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  resultContainer: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    minHeight: 120,
    justifyContent: 'center',
    marginBottom: Theme.spacing.xl,
  },
  resultText: {
    fontSize: Theme.typography.fontSize.md - 1,
    lineHeight: Theme.typography.lineHeight.md,
    marginBottom: Theme.spacing.lg,
  },
  placeholderText: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#9CA3AF',
    lineHeight: Theme.typography.lineHeight.sm,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  copyButton: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.xs + 2,
    paddingVertical: Theme.spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  copyButtonText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  saveButton: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.xs + 2,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  saveButtonText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  speechContainer: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginTop: Theme.spacing.xs,
  },
  speechTitle: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.semibold,
    marginBottom: Theme.spacing.md,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  rateLabel: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#6B7280',
    marginRight: Theme.spacing.md,
    fontWeight: Theme.typography.fontWeight.medium,
  },
  rateButtons: {
    flexDirection: 'row',
    flex: 1,
  },
  rateButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.sm,
    paddingVertical: Theme.spacing.xs,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  rateButtonText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.medium,
  },
  controlsRow: {
    width: '100%',
  },
  multiControlsRow: {
    flexDirection: 'row',
    width: '100%',
  },
  controlButton: {
    borderRadius: Theme.borderRadius.sm,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  wordsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Theme.spacing.lg,
  },
  wordCard: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordText: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  phoneticText: {
    fontSize: Theme.typography.fontSize.xs - 2,
    marginTop: 2,
  },
  offlineBanner: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: Theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBannerText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.bold,
  },
});
