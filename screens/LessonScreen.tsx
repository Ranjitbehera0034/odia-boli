import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  View as RNView,
  Alert,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CURRICULUM, Exercise, Lesson } from '../services/curriculumData';
import { completeLesson } from '../services/curriculum';
import { logActivity } from '../services/streak';
import { isFuzzyMatch, generateWordDiff, DiffWord } from '../services/diff';

const SCREEN_WIDTH = Dimensions.get('window').width;

const shuffleArray = <T,>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export default function LessonScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { lessonId } = route.params;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [unitId, setUnitId] = useState<number>(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Exercise responses state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedJumbleWords, setSelectedJumbleWords] = useState<string[]>([]);
  const [textInputValue, setTextInputValue] = useState('');
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [wordDiffResults, setWordDiffResults] = useState<DiffWord[]>([]);
  const [earnedXp, setEarnedXp] = useState(0);
  const [totalXp, setTotalXp] = useState(0);

  // Match the pairs state
  const [shuffledOdia, setShuffledOdia] = useState<{ id: string; text: string }[]>([]);
  const [shuffledEnglish, setShuffledEnglish] = useState<{ id: string; text: string }[]>([]);
  const [selectedOdia, setSelectedOdia] = useState<string | null>(null);
  const [selectedEnglish, setSelectedEnglish] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [wrongOdia, setWrongOdia] = useState<string | null>(null);
  const [wrongEnglish, setWrongEnglish] = useState<string | null>(null);
  const [correctFlashOdia, setCorrectFlashOdia] = useState<string | null>(null);
  const [correctFlashEnglish, setCorrectFlashEnglish] = useState<string | null>(null);

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');

  useEffect(() => {
    // Load XP from AsyncStorage
    const loadXp = async () => {
      try {
        const storedXp = await AsyncStorage.getItem('@odia_agent:total_xp');
        if (storedXp) {
          setTotalXp(parseInt(storedXp));
        }
      } catch (e) {
        console.error('Failed to load XP:', e);
      }
    };
    loadXp();

    // Find lesson from static CURRICULUM data
    let foundLesson: Lesson | null = null;
    let foundUnitId = 1;
    for (const unit of CURRICULUM) {
      const match = unit.lessons.find((l) => l.id === lessonId);
      if (match) {
        foundLesson = match;
        foundUnitId = unit.id;
        break;
      }
    }

    if (foundLesson) {
      setLesson(foundLesson);
      setUnitId(foundUnitId);
    } else {
      Alert.alert('Error', 'Lesson not found.');
      navigation.goBack();
    }
    setLoading(false);
  }, [lessonId]);

  // Handle TTS and reset of response states when current exercise changes
  useEffect(() => {
    if (!lesson || showCelebration) return;
    
    // Clear states
    setSelectedOption(null);
    setSelectedJumbleWords([]);
    setTextInputValue('');
    setIsAnswerChecked(false);
    setIsAnswerCorrect(false);
    
    setSelectedOdia(null);
    setSelectedEnglish(null);
    setMatchedPairs([]);
    setWrongOdia(null);
    setWrongEnglish(null);
    setCorrectFlashOdia(null);
    setCorrectFlashEnglish(null);
    matchScaleAnims.forEach(anim => anim.setValue(1));
    shakeAnim.setValue(0);

    // Trigger TTS for listening or Odia prompt exercises
    const currentEx = lesson.exercises[currentIndex];
    if (currentEx) {
      if (currentEx.type === 'listening' && currentEx.audioPhrase) {
        playTTS(currentEx.audioPhrase);
      } else if (currentEx.type === 'multiple_choice_or_to_en') {
        playTTS(currentEx.prompt);
      } else if (currentEx.type === 'listen_type') {
        playTTS(currentEx.correctAnswer, 'en');
      } else if (currentEx.type === 'match_pairs' && currentEx.pairs) {
        const odiaList = currentEx.pairs.map((p, idx) => ({ id: `or_${idx}`, text: p.odia }));
        const englishList = currentEx.pairs.map((p, idx) => ({ id: `en_${idx}`, text: p.english }));
        setShuffledOdia(shuffleArray(odiaList));
        setShuffledEnglish(shuffleArray(englishList));
      }
    }

    // Trigger entry slide animation
    slideAnim.setValue(50);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 40,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [currentIndex, lesson, showCelebration]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const playTTS = (text: string, lang = 'or') => {
    try {
      Speech.stop();
      Speech.speak(text, {
        language: lang,
        pitch: 1.0,
        rate: lang === 'or' ? 0.85 : 0.95, // Normal speed for English
        onError: (err) => console.log('Speech error:', err),
      });
    } catch (e) {
      console.warn('Speech engine not available or failed:', e);
    }
  };

  if (loading || !lesson) {
    return null;
  }

  const currentExercise = lesson.exercises[currentIndex];

  const handleExit = () => {
    Alert.alert(
      'Exit Lesson?',
      'Are you sure you want to exit? Your current progress in this lesson will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  };

  const handleCheckAnswer = () => {
    if (isAnswerChecked) return;

    let correct = false;
    const cleanAnswer = currentExercise.correctAnswer.trim().toLowerCase();

    if (currentExercise.type === 'multiple_choice_en_to_or' || currentExercise.type === 'multiple_choice_or_to_en' || currentExercise.type === 'listening') {
      correct = selectedOption === currentExercise.correctAnswer;
    } else if (currentExercise.type === 'word_jumble') {
      const sentence = selectedJumbleWords.join(' ');
      correct = sentence === currentExercise.correctAnswer;
    } else if (currentExercise.type === 'text_input') {
      // Allow slightly fuzzy matching (case insensitive, trimmed spaces, punctuation removed)
      const cleanInput = textInputValue
        .trim()
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '');
      const cleanTarget = cleanAnswer.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '');
      correct = cleanInput === cleanTarget;
    } else if (currentExercise.type === 'translate_sentence' || currentExercise.type === 'listen_type') {
      correct = isFuzzyMatch(textInputValue, currentExercise.correctAnswer);
    }

    setIsAnswerCorrect(correct);
    setIsAnswerChecked(true);

    if (correct) {
      setScore((prev) => prev + 1);
      // Award +10 XP immediately
      const newEarned = earnedXp + 10;
      setEarnedXp(newEarned);
      const newTotal = totalXp + 10;
      setTotalXp(newTotal);
      AsyncStorage.setItem('@odia_agent:total_xp', newTotal.toString()).catch(console.error);
    } else {
      if (currentExercise.type === 'translate_sentence' || currentExercise.type === 'listen_type') {
        const diff = generateWordDiff(textInputValue, currentExercise.correctAnswer);
        setWordDiffResults(diff);
      }
    }

    // Play TTS of the correct Odia phrase if it's not already played
    if (currentExercise.type === 'multiple_choice_en_to_or' || currentExercise.type === 'word_jumble' || currentExercise.type === 'text_input') {
      playTTS(currentExercise.correctAnswer);
    } else if (currentExercise.type === 'listen_type') {
      playTTS(currentExercise.correctAnswer, 'en');
    }
  };

  const handleContinue = async () => {
    if (currentIndex < lesson.exercises.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Completed last exercise! Save progress to SQLite
      const lastCorrect = isAnswerCorrect;
      const finalScore = score + (lastCorrect ? 1 : 0);
      setScore(finalScore);
      
      let finalEarnedXp = earnedXp + (lastCorrect ? 10 : 0);
      let newTotalXp = totalXp + (lastCorrect ? 10 : 0);
      
      // Perfect Score Bonus
      if (finalScore === lesson.exercises.length) {
        finalEarnedXp += 50;
        newTotalXp += 50;
      }
      
      setEarnedXp(finalEarnedXp);
      setTotalXp(newTotalXp);
      await AsyncStorage.setItem('@odia_agent:total_xp', newTotalXp.toString()).catch(console.error);

      // Save stats to DB
      await completeLesson(lesson.id, unitId, finalScore);
      await logActivity().catch(console.error);

      setShowCelebration(true);
    }
  };

  // Word Jumble actions
  const handleTapJumbleChip = (word: string) => {
    if (isAnswerChecked) return;
    setSelectedJumbleWords((prev) => [...prev, word]);
  };

  const handleRemoveJumbleWord = (index: number) => {
    if (isAnswerChecked) return;
    setSelectedJumbleWords((prev) => prev.filter((_, i) => i !== index));
  };

  // Text Input helpers
  const handleTapHelpChip = (char: string) => {
    if (isAnswerChecked) return;
    setTextInputValue((prev) => prev + char);
  };

  // Match the pairs action handlers
  const handleSelectOdia = (word: string) => {
    if (isAnswerChecked) return;
    if (matchedPairs.includes(word)) return;
    if (wrongOdia || correctFlashOdia) return; // Animations running
    
    if (selectedOdia === word) {
      setSelectedOdia(null);
    } else {
      setSelectedOdia(word);
      if (selectedEnglish) {
        checkMatch(word, selectedEnglish);
      }
    }
  };

  const handleSelectEnglish = (word: string) => {
    if (isAnswerChecked) return;
    const pair = currentExercise.pairs?.find(p => p.english === word);
    if (pair && matchedPairs.includes(pair.odia)) return;
    if (wrongEnglish || correctFlashEnglish) return; // Animations running
    
    if (selectedEnglish === word) {
      setSelectedEnglish(null);
    } else {
      setSelectedEnglish(word);
      if (selectedOdia) {
        checkMatch(selectedOdia, word);
      }
    }
  };

  const checkMatch = (odiaWord: string, englishWord: string) => {
    const pairs = currentExercise.pairs || [];
    const pairIndex = pairs.findIndex(p => p.odia === odiaWord && p.english === englishWord);
    
    if (pairIndex !== -1) {
      // Correct pair
      playTTS(odiaWord);
      setCorrectFlashOdia(odiaWord);
      setCorrectFlashEnglish(englishWord);
      
      Animated.timing(matchScaleAnims[pairIndex], {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        setMatchedPairs(prev => {
          const updated = [...prev, odiaWord];
          if (updated.length === 4) {
            setIsAnswerCorrect(true);
            setIsAnswerChecked(true);
            setScore(s => s + 1);
            // Award XP
            setEarnedXp(e => e + 10);
            setTotalXp(t => {
              const newTotal = t + 10;
              AsyncStorage.setItem('@odia_agent:total_xp', newTotal.toString()).catch(console.error);
              return newTotal;
            });
          }
          return updated;
        });
        
        setSelectedOdia(null);
        setSelectedEnglish(null);
        setCorrectFlashOdia(null);
        setCorrectFlashEnglish(null);
      });
    } else {
      // Incorrect pair
      setWrongOdia(odiaWord);
      setWrongEnglish(englishWord);
      
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start(() => {
        setSelectedOdia(null);
        setSelectedEnglish(null);
        setWrongOdia(null);
        setWrongEnglish(null);
      });
    }
  };

  // Rendering input elements based on type
  const renderExerciseInput = () => {
    switch (currentExercise.type) {
      case 'multiple_choice_en_to_or':
      case 'multiple_choice_or_to_en':
      case 'listening':
        return (
          <RNView style={styles.optionsContainer}>
            {currentExercise.options?.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrectOpt = option === currentExercise.correctAnswer;
              
              let optionBg = cardCol;
              let optionBorder = borderCol;
              
              if (isSelected) {
                optionBg = tintCol + '10';
                optionBorder = tintCol;
              }
              if (isAnswerChecked) {
                if (isCorrectOpt) {
                  optionBg = '#10B98115';
                  optionBorder = '#10B981';
                } else if (isSelected && !isAnswerCorrect) {
                  optionBg = '#EF444415';
                  optionBorder = '#EF4444';
                }
              }

              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.8}
                  disabled={isAnswerChecked}
                  onPress={() => setSelectedOption(option)}
                  style={[styles.optionCard, { backgroundColor: optionBg, borderColor: optionBorder }]}
                >
                  <RNView style={styles.optionIndexWrapper}>
                    <Text style={[styles.optionIndex, isSelected && { color: tintCol }]}>
                      {String.fromCharCode(65 + idx)}
                    </Text>
                  </RNView>
                  <Text style={styles.optionText}>{option}</Text>
                  {isAnswerChecked && isCorrectOpt && <Text style={styles.optionStatusIcon}>✅</Text>}
                  {isAnswerChecked && isSelected && !isAnswerCorrect && <Text style={styles.optionStatusIcon}>❌</Text>}
                </TouchableOpacity>
              );
            })}
          </RNView>
        );

      case 'word_jumble':
        const scrambledChips = currentExercise.jumbleWords || [];
        
        return (
          <RNView style={styles.jumbleContainer}>
            {/* Selected words shelf */}
            <RNView style={[styles.jumbleShelf, { borderColor: borderCol, backgroundColor: cardCol }]}>
              {selectedJumbleWords.length === 0 ? (
                <Text style={styles.jumblePlaceholder}>Tap words to translate...</Text>
              ) : (
                <RNView style={styles.jumbleChipsRow}>
                  {selectedJumbleWords.map((word, idx) => (
                    <TouchableOpacity
                      key={idx}
                      disabled={isAnswerChecked}
                      onPress={() => handleRemoveJumbleWord(idx)}
                      style={[styles.jumbleChip, { backgroundColor: tintCol }]}
                    >
                      <Text style={styles.jumbleChipText}>{word}</Text>
                      {!isAnswerChecked && <Text style={styles.jumbleChipRemove}>×</Text>}
                    </TouchableOpacity>
                  ))}
                </RNView>
              )}
            </RNView>

            {/* Scrambled word bank */}
            <Text style={styles.bankLabel}>Word Bank:</Text>
            <RNView style={styles.jumbleBank}>
              {scrambledChips.map((word, idx) => {
                // Count how many times this word has been selected vs its total occurrences in scrambled chips
                const occurrenceInSelected = selectedJumbleWords.filter(w => w === word).length;
                const occurrenceInScrambled = scrambledChips.slice(0, idx + 1).filter(w => w === word).length;
                const isUsed = occurrenceInSelected >= occurrenceInScrambled;

                return (
                  <TouchableOpacity
                    key={idx}
                    disabled={isUsed || isAnswerChecked}
                    onPress={() => handleTapJumbleChip(word)}
                    style={[
                      styles.jumbleBankChip,
                      { borderColor: borderCol, backgroundColor: cardCol },
                      isUsed && { opacity: 0.25 }
                    ]}
                  >
                    <Text style={[styles.jumbleBankChipText, { color: textCol }]}>{word}</Text>
                  </TouchableOpacity>
                );
              })}
            </RNView>
          </RNView>
        );

      case 'text_input':
        const chips = currentExercise.helpChips || [];
        return (
          <RNView style={styles.textInputContainer}>
            <TextInput
              multiline
              value={textInputValue}
              editable={!isAnswerChecked}
              onChangeText={setTextInputValue}
              placeholder="Type your translation here..."
              placeholderTextColor="#9CA3AF"
              style={[
                styles.translationInput,
                { 
                  color: textCol, 
                  backgroundColor: cardCol, 
                  borderColor: isAnswerChecked 
                    ? (isAnswerCorrect ? '#10B981' : '#EF4444') 
                    : borderCol 
                }
              ]}
            />

            {/* Assistance keyboard row */}
            {!isAnswerChecked && chips.length > 0 && (
              <RNView>
                <Text style={styles.keyboardLabel}>Helper Character Chips:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.keyboardScrollView}>
                  {chips.map((char, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => handleTapHelpChip(char)}
                      style={[styles.keyboardKey, { backgroundColor: cardCol, borderColor: borderCol }]}
                    >
                      <Text style={[styles.keyboardKeyText, { color: tintCol }]}>{char}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </RNView>
            )}
          </RNView>
        );

      case 'translate_sentence':
        return (
          <RNView style={styles.textInputContainer}>
            <TextInput
              multiline
              value={textInputValue}
              editable={!isAnswerChecked}
              onChangeText={setTextInputValue}
              placeholder="Type the English translation..."
              placeholderTextColor="#9CA3AF"
              style={[
                styles.translationInput,
                { 
                  color: textCol, 
                  backgroundColor: cardCol, 
                  borderColor: isAnswerChecked 
                    ? (isAnswerCorrect ? '#10B981' : '#EF4444') 
                    : borderCol 
                }
              ]}
            />
          </RNView>
        );

      case 'listen_type':
        return null;

      case 'match_pairs':
        return null;

      default:
        return null;
    }
  };

  if (showCelebration) {
    return (
      <View style={styles.celebrationContainer}>
        <Text style={styles.celebEmoji}>🎉</Text>
        <Text style={styles.celebTitle}>Lesson Completed!</Text>
        <Text style={styles.celebSubtitle}>{lesson.title}</Text>

        <RNView style={[styles.celebCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <RNView style={[styles.scoreBadgeContainer, { backgroundColor: tintCol + '15' }]}>
            <Text style={[styles.celebScore, { color: tintCol }]}>
              {score} / {lesson.exercises.length}
            </Text>
            <Text style={styles.scoreDetailText}>Correct Answers</Text>
          </RNView>

          <RNView style={styles.celebXpRow}>
            <Text style={styles.celebXpLabel}>XP Earned:</Text>
            <Text style={[styles.celebXpValue, { color: '#E2B13C' }]}>+ {earnedXp} XP</Text>
          </RNView>
          {score === lesson.exercises.length && (
            <Text style={styles.celebXpBonusText}>✨ Includes +50 XP Perfect Lesson Bonus! ✨</Text>
          )}

          <Text style={[styles.motivationText, { marginTop: Theme.spacing.md }]}>
            {score === lesson.exercises.length
              ? 'Flawless victory! You are mastering Odia!'
              : score >= lesson.exercises.length - 2
              ? 'Great job! You have solid comprehension.'
              : 'Good effort! Keep practicing to master these phrases.'}
          </Text>
        </RNView>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.goBack()}
          style={[styles.finishButton, { backgroundColor: tintCol }]}
        >
          <Text style={styles.finishButtonText}>Return to Curriculum</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate top progress bar percentage
  const progressPercent = ((currentIndex) / lesson.exercises.length) * 100;
  
  // Decide whether "Check Answer" button is enabled
  let isActionEnabled = false;
  if (currentExercise.type === 'multiple_choice_en_to_or' || currentExercise.type === 'multiple_choice_or_to_en' || currentExercise.type === 'listening') {
    isActionEnabled = selectedOption !== null;
  } else if (currentExercise.type === 'word_jumble') {
    isActionEnabled = selectedJumbleWords.length > 0;
  } else if (currentExercise.type === 'text_input' || currentExercise.type === 'translate_sentence' || currentExercise.type === 'listen_type') {
    isActionEnabled = textInputValue.trim().length > 0;
  }

  return (
    <View style={styles.container}>
      {/* Custom Header with Progress Bar */}
      <RNView style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleExit}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        
        {/* Progress meter */}
        <RNView style={styles.progressMeter}>
          <RNView style={styles.progressBg}>
            <RNView style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: tintCol }]} />
          </RNView>
          <Text style={styles.progressCounter}>
            {currentIndex + 1} / {lesson.exercises.length}
          </Text>
        </RNView>
      </RNView>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          {/* Question Prompt */}
          <RNView style={styles.questionHeader}>
            <Text style={styles.questionInstructions}>
              {currentExercise.type === 'listening' 
                ? '🔊 Listen to the audio and translate:' 
                : currentExercise.type === 'listen_type'
                ? '🔊 Listen and type what you hear:'
                : currentExercise.type === 'match_pairs'
                ? '🧩 Match the pairs:'
                : 'Translate this:'}
            </Text>
            
            <RNView style={styles.promptRow}>
              <Text style={styles.questionPrompt}>
                {currentExercise.type === 'listen_type' ? '🦻 English Listening Comprehension' : currentExercise.prompt}
              </Text>
              
              {(currentExercise.type === 'multiple_choice_or_to_en' || currentExercise.type === 'listening') && (
                <TouchableOpacity
                  onPress={() => playTTS(currentExercise.type === 'listening' ? currentExercise.audioPhrase || '' : currentExercise.prompt)}
                  style={[styles.ttsButton, { backgroundColor: tintCol + '15' }]}
                >
                  <Text style={{ fontSize: 18 }}>🔊</Text>
                </TouchableOpacity>
              )}
            </RNView>
          </RNView>

          {/* Renders Custom Type View */}
          {renderExerciseInput()}
        </Animated.View>
      </ScrollView>

      {/* Bottom Result / Action Banner */}
      <RNView style={[styles.footer, { borderTopColor: borderCol, backgroundColor: cardCol }]}>
        {!isAnswerChecked ? (
          <TouchableOpacity
            disabled={!isActionEnabled}
            onPress={handleCheckAnswer}
            style={[
              styles.actionBtn, 
              { backgroundColor: isActionEnabled ? tintCol : '#E5E7EB' }
            ]}
          >
            <Text style={[styles.actionBtnText, { color: isActionEnabled ? '#FFFFFF' : '#9CA3AF' }]}>
              Check Answer
            </Text>
          </TouchableOpacity>
        ) : (
          <RNView style={styles.resultBanner}>
            <RNView style={styles.resultStatusRow}>
              <Text style={[styles.resultStatusTitle, { color: isAnswerCorrect ? '#10B981' : '#EF4444' }]}>
                {isAnswerCorrect ? '🎉 Correct!' : '😢 Incorrect'}
              </Text>
              {!isAnswerCorrect && (
                <RNView style={styles.correctRevealContainer}>
                  {currentExercise.type === 'listen_type' ? (
                    <RNView style={styles.diffContainerWrapper}>
                      <Text style={styles.correctRevealLabel}>You heard:</Text>
                      <RNView style={styles.diffContainer}>
                        {wordDiffResults.map((word, idx) => {
                          let wordColor = textCol;
                          let textDecoration: 'none' | 'underline' | 'line-through' = 'none';
                          let fontWeight: 'normal' | 'bold' = 'normal';

                          if (word.type === 'correct') {
                            wordColor = '#10B981';
                            fontWeight = 'bold';
                          } else if (word.type === 'incorrect') {
                            wordColor = '#FF9F1C';
                            textDecoration = 'underline';
                          } else if (word.type === 'missing') {
                            wordColor = '#EF4444';
                            textDecoration = 'line-through';
                          }

                          return (
                            <Text
                              key={idx}
                              style={[
                                styles.diffWordText,
                                { 
                                  color: wordColor, 
                                  textDecorationLine: textDecoration,
                                  fontWeight
                                }
                              ]}
                            >
                              {word.text}{' '}
                            </Text>
                          );
                        })}
                      </RNView>
                      <Text style={[styles.correctRevealLabel, { marginTop: 6 }]}>You wrote:</Text>
                      <Text style={[styles.correctRevealText, { color: '#EF4444' }]}>
                        {textInputValue.trim() || '(nothing)'}
                      </Text>
                    </RNView>
                  ) : currentExercise.type === 'translate_sentence' ? (
                    <RNView style={styles.diffContainerWrapper}>
                      <Text style={styles.correctRevealLabel}>Correct Answer:</Text>
                      <RNView style={styles.diffContainer}>
                        {wordDiffResults.map((word, idx) => {
                          let wordColor = textCol;
                          let textDecoration: 'none' | 'underline' | 'line-through' = 'none';
                          let fontWeight: 'normal' | 'bold' = 'normal';

                          if (word.type === 'correct') {
                            wordColor = '#10B981';
                            fontWeight = 'bold';
                          } else if (word.type === 'incorrect') {
                            wordColor = '#FF9F1C';
                            textDecoration = 'underline';
                          } else if (word.type === 'missing') {
                            wordColor = '#EF4444';
                            textDecoration = 'line-through';
                          }

                          return (
                            <Text
                              key={idx}
                              style={[
                                styles.diffWordText,
                                { 
                                  color: wordColor, 
                                  textDecorationLine: textDecoration,
                                  fontWeight
                                }
                              ]}
                            >
                              {word.text}{' '}
                            </Text>
                          );
                        })}
                      </RNView>
                    </RNView>
                  ) : (
                    <RNView>
                      <Text style={styles.correctRevealLabel}>Correct Answer:</Text>
                      <Text style={styles.correctRevealText}>{currentExercise.correctAnswer}</Text>
                    </RNView>
                  )}
                </RNView>
              )}
            </RNView>
            <TouchableOpacity
              onPress={handleContinue}
              style={[
                styles.actionBtn,
                { backgroundColor: isAnswerCorrect ? '#10B981' : '#EF4444' }
              ]}
            >
              <Text style={styles.actionBtnText}>Continue</Text>
            </TouchableOpacity>
          </RNView>
        )}
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  progressMeter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Theme.spacing.md,
  },
  progressBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: Theme.borderRadius.round,
    overflow: 'hidden',
    marginRight: Theme.spacing.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: Theme.borderRadius.round,
  },
  progressCounter: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.bold,
    color: '#6B7280',
    minWidth: 40,
    textAlign: 'right',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: Theme.spacing.xl,
    paddingBottom: 120,
  },
  questionHeader: {
    marginBottom: Theme.spacing.xl,
    backgroundColor: 'transparent',
  },
  questionInstructions: {
    fontSize: Theme.typography.fontSize.xs + 2,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Theme.spacing.xs,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  questionPrompt: {
    fontSize: Theme.typography.fontSize.xl,
    fontWeight: Theme.typography.fontWeight.heavy,
    flex: 1,
  },
  ttsButton: {
    borderRadius: Theme.borderRadius.round,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsContainer: {
    backgroundColor: 'transparent',
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  optionIndexWrapper: {
    width: 28,
    height: 28,
    borderRadius: Theme.borderRadius.round,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
    backgroundColor: 'transparent',
  },
  optionIndex: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.bold,
    color: '#6B7280',
  },
  optionText: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: '500',
    flex: 1,
  },
  optionStatusIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
  jumbleContainer: {
    backgroundColor: 'transparent',
  },
  jumbleShelf: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    minHeight: 80,
    justifyContent: 'center',
    marginBottom: Theme.spacing.lg,
  },
  jumblePlaceholder: {
    color: '#9CA3AF',
    fontSize: Theme.typography.fontSize.sm,
    textAlign: 'center',
  },
  jumbleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'transparent',
  },
  jumbleChip: {
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    margin: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  jumbleChipText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: 'bold',
  },
  jumbleChipRemove: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  bankLabel: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: Theme.spacing.xs,
  },
  jumbleBank: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'transparent',
  },
  jumbleBankChip: {
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    margin: 4,
  },
  jumbleBankChipText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: 'bold',
  },
  textInputContainer: {
    backgroundColor: 'transparent',
  },
  translationInput: {
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    minHeight: 120,
    fontSize: Theme.typography.fontSize.md,
    textAlignVertical: 'top',
    marginBottom: Theme.spacing.lg,
  },
  keyboardLabel: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: Theme.spacing.xs,
  },
  keyboardScrollView: {
    paddingVertical: 4,
  },
  keyboardKey: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.xs + 2,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    marginRight: 6,
    minWidth: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardKeyText: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : Theme.spacing.lg,
    borderTopWidth: 0.5,
  },
  actionBtn: {
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  resultBanner: {
    backgroundColor: 'transparent',
  },
  resultStatusRow: {
    marginBottom: Theme.spacing.md,
    backgroundColor: 'transparent',
  },
  resultStatusTitle: {
    fontSize: Theme.typography.fontSize.md + 1,
    fontWeight: '800',
    marginBottom: 4,
  },
  correctRevealContainer: {
    backgroundColor: 'transparent',
  },
  correctRevealLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  correctRevealText: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 2,
  },
  celebrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xxl,
  },
  celebEmoji: {
    fontSize: 64,
    marginBottom: Theme.spacing.md,
  },
  celebTitle: {
    fontSize: Theme.typography.fontSize.xxl - 2,
    fontWeight: Theme.typography.fontWeight.heavy,
    textAlign: 'center',
  },
  celebSubtitle: {
    fontSize: Theme.typography.fontSize.md,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  celebCard: {
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  scoreBadgeContainer: {
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.borderRadius.xl,
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  celebScore: {
    fontSize: 32,
    fontWeight: Theme.typography.fontWeight.heavy,
  },
  scoreDetailText: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#6B7280',
    fontWeight: 'bold',
    marginTop: 2,
  },
  motivationText: {
    fontSize: Theme.typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeight.sm,
    color: '#4B5563',
  },
  finishButton: {
    width: '100%',
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md,
    fontWeight: 'bold',
  },
  diffContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  diffContainerWrapper: {
    backgroundColor: 'transparent',
  },
  diffWordText: {
    fontSize: Theme.typography.fontSize.md - 1,
  },
  celebXpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
    backgroundColor: 'transparent',
  },
  celebXpLabel: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: 'bold',
    marginRight: 6,
  },
  celebXpValue: {
    fontSize: Theme.typography.fontSize.sm + 2,
    fontWeight: '800',
  },
  celebXpBonusText: {
    fontSize: 10,
    color: '#E2B13C',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  listenTypeContainer: {
    backgroundColor: 'transparent',
  },
  speakerRow: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
    backgroundColor: 'transparent',
  },
  bigSpeakerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bigSpeakerText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: 'bold',
  },
  matchingBoard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Theme.spacing.md,
    backgroundColor: 'transparent',
  },
  matchingColumn: {
    flex: 1,
    marginHorizontal: Theme.spacing.xs,
    backgroundColor: 'transparent',
  },
  matchingCard: {
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.lg,
    marginBottom: Theme.spacing.md,
    height: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  matchingCardButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  matchingCardText: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xs,
  },
});
