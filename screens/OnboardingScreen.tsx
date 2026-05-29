import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View as RNView, Dimensions, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LottieView from 'lottie-react-native';

import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import PeacockMascot, { MascotState } from '../components/PeacockMascot';
import { PLACEMENT_QUESTIONS, getPlacementUnit } from '../services/placementTest';
import { useUserStore } from '../stores/useUserStore';
import { useProgressStore } from '../stores/useProgressStore';

const { width } = Dimensions.get('window');

type ScreenState = 'intro' | 'quiz' | 'results' | 'interests';

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const [screenState, setScreenState] = useState<ScreenState>('intro');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [isCompleting, setIsCompleting] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Theme colors
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');
  const textMutedCol = useThemeColor({}, 'textMuted');

  // Animation values for transition
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const currentQuestion = PLACEMENT_QUESTIONS[currentQuestionIndex];

  // Animate question progress bar
  useEffect(() => {
    if (screenState === 'quiz') {
      Animated.timing(progressAnim, {
        toValue: (currentQuestionIndex + 1) / PLACEMENT_QUESTIONS.length,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [currentQuestionIndex, screenState]);

  // Handle transition between states/questions with fade animation
  const transitionTo = (nextState: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      nextState();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleStartTest = () => {
    transitionTo(() => {
      setScreenState('quiz');
      setCurrentQuestionIndex(0);
      setSelectedOption(null);
      setIsAnswerChecked(false);
      setScore(0);
      setMascotState('idle');
    });
  };

  const handleSkipTest = async () => {
    setIsCompleting(true);
    try {
      await useUserStore.getState().completeOnboarding(1, 0);
      await useUserStore.getState().loadUser();
      transitionTo(() => {
        setScreenState('interests');
        setMascotState('idle');
      });
    } catch (e) {
      console.error('Failed to complete onboarding directly:', e);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleSelectOption = (option: string) => {
    if (isAnswerChecked) return;
    setSelectedOption(option);
  };

  const handleCheckAnswer = () => {
    if (!selectedOption || isAnswerChecked) return;

    const isCorrect = selectedOption === currentQuestion.english;
    setIsAnswerChecked(true);

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setMascotState('happy');
    } else {
      setMascotState('sad');
    }
  };

  const handleContinue = () => {
    if (currentQuestionIndex < PLACEMENT_QUESTIONS.length - 1) {
      transitionTo(() => {
        setCurrentQuestionIndex((prev) => prev + 1);
        setSelectedOption(null);
        setIsAnswerChecked(false);
        setMascotState('idle');
      });
    } else {
      transitionTo(() => {
        setScreenState('results');
        setMascotState('celebrate');
      });
    }
  };

  const handleFinish = async () => {
    setIsCompleting(true);
    const placedUnit = getPlacementUnit(score);
 
    try {
      const userStore = useUserStore.getState();
      const progressStore = useProgressStore.getState();
 
      // 1. Mark lessons completed in SQLite based on placement
      if (placedUnit === 2) {
        // Skip Unit 1 (lessons u1_l1, u1_l2)
        await progressStore.completeLesson('u1_l1', 1, 11);
        await progressStore.completeLesson('u1_l2', 1, 11);
        await userStore.addXp(100, 'Placement Test Skip (Unit 1)');
      } else if (placedUnit === 3) {
        // Skip Unit 1 & Unit 2 (lessons u1_l1, u1_l2, u2_l1, u2_l2)
        await progressStore.completeLesson('u1_l1', 1, 11);
        await progressStore.completeLesson('u1_l2', 1, 11);
        await progressStore.completeLesson('u2_l1', 2, 11);
        await progressStore.completeLesson('u2_l2', 2, 11);
        await userStore.addXp(200, 'Placement Test Skip (Unit 1 & 2)');
      }
 
      // 2. Set onboarding completed flag
      await userStore.completeOnboarding(placedUnit, score);
      
      // Reload stores to make sure everything is up-to-date
      await userStore.loadUser();
      await progressStore.loadProgress();
 
      transitionTo(() => {
        setScreenState('interests');
        setMascotState('idle');
      });
    } catch (e) {
      console.error('Failed to save placement progress:', e);
    } finally {
      setIsCompleting(false);
    }
  };
 
  const handleSaveInterests = async () => {
    if (selectedInterests.length === 0) return;
    setIsCompleting(true);
    try {
      const userStore = useUserStore.getState();
      await userStore.updateProfile({ interests: selectedInterests });
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (e) {
      console.error('Failed to save user interests:', e);
    } finally {
      setIsCompleting(false);
    }
  };

  const renderIntro = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <RNView style={styles.mascotContainer}>
        <PeacockMascot state={mascotState} size={150} />
      </RNView>
      <Text style={styles.title}>Let's see what you know!</Text>
      <Text style={[styles.description, { color: textMutedCol }]}>
        Take a quick 10-question placement test. We will place you at the right unit and skip lessons you already know so you don't get bored.
      </Text>

      <RNView style={styles.introButtonContainer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.primaryButton, { backgroundColor: tintCol }]}
          onPress={handleStartTest}
        >
          <Text style={styles.primaryButtonText}>Take Placement Test</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.secondaryButton, { borderColor: borderCol }]}
          onPress={handleSkipTest}
          disabled={isCompleting}
        >
          <Text style={[styles.secondaryButtonText, { color: tintCol }]}>Start from Scratch (Beginner)</Text>
        </TouchableOpacity>
      </RNView>
    </Animated.View>
  );

  const renderQuiz = () => {
    const isCorrect = selectedOption === currentQuestion?.english;
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <Animated.View style={[styles.quizContainer, { opacity: fadeAnim }]}>
        {/* Progress header */}
        <RNView style={styles.quizHeader}>
          <Text style={[styles.progressText, { color: textMutedCol }]}>
            Question {currentQuestionIndex + 1} of {PLACEMENT_QUESTIONS.length}
          </Text>
          <RNView style={[styles.progressBarBackground, { backgroundColor: borderCol }]}>
            <Animated.View style={[styles.progressBarFill, { backgroundColor: tintCol, width: progressWidth }]} />
          </RNView>
        </RNView>

        {/* Mascot reacting */}
        <RNView style={styles.mascotQuizContainer}>
          <PeacockMascot state={mascotState} size={110} />
        </RNView>

        {/* Question Card */}
        <RNView style={[styles.questionCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={[styles.questionLabel, { color: textMutedCol }]}>What is the English translation for:</Text>
          <Text style={[styles.questionOdia, { color: textCol }]}>{currentQuestion?.odia}</Text>
        </RNView>

        {/* Options */}
        <RNView style={styles.optionsContainer}>
          {currentQuestion?.options.map((option) => {
            const isSelected = selectedOption === option;
            let optionStyle = {};
            let textStyle = {};

            if (isAnswerChecked) {
              if (option === currentQuestion.english) {
                optionStyle = { backgroundColor: '#E8F5E9', borderColor: '#4CAF50', borderWidth: 2 };
                textStyle = { color: '#2E7D32', fontWeight: 'bold' };
              } else if (isSelected) {
                optionStyle = { backgroundColor: '#FFEBEE', borderColor: '#F44336', borderWidth: 2 };
                textStyle = { color: '#C62828', fontWeight: 'bold' };
              } else {
                optionStyle = { opacity: 0.6, borderColor: borderCol };
              }
            } else if (isSelected) {
              optionStyle = { borderColor: tintCol, borderWidth: 2, backgroundColor: cardCol };
              textStyle = { color: tintCol, fontWeight: 'bold' };
            } else {
              optionStyle = { borderColor: borderCol, backgroundColor: cardCol };
            }

            return (
              <TouchableOpacity
                key={option}
                activeOpacity={0.8}
                style={[styles.optionButton, optionStyle]}
                onPress={() => handleSelectOption(option)}
                disabled={isAnswerChecked}
              >
                <Text style={[styles.optionText, { color: textCol }, textStyle]}>{option}</Text>
                {isAnswerChecked && option === currentQuestion.english && (
                  <Text style={styles.checkIndicator}>✓</Text>
                )}
                {isAnswerChecked && isSelected && option !== currentQuestion.english && (
                  <Text style={[styles.checkIndicator, { color: '#F44336' }]}>✗</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </RNView>

        {/* Bottom Panel */}
        <RNView style={styles.bottomBar}>
          {!isAnswerChecked ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.actionButton,
                { backgroundColor: selectedOption ? tintCol : borderCol }
              ]}
              onPress={handleCheckAnswer}
              disabled={!selectedOption}
            >
              <Text style={styles.actionButtonText}>Check</Text>
            </TouchableOpacity>
          ) : (
            <RNView style={[
              styles.feedbackBanner,
              { backgroundColor: isCorrect ? '#E8F5E9' : '#FFEBEE', borderColor: isCorrect ? '#C8E6C9' : '#FFCDD2' }
            ]}>
              <RNView style={styles.feedbackTextContainer}>
                <Text style={[styles.feedbackTitle, { color: isCorrect ? '#2E7D32' : '#C62828' }]}>
                  {isCorrect ? 'Correct! 🎉' : 'Incorrect 💔'}
                </Text>
                {!isCorrect && (
                  <Text style={[styles.feedbackDetail, { color: '#C62828' }]}>
                    Correct answer: {currentQuestion.english}
                  </Text>
                )}
              </RNView>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.actionButton, { backgroundColor: isCorrect ? '#4CAF50' : '#F44336', marginTop: 0, width: 120 }]}
                onPress={handleContinue}
              >
                <Text style={styles.actionButtonText}>Continue</Text>
              </TouchableOpacity>
            </RNView>
          )}
        </RNView>
      </Animated.View>
    );
  };

  const renderResults = () => {
    const placedUnit = getPlacementUnit(score);
    let placementTitle = '';
    let placementDesc = '';
    let unlockedItems: string[] = [];

    if (placedUnit === 1) {
      placementTitle = 'Unit 1: Greetings';
      placementDesc = "We recommend starting from the absolute basics to build a strong foundation in Odia.";
      unlockedItems = ['👋 Hello & Welcome', '🗣️ Basic Phrases'];
    } else if (placedUnit === 2) {
      placementTitle = 'Unit 2: Numbers';
      placementDesc = "Excellent! You skipped Unit 1 (Greetings) and will start learning numbers and counting.";
      unlockedItems = ['👋 Unit 1 (Completed & Skipped)', '🔢 Unit 2: Numbers (Active)'];
    } else {
      placementTitle = 'Unit 3: Family';
      placementDesc = "Wow, you already know a lot! You skipped Unit 1 and 2, and will start directly at Family terms.";
      unlockedItems = [
        '👋 Unit 1 (Completed & Skipped)',
        '🔢 Unit 2 (Completed & Skipped)',
        '👪 Unit 3: Family (Active)'
      ];
    }

    return (
      <Animated.View style={[styles.resultsContainer, { opacity: fadeAnim }]}>
        {/* Fullscreen Lottie confetti */}
        <LottieView
          source={require('../assets/animations/confetti.json')}
          autoPlay
          loop={false}
          style={styles.confettiLottie}
          resizeMode="cover"
        />

        <RNView style={styles.mascotResultsContainer}>
          <PeacockMascot state={mascotState} size={160} />
        </RNView>

        <Text style={styles.resultsScore}>You scored {score} / 10!</Text>
        <Text style={styles.resultsPlacementHeader}>Your Placement:</Text>
        <Text style={[styles.resultsPlacementTitle, { color: tintCol }]}>{placementTitle}</Text>
        <Text style={[styles.resultsPlacementDesc, { color: textMutedCol }]}>{placementDesc}</Text>

        <RNView style={[styles.unlockedBox, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.unlockedTitle}>Placement Breakdown:</Text>
          {unlockedItems.map((item, idx) => (
            <Text key={idx} style={[styles.unlockedItem, { color: textCol }]}>
              {item}
            </Text>
          ))}
          {placedUnit > 1 && (
            <Text style={[styles.xpBonusText, { color: '#4CAF50' }]}>
              🎁 Starter Bonus: +{placedUnit === 2 ? '100' : '200'} XP & Level 2!
            </Text>
          )}
        </RNView>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.primaryButton, { backgroundColor: tintCol, marginTop: Theme.spacing.xl, width: '100%' }]}
          onPress={handleFinish}
          disabled={isCompleting}
        >
          <Text style={styles.primaryButtonText}>
            {isCompleting ? 'Saving...' : 'Start Learning!'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
 
  const renderInterests = () => {
    const interestOptions = [
      { id: 'sports', label: 'Sports', emoji: '⚽' },
      { id: 'food', label: 'Food', emoji: '🍔' },
      { id: 'travel', label: 'Travel', emoji: '✈️' },
      { id: 'business', label: 'Business', emoji: '💼' },
    ];
 
    const toggleInterest = (id: string) => {
      setSelectedInterests((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    };
 
    return (
      <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
        <RNView style={styles.mascotContainer}>
          <PeacockMascot state="happy" size={130} />
        </RNView>
        <Text style={styles.title}>What are your interests?</Text>
        <Text style={[styles.description, { color: textMutedCol, marginBottom: Theme.spacing.lg }]}>
          Select one or more topics. We'll generate custom English pronunciation challenges tailored to your interests!
        </Text>
 
        <RNView style={styles.interestsGrid}>
          {interestOptions.map((opt) => {
            const isSelected = selectedInterests.includes(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                activeOpacity={0.8}
                onPress={() => toggleInterest(opt.id)}
                style={[
                  styles.interestCard,
                  {
                    backgroundColor: cardCol,
                    borderColor: isSelected ? tintCol : borderCol,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <Text style={styles.interestEmoji}>{opt.emoji}</Text>
                <Text style={[styles.interestLabel, { color: textCol }]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </RNView>
 
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.primaryButton,
            {
              backgroundColor: selectedInterests.length > 0 ? tintCol : borderCol,
              marginTop: Theme.spacing.xl,
              width: '100%',
            },
          ]}
          onPress={handleSaveInterests}
          disabled={selectedInterests.length === 0 || isCompleting}
        >
          <Text style={styles.primaryButtonText}>
            {isCompleting ? 'Saving...' : 'Finish & Start Learning!'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
 
  return (
    <View style={styles.container}>
      <RNView style={styles.body}>
        {screenState === 'intro' && renderIntro()}
        {screenState === 'quiz' && renderQuiz()}
        {screenState === 'results' && renderResults()}
        {screenState === 'interests' && renderInterests()}
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: Theme.spacing.xxl,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  stepContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  mascotContainer: {
    marginBottom: Theme.spacing.xxl,
    alignItems: 'center',
  },
  title: {
    fontSize: Theme.typography.fontSize.xxl,
    fontWeight: Theme.typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
  },
  description: {
    fontSize: Theme.typography.fontSize.md,
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeight.md + 2,
    marginBottom: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.md,
  },
  introButtonContainer: {
    width: '100%',
    gap: Theme.spacing.md,
  },
  primaryButton: {
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  secondaryButton: {
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  quizContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
  },
  quizHeader: {
    width: '100%',
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  progressText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.semibold,
    marginBottom: Theme.spacing.xs,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  mascotQuizContainer: {
    alignItems: 'center',
    marginVertical: Theme.spacing.sm,
  },
  questionCard: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: Theme.spacing.md,
  },
  questionLabel: {
    fontSize: Theme.typography.fontSize.xs + 1,
    fontWeight: Theme.typography.fontWeight.semibold,
    marginBottom: Theme.spacing.sm,
    textTransform: 'uppercase',
  },
  questionOdia: {
    fontSize: Theme.typography.fontSize.xxxl - 4,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  optionsContainer: {
    width: '100%',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  optionButton: {
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  optionText: {
    fontSize: Theme.typography.fontSize.md + 1,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  checkIndicator: {
    fontSize: Theme.typography.fontSize.xl,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  bottomBar: {
    width: '100%',
    minHeight: 80,
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  actionButton: {
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  feedbackBanner: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  feedbackTextContainer: {
    flex: 1,
    marginRight: Theme.spacing.md,
  },
  feedbackTitle: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: 2,
  },
  feedbackDetail: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  resultsContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiLottie: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    pointerEvents: 'none',
  },
  mascotResultsContainer: {
    marginBottom: Theme.spacing.lg,
  },
  resultsScore: {
    fontSize: Theme.typography.fontSize.xl,
    fontWeight: Theme.typography.fontWeight.bold,
    color: '#4CAF50',
    marginBottom: Theme.spacing.sm,
  },
  resultsPlacementHeader: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.semibold,
    color: '#6B7280',
  },
  resultsPlacementTitle: {
    fontSize: Theme.typography.fontSize.xxl + 2,
    fontWeight: Theme.typography.fontWeight.bold,
    marginVertical: Theme.spacing.xs,
  },
  resultsPlacementDesc: {
    fontSize: Theme.typography.fontSize.md - 1,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xl,
    lineHeight: Theme.typography.lineHeight.md,
    marginBottom: Theme.spacing.xl,
  },
  unlockedBox: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  unlockedTitle: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.xs,
  },
  unlockedItem: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  xpBonusText: {
    fontSize: Theme.typography.fontSize.sm + 1,
    fontWeight: Theme.typography.fontWeight.bold,
    marginTop: Theme.spacing.sm,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: Theme.spacing.lg,
  },
  interestCard: {
    width: '47%',
    height: 110,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  interestEmoji: {
    fontSize: 32,
    marginBottom: Theme.spacing.xs,
  },
  interestLabel: {
    fontSize: Theme.typography.fontSize.sm + 1,
    fontWeight: '700',
  },
});
