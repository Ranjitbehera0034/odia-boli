import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  useColorScheme,
  View as RNView,
  Dimensions,
} from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useUserStore } from '../stores/useUserStore';
import { useProgressStore } from '../stores/useProgressStore';
import { analyzePronunciation, PronunciationWordScore, Challenge } from '../services/gemini';
import { getDB } from '../services/srs';
import { useChallengeStore } from '../stores/useChallengeStore';

const CHALLENGES: Challenge[] = [
  {
    id: 'th',
    text: "Think about the thin thing they threw there.",
    focus: "'th' sounds (think, thin, they, there)",
    odia: "ସେଠାରେ ସେମାନେ ଫିଙ୍ଗିଥିବା ପତଳା ଜିନିଷ ବିଷୟରେ ଚିନ୍ତା କରନ୍ତୁ |",
    difficulty: 'Medium',
  },
  {
    id: 'rl',
    text: "Red leather, yellow leather.",
    focus: "'r' and 'l' alternation",
    odia: "ଲାଲ୍ ଚମଡା, ହଳଦିଆ ଚମଡା |",
    difficulty: 'Easy',
  },
  {
    id: 's',
    text: "She sells seashells by the seashore.",
    focus: "'s' and 'sh' sibilants",
    odia: "ସେ ସମୁଦ୍ର କୂଳରେ ଶାମୁକା ବିକ୍ରି କରନ୍ତି |",
    difficulty: 'Hard',
  },
  {
    id: 'w',
    text: "We surely shall see the sun shine.",
    focus: "'w', 'sh', and 's' sounds",
    odia: "ଆମେ ନିଶ୍ଚିତ ଭାବରେ ସୂର୍ଯ୍ୟ କିରଣ ଦେଖିବା |",
    difficulty: 'Medium',
  },
  {
    id: 'p',
    text: "A proper copper coffee pot.",
    focus: "'p', 'c', and short 'o' vowels",
    odia: "ଏକ ସଠିକ୍ ତମ୍ବା କଫି ପାତ୍ର |",
    difficulty: 'Easy',
  },
];

const screenWidth = Dimensions.get('window').width;

