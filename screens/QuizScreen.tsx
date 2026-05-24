import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, View as RNView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View } from '../components/Themed';
import { PRACTICAL_PHRASES, Phrase } from '../services/phrases';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useNavigation } from '@react-navigation/native';
import { logActivity } from '../services/streak';

interface QuizQuestion {
  id: string;
  english: string;
  correctOdia: string;
  options: string[];
}

interface UserAnswer {
  questionId: string;
  english: string;
  correctOdia: string;
  selectedOdia: string;
  isCorrect: boolean;
}

function generateQuizQuestions(allPhrases: Phrase[], count: number = 10): QuizQuestion[] {
  const shuffled = [...allPhrases].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.min(count, allPhrases.length));

  return selected.map((phrase) => {
    const otherPhrases = allPhrases.filter((p) => p.id !== phrase.id);
    const shuffledOthers = [...otherPhrases].sort(() => 0.5 - Math.random());
    const distractors = shuffledOthers.slice(0, 3).map((p) => p.odia);
    const options = [phrase.odia, ...distractors].sort(() => 0.5 - Math.random());

    return {
      id: phrase.id,
      english: phrase.english,
      correctOdia: phrase.odia,
      options,
    };
  });
}

export default function QuizScreen() {
  const navigation = useNavigation();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<UserAnswer[]>([]);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');

  useEffect(() => {
    startNewQuiz();
  }, []);

  const startNewQuiz = () => {
    const qData = generateQuizQuestions(PRACTICAL_PHRASES, 10);
    setQuestions(qData);
    setCurrentIndex(0);
    setAnswers([]);
    setQuizFinished(false);
    setSelectedOption(null);
    logActivity().catch(console.error);
  };

  const saveQuizResult = async (finalScore: number) => {
    try {
      const stored = await AsyncStorage.getItem('@odia_agent:quiz_stats');
      let stats = { totalQuizzes: 0, highScore: 0 };
      if (stored) {
        stats = JSON.parse(stored);
      }
      stats.totalQuizzes += 1;
      if (finalScore > stats.highScore) {
        stats.highScore = finalScore;
      }
      await AsyncStorage.setItem('@odia_agent:quiz_stats', JSON.stringify(stats));
    } catch (e) {
      console.error('Failed to save quiz stats', e);
    }
  };

  const handleSelectOption = (option: string) => {
    if (selectedOption !== null) return; // Prevent double selection

    setSelectedOption(option);
    const currentQ = questions[currentIndex];
    const isCorrect = option === currentQ.correctOdia;

    const answer: UserAnswer = {
      questionId: currentQ.id,
      english: currentQ.english,
      correctOdia: currentQ.correctOdia,
      selectedOdia: option,
      isCorrect,
    };

    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);

    // Delay showing next question to let the user see if they were correct
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setSelectedOption(null);
      } else {
        const finalScore = nextAnswers.filter((a) => a.isCorrect).length;
        saveQuizResult(finalScore).catch(console.error);
        setQuizFinished(true);
        logActivity().catch(console.error); // Log again on quiz completion
      }
    }, 800);
  };

  const score = answers.filter((a) => a.isCorrect).length;
  const currentQuestion = questions[currentIndex];

  if (quizFinished) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Quiz Completed Header */}
        <RNView style={[styles.resultHeader, { borderColor: borderCol, backgroundColor: cardCol }]}>
          <Text style={styles.resultTitle}>Quiz Completed!</Text>
          <RNView style={[styles.scoreBadge, { backgroundColor: tintCol + '15' }]}>
            <Text style={[styles.scoreValue, { color: tintCol }]}>
              {score} / {questions.length}
            </Text>
            <Text style={styles.scoreLabel}>Correct Answers</Text>
          </RNView>
        </RNView>

        {/* Question Review Breakdown */}
        <Text style={styles.sectionHeader}>Review Your Answers</Text>
        {answers.map((ans, idx) => (
          <RNView
            key={idx}
            style={[
              styles.reviewCard,
              { backgroundColor: cardCol, borderColor: borderCol },
              ans.isCorrect
                ? { borderLeftWidth: 4, borderLeftColor: '#10B981' }
                : { borderLeftWidth: 4, borderLeftColor: '#EF4444' },
            ]}
          >
            <Text style={styles.reviewIndex}>Question {idx + 1}</Text>
            <Text style={styles.reviewEnglish}>{ans.english}</Text>
            
            <RNView style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Correct:</Text>
              <Text style={[styles.reviewText, { color: '#10B981' }]}>{ans.correctOdia}</Text>
            </RNView>

            {!ans.isCorrect && (
              <RNView style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Your Answer:</Text>
                <Text style={[styles.reviewText, { color: '#EF4444' }]}>{ans.selectedOdia}</Text>
              </RNView>
            )}
          </RNView>
        ))}

        {/* Actions */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.actionButton, { backgroundColor: tintCol }]}
          onPress={startNewQuiz}
        >
          <Text style={styles.actionButtonText}>Retake Quiz</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.outlineButton, { borderColor: tintCol }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.outlineButtonText, { color: tintCol }]}>Close Quiz</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tintCol} />
      </View>
    );
  }

  // Progress percentage
  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <View style={styles.container}>
      {/* Progress indicators */}
      <RNView style={styles.progressHeader}>
        <Text style={styles.progressText}>
          Question {currentIndex + 1} of {questions.length}
        </Text>
        <RNView style={[styles.progressBarContainer, { backgroundColor: borderCol }]}>
          <RNView
            style={[
              styles.progressBarFill,
              { width: `${progressPercent}%`, backgroundColor: tintCol },
            ]}
          />
        </RNView>
      </RNView>

      <RNView style={styles.quizWrapper}>
        {/* Question Prompt */}
        <RNView style={[styles.questionCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.questionLabel}>TRANSLATE THIS PHRASE:</Text>
          <Text style={styles.questionText}>{currentQuestion.english}</Text>
        </RNView>

        {/* Options List */}
        <RNView style={styles.optionsContainer}>
          {currentQuestion.options.map((option) => {
            const isSelected = selectedOption === option;
            const isCorrectOption = option === currentQuestion.correctOdia;
            
            let btnStyle = { backgroundColor: cardCol, borderColor: borderCol };
            let textStyle = {};

            if (selectedOption !== null) {
              if (isCorrectOption) {
                // Correct answer lights up green
                btnStyle = { backgroundColor: '#E6F4EA', borderColor: '#10B981' };
                textStyle = { color: '#137333', fontWeight: '700' };
              } else if (isSelected) {
                // User selected wrong answer lights up red
                btnStyle = { backgroundColor: '#FCE8E6', borderColor: '#C5221F' };
                textStyle = { color: '#C5221F', fontWeight: '700' };
              }
            }

            return (
              <TouchableOpacity
                key={option}
                activeOpacity={0.7}
                disabled={selectedOption !== null}
                style={[styles.optionButton, btnStyle]}
                onPress={() => handleSelectOption(option)}
              >
                <Text style={[styles.optionText, textStyle]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </RNView>
      </RNView>
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressHeader: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.sm,
  },
  progressText: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#6B7280',
    fontWeight: Theme.typography.fontWeight.semibold,
    marginBottom: Theme.spacing.xs,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: Theme.borderRadius.xs,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: Theme.borderRadius.xs,
  },
  quizWrapper: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  questionCard: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  questionLabel: {
    fontSize: Theme.typography.fontSize.xs - 2,
    fontWeight: Theme.typography.fontWeight.bold,
    color: '#6B7280',
    letterSpacing: 1.5,
    marginBottom: Theme.spacing.md,
  },
  questionText: {
    fontSize: Theme.typography.fontSize.xl,
    fontWeight: Theme.typography.fontWeight.bold,
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeight.xl,
  },
  optionsContainer: {
    width: '100%',
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.lg - 2,
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
    elevation: 1,
  },
  optionText: {
    fontSize: Theme.typography.fontSize.md - 1,
    textAlign: 'center',
  },
  resultHeader: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  resultTitle: {
    fontSize: Theme.typography.fontSize.xl,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.lg,
  },
  scoreBadge: {
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xxl,
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: Theme.typography.fontSize.xxxl,
    fontWeight: Theme.typography.fontWeight.heavy,
  },
  scoreLabel: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#6B7280',
    marginTop: Theme.spacing.xs,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  sectionHeader: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.bold,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xs,
  },
  reviewCard: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
    elevation: 1,
  },
  reviewIndex: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  reviewEnglish: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.sm,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  reviewLabel: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#6B7280',
    marginRight: 6,
    width: 90,
  },
  reviewText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.semibold,
    flex: 1,
  },
  actionButton: {
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  outlineButton: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Theme.spacing.sm,
    backgroundColor: 'transparent',
    marginBottom: 20,
  },
  outlineButtonText: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
});