export default function PronunciationCoachScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const userStore = useUserStore();
  const progressStore = useProgressStore();

  const smartSentences = progressStore.smartSentences || [];
  const allChallenges = [...CHALLENGES, ...smartSentences];

  const [activeChallenge, setActiveChallenge] = useState<Challenge>(CHALLENGES[0]);

  // Load smart sentences on mount
  useEffect(() => {
    progressStore.loadSmartSentences().catch(console.error);
  }, []);

  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  
  // Real-time amplitude values for 15 visualizer bars
  const [waveformLevels, setWaveformLevels] = useState<number[]>(Array(15).fill(0.08));
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Speech (TTS) State
  const [isPlayingTts, setIsPlayingTts] = useState(false);

  // User playback state
  const [userSound, setUserSound] = useState<Audio.Sound | null>(null);
  const [isPlayingUserAudio, setIsPlayingUserAudio] = useState(false);

  // Analysis result state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [generalFeedback, setGeneralFeedback] = useState<string | null>(null);
  const [wordScores, setWordScores] = useState<PronunciationWordScore[]>([]);

  // Historic scores loaded from SQLite
  const [historicWordScores, setHistoricWordScores] = useState<{ [word: string]: number }>({});

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');
  const textMutedCol = useThemeColor({}, 'textMuted');
  const backgroundCol = useThemeColor({}, 'background');

  // Load historic scores whenever active challenge changes
  useEffect(() => {
    loadHistoricScores(activeChallenge.text);
    resetAttemptState();
  }, [activeChallenge]);

  // Clean up sounds and timers on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
      if (userSound) {
        userSound.unloadAsync().catch(console.error);
      }
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, [userSound]);

  const cleanWord = (w: string) => {
    return w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim().toLowerCase();
  };

  const loadHistoricScores = async (sentence: string) => {
    try {
      const db = getDB();
      const words = sentence
        .split(/\s+/)
        .map(cleanWord)
        .filter(Boolean);

      if (words.length === 0) {
        setHistoricWordScores({});
        return;
      }

      const placeholders = words.map(() => '?').join(',');
      const query = `SELECT word, score FROM pronunciation_scores WHERE word IN (${placeholders});`;
      const rows = await db.getAllAsync<{ word: string; score: number }>(query, words);
      
      const scoreMap: { [word: string]: number } = {};
      if (rows) {
        rows.forEach((r) => {
          scoreMap[r.word] = r.score;
        });
      }
      setHistoricWordScores(scoreMap);
    } catch (error) {
      console.error('Failed to load historic word scores:', error);
    }
  };

  const resetAttemptState = () => {
    setRecordingUri(null);
    setOverallScore(null);
    setGeneralFeedback(null);
    setWordScores([]);
    setWaveformLevels(Array(15).fill(0.08));
    setRecordingDuration(0);
    if (userSound) {
      userSound.unloadAsync().catch(console.error);
      setUserSound(null);
    }
    setIsPlayingUserAudio(false);
  };

  const playCorrectPronunciation = () => {
    Speech.stop();
    if (isPlayingTts) {
      setIsPlayingTts(false);
      return;
    }
    setIsPlayingTts(true);
    // slightly slowed down voice (rate: 0.85) for optimal learning clarity
    Speech.speak(activeChallenge.text, {
      language: 'en-US',
      rate: 0.85,
      onDone: () => setIsPlayingTts(false),
      onStopped: () => setIsPlayingTts(false),
      onError: (err) => {
        console.error(err);
        setIsPlayingTts(false);
      },
    });
  };

  const speakIndividualWord = (word: string) => {
    const cleanStr = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
    Speech.stop();
    Speech.speak(cleanStr, { language: 'en-US', rate: 0.80 });
  };

  const startVoiceRecording = async () => {
    try {
      Speech.stop();
      if (userSound) {
        await userSound.unloadAsync().catch(console.error);
        setUserSound(null);
      }
      setIsPlayingUserAudio(false);

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone Permission Required 🎙️',
          'Please grant microphone access in system settings to analyze your pronunciation.'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });

      newRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && typeof status.metering === 'number') {
          // Normalize metering (dB) from range [-60, -10] to [0.08, 1.0]
          const minDb = -60;
          const maxDb = -10;
          const db = status.metering;
          let level = (db - minDb) / (maxDb - minDb);
          if (level < 0.08) level = 0.08;
          if (level > 1.0) level = 1.0;

          setWaveformLevels((prev) => [...prev.slice(1), level]);
        }
      });

      await newRecording.startAsync();
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      recordingTimer.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start voice recording:', err);
      Alert.alert('Recording Error ⚠️', 'Failed to initialize voice recording. Please try again.');
    }
  };

  const stopVoiceRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      // Restore standard audio settings
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (uri) {
        setRecordingUri(uri);
        await runPronunciationAnalysis(uri);
      }
    } catch (err) {
      console.error('Failed to stop voice recording:', err);
      Alert.alert('Recording Error ⚠️', 'Failed to stop and finalize the recording.');
    }
  };

  // Convert audio file uri to base64 utilizing browser FileReader blob polyfill
  const convertUriToBase64 = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read recording file contents.'));
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const rawBase64 = reader.result.split(',')[1];
          resolve(rawBase64);
        } else {
          reject(new Error('File reader payload was not a valid string.'));
        }
      };
      reader.readAsDataURL(blob);
    });
  };

  const runPronunciationAnalysis = async (uri: string) => {
    setIsAnalyzing(true);
    try {
      const base64Data = await convertUriToBase64(uri);
      const result = await analyzePronunciation(base64Data, activeChallenge.text);

      setOverallScore(result.score);
      setGeneralFeedback(result.feedback);
      setWordScores(result.words);

      // Save word-level scores to SQLite database
      const db = getDB();
      const now = Date.now();
      for (const w of result.words) {
        const cleanW = cleanWord(w.word);
        if (!cleanW) continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO pronunciation_scores (word, score, feedback, updated_at)
           VALUES (?, ?, ?, ?);`,
          [cleanW, w.score, result.feedback, now]
        );
      }

      // Add XP to user profile
      const earnedXp = result.score >= 80 ? 10 : result.score >= 50 ? 5 : 2;
      await userStore.addXp(earnedXp, 'AI Pronunciation Coach');

      // Daily challenge progress — count each pronunciation analysis
      useChallengeStore.getState().incrementProgress('pronunciation_count', 1).catch(console.error);

      // Reload historic mapping to keep screen indicators in sync
      await loadHistoricScores(activeChallenge.text);

      // Trigger bidirectional sync automatically via background import trigger
      try {
        const { useSyncStore } = require('../stores/useSyncStore');
        useSyncStore.getState().sync().catch(console.error);
      } catch (syncErr) {
        console.error('Failed to trigger background store sync:', syncErr);
      }

    } catch (err: any) {
      console.error(err);
      Alert.alert('Analysis Failed ⚠️', err.message || 'Gemini was unable to analyze this recording. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const playRecordedAttempt = async () => {
    if (!recordingUri) return;
    Speech.stop();

    try {
      if (userSound) {
        if (isPlayingUserAudio) {
          await userSound.stopAsync();
          setIsPlayingUserAudio(false);
          return;
        }
        await userSound.playAsync();
        setIsPlayingUserAudio(true);
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recordingUri },
        { shouldPlay: true }
      );

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingUserAudio(false);
        }
      });

      setUserSound(newSound);
      setIsPlayingUserAudio(true);

    } catch (err) {
      console.error('Failed to play recorded attempt:', err);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to resolve color style for a word based on current results or history
  const getWordHighlight = (word: string) => {
    const cleanW = cleanWord(word);
    
    // Check if we have active results from the current attempt
    const activeMatch = wordScores.find((ws) => cleanWord(ws.word) === cleanW);
    let score = activeMatch?.score;

    // Fallback to historic SQLite data if no current score is available
    if (score === undefined) {
      score = historicWordScores[cleanW];
    }

    if (score === undefined) {
      return {
        textColor: textCol,
        bgColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6',
      };
    }

    if (score >= 80) {
      return {
        textColor: isDark ? '#34D399' : '#059669', // Green
        bgColor: isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.1)',
      };
    } else if (score >= 50) {
      return {
        textColor: isDark ? '#FBBF24' : '#D97706', // Orange / Amber
        bgColor: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(245, 158, 11, 0.1)',
      };
    } else {
      return {
        textColor: isDark ? '#F87171' : '#DC2626', // Red
        bgColor: isDark ? 'rgba(248, 113, 113, 0.15)' : 'rgba(239, 68, 68, 0.1)',
      };
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: backgroundCol }]} contentContainerStyle={styles.contentContainer}>
      
      {/* 1. Swipable Challenges Carousel */}
      <RNView style={styles.carouselSection}>
        <RNView style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: textMutedCol, marginBottom: 0 }]}>SELECT A CHALLENGE</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={progressStore.isGeneratingSmartSentences}
            onPress={async () => {
              try {
                await progressStore.generateSmartSentencesAction(true);
                Alert.alert('Challenges Generated ✨', 'Fresh custom challenges have been generated based on your interests!');
              } catch (e) {
                console.error(e);
                Alert.alert('Generation Failed ⚠️', 'Could not generate new challenges. Please check connection and try again.');
              }
            }}
            style={styles.regenerateBtn}
          >
            {progressStore.isGeneratingSmartSentences ? (
              <ActivityIndicator size="small" color={tintCol} />
            ) : (
              <Text style={[styles.regenerateBtnText, { color: tintCol }]}>✨ Refresh AI</Text>
            )}
          </TouchableOpacity>
        </RNView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselScroll}>
          {allChallenges.map((challenge) => {
            const isSelected = activeChallenge.id === challenge.id;
            const isAiGenerated = challenge.id.startsWith('ai') || !CHALLENGES.some(c => c.id === challenge.id);
            return (
              <TouchableOpacity
                key={challenge.id}
                activeOpacity={0.8}
                onPress={() => {
                  if (isRecording || isAnalyzing) return;
                  setActiveChallenge(challenge);
                }}
                style={[
                  styles.challengeCard,
                  {
                    backgroundColor: cardCol,
                    borderColor: isSelected ? tintCol : borderCol,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <RNView style={styles.cardHeaderRow}>
                  <Text
                    style={[
                      styles.difficultyTag,
                      {
                        color:
                          challenge.difficulty === 'Easy'
                            ? '#10B981'
                            : challenge.difficulty === 'Medium'
                            ? '#F59E0B'
                            : '#EF4444',
                        backgroundColor:
                          challenge.difficulty === 'Easy'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : challenge.difficulty === 'Medium'
                            ? 'rgba(245, 158, 11, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                      },
                    ]}
                  >
                    {challenge.difficulty}
                  </Text>
                  {isAiGenerated ? (
                    <Text style={styles.aiTag}>✨ AI</Text>
                  ) : (
                    <Text style={styles.focusLabel}>{challenge.id.toUpperCase()}</Text>
                  )}
                </RNView>
                <Text numberOfLines={2} style={[styles.challengeCardText, { color: textCol }]}>
                  {challenge.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </RNView>

      {/* 2. Target Sentence Presentation Card */}
      <RNView style={[styles.sentenceCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <Text style={[styles.cardTag, { color: tintCol }]}>FOCUS: {activeChallenge.focus}</Text>
        
        {/* Clickable Words list */}
        <RNView style={styles.sentenceWordsRow}>
          {activeChallenge.text.split(/\s+/).map((word, idx) => {
            const colors = getWordHighlight(word);
            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.7}
                onPress={() => speakIndividualWord(word)}
                style={[styles.wordChip, { backgroundColor: colors.bgColor }]}
              >
                <Text style={[styles.wordText, { color: colors.textColor }]}>
                  {word}
                </Text>
              </TouchableOpacity>
            );
          })}
        </RNView>

        <Text style={[styles.odiaTranslation, { color: textMutedCol }]}>
          {activeChallenge.odia}
        </Text>
        
        <Text style={styles.helperTip}>
          💡 Tap any word above to listen to its correct native pronunciation.
        </Text>
      </RNView>

      {/* 3. Real-Time Waveform & Voice Recorders */}
      <RNView style={styles.recordingSection}>
        {isRecording && (
          <RNView style={styles.activeRecordingPanel}>
            <Text style={[styles.timerText, { color: tintCol }]}>{formatTimer(recordingDuration)}</Text>
            
            {/* Custom Metering Waveform Bar Component */}
            <RNView style={styles.waveformContainer}>
              {waveformLevels.map((lvl, index) => (
                <RNView
                  key={index}
                  style={[
                    styles.waveformBar,
                    {
                      height: lvl * 56,
                      backgroundColor: tintCol,
                    },
                  ]}
                />
              ))}
            </RNView>
            <Text style={[styles.recordSubtext, { color: textMutedCol }]}>Recording... Speak clearly now</Text>
          </RNView>
        )}

        {isAnalyzing && (
          <RNView style={styles.analyzingContainer}>
            <ActivityIndicator size="large" color={tintCol} />
            <Text style={[styles.analyzingText, { color: textCol }]}>
              Gemini is assessing your accent and scores...
            </Text>
          </RNView>
        )}

        {!isRecording && !isAnalyzing && (
          <RNView style={styles.controlsRow}>
            {/* Play target TTS button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={playCorrectPronunciation}
              style={[styles.smallControlBtn, { backgroundColor: cardCol, borderColor: borderCol }]}
            >
              <Text style={styles.controlBtnIcon}>{isPlayingTts ? '⏹️' : '🔊'}</Text>
              <Text style={[styles.controlBtnText, { color: textCol }]}>Listen Guide</Text>
            </TouchableOpacity>

            {/* Main Record Action Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={startVoiceRecording}
              style={[styles.mainRecordBtn, { backgroundColor: tintCol }]}
            >
              <Text style={styles.mainRecordIcon}>🎙️</Text>
            </TouchableOpacity>

            {/* Play user attempt button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={playRecordedAttempt}
              disabled={!recordingUri}
              style={[
                styles.smallControlBtn,
                { backgroundColor: cardCol, borderColor: borderCol, opacity: recordingUri ? 1 : 0.4 },
              ]}
            >
              <Text style={styles.controlBtnIcon}>{isPlayingUserAudio ? '⏹️' : '🎧'}</Text>
              <Text style={[styles.controlBtnText, { color: textCol }]}>Your Voice</Text>
            </TouchableOpacity>
          </RNView>
        )}

        {isRecording && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={stopVoiceRecording}
            style={[styles.stopRecordingBtn, { backgroundColor: '#EF4444' }]}
          >
            <Text style={styles.stopRecordingText}>⏹️ Stop & Analyze</Text>
          </TouchableOpacity>
        )}
      </RNView>

      {/* 4. Score and Feedback Analysis Cards */}
      {overallScore !== null && generalFeedback && (
        <RNView style={styles.resultsWrapper}>
          
          {/* Circular overall score representation */}
          <RNView style={[styles.scoreCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
            <RNView style={[styles.scoreCircle, { borderColor: overallScore >= 80 ? '#10B981' : overallScore >= 50 ? '#F59E0B' : '#EF4444' }]}>
              <Text style={[styles.scorePercent, { color: textCol }]}>{overallScore}%</Text>
              <Text style={styles.scoreLabel}>ACCURACY</Text>
            </RNView>
            <Text style={[styles.encouragementText, { color: textCol }]}>
              {overallScore >= 80
                ? 'Excellent Job! 🏆'
                : overallScore >= 50
                ? 'Well Done! Getting Closer! 👍'
                : 'Keep Practicing! You can do it! 💪'}
            </Text>
          </RNView>

          {/* Detailed feedback text */}
          <RNView style={[styles.feedbackCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
            <RNView style={styles.feedbackHeaderRow}>
              <Text style={styles.tutorAvatar}>🤖</Text>
              <Text style={[styles.feedbackTitle, { color: textCol }]}>Tutor Accent Coaching</Text>
            </RNView>
            <Text style={[styles.feedbackText, { color: textCol }]}>
              {generalFeedback}
            </Text>
          </RNView>

        </RNView>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 48,
  },
  carouselSection: {
    marginTop: Theme.spacing.lg,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: Theme.spacing.sm,
  },
  carouselScroll: {
    paddingLeft: Theme.spacing.xl,
    paddingRight: Theme.spacing.md,
  },
  challengeCard: {
    width: screenWidth * 0.72,
    height: 110,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
    marginRight: Theme.spacing.md,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  difficultyTag: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    textTransform: 'uppercase',
  },
  focusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  challengeCardText: {
    fontSize: Theme.typography.fontSize.sm + 1,
    fontWeight: '600',
    lineHeight: 20,
  },
  sentenceCard: {
    marginHorizontal: Theme.spacing.xl,
    marginTop: Theme.spacing.xl,
    borderWidth: 1,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTag: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.0,
    marginBottom: Theme.spacing.sm,
    textTransform: 'uppercase',
  },
  sentenceWordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'transparent',
    marginVertical: Theme.spacing.sm,
  },
  wordChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 8,
  },
  wordText: {
    fontSize: Theme.typography.fontSize.md + 1,
    fontWeight: '700',
  },
  odiaTranslation: {
    fontSize: Theme.typography.fontSize.xs + 1,
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: Theme.spacing.xs,
  },
  helperTip: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: Theme.spacing.md,
    lineHeight: 14,
  },
  recordingSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.xxl,
    backgroundColor: 'transparent',
  },
  activeRecordingPanel: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    width: '100%',
  },
  timerText: {
    fontSize: Theme.typography.fontSize.xxl,
    fontWeight: 'bold',
    marginBottom: Theme.spacing.sm,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    width: '80%',
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.md,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
    marginHorizontal: 3,
  },
  recordSubtext: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  analyzingContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: Theme.spacing.md,
  },
  analyzingText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: '600',
    marginTop: Theme.spacing.sm,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '75%',
    backgroundColor: 'transparent',
  },
  smallControlBtn: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  controlBtnIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  controlBtnText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  mainRecordBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  mainRecordIcon: {
    fontSize: 36,
  },
  stopRecordingBtn: {
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  stopRecordingText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: Theme.typography.fontSize.sm + 1,
  },
  resultsWrapper: {
    backgroundColor: 'transparent',
    marginHorizontal: Theme.spacing.xl,
    marginTop: Theme.spacing.xxl,
  },
  scoreCard: {
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: Theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    marginBottom: Theme.spacing.md,
  },
  scorePercent: {
    fontSize: Theme.typography.fontSize.xxl + 2,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  encouragementText: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: '700',
  },
  feedbackCard: {
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  feedbackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.md,
  },
  tutorAvatar: {
    fontSize: 24,
    marginRight: Theme.spacing.sm,
  },
  feedbackTitle: {
    fontSize: Theme.typography.fontSize.sm + 1,
    fontWeight: '700',
  },
  feedbackText: {
    fontSize: Theme.typography.fontSize.sm,
    lineHeight: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.sm,
    backgroundColor: 'transparent',
  },
  regenerateBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  regenerateBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  aiTag: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#E65100',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
});
