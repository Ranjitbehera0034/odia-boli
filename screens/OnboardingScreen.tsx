import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, Image, View as RNView, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const [currentStep, setCurrentStep] = useState(0);

  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    setCurrentStep(2);
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem('@odia_agent:onboarding_completed', 'true');
      // Reset navigation stack to MainTabs
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (e) {
      console.error('Failed to complete onboarding:', e);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <RNView style={styles.stepContainer}>
            <Image source={require('../assets/icon.png')} style={styles.logo} />
            <Text style={styles.title}>Welcome to Odia Agent</Text>
            <Text style={styles.description}>
              Explore the beauty of the Odia language and Odisha's rich cultural heritage. Master everyday conversations through interactive translation tools.
            </Text>
          </RNView>
        );
      case 1:
        return (
          <RNView style={styles.stepContainer}>
            <Text style={styles.title}>Features & Tools</Text>
            <Text style={styles.subtitle}>Here is how you can use the app to learn:</Text>

            <RNView style={styles.featuresList}>
              <RNView style={[styles.featureRow, { backgroundColor: cardCol, borderColor: borderCol }]}>
                <Text style={styles.featureIcon}>🗣️</Text>
                <RNView style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>Translate & Speak</Text>
                  <Text style={styles.featureDesc}>Get instant translations and phonetic pronunciation guides. Play and pause audio synthesis.</Text>
                </RNView>
              </RNView>

              <RNView style={[styles.featureRow, { backgroundColor: cardCol, borderColor: borderCol }]}>
                <Text style={styles.featureIcon}>🗂️</Text>
                <RNView style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>Study Flashcards</Text>
                  <Text style={styles.featureDesc}>Swipe cards to memorize daily-use phrases and log your learning progress locally.</Text>
                </RNView>
              </RNView>

              <RNView style={[styles.featureRow, { backgroundColor: cardCol, borderColor: borderCol }]}>
                <Text style={styles.featureIcon}>📝</Text>
                <RNView style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>Quiz Challenges</Text>
                  <Text style={styles.featureDesc}>Test your vocabulary with multiple choice questions, and build daily study streaks.</Text>
                </RNView>
              </RNView>
            </RNView>
          </RNView>
        );
      case 2:
        return (
          <RNView style={styles.stepContainer}>
            <Text style={styles.congratulationsEmoji}>🎯</Text>
            <Text style={styles.title}>Ready to Begin?</Text>
            <Text style={styles.description}>
              Your progress will be saved automatically, and you can track your heatmaps directly in settings. Start practicing today!
            </Text>
          </RNView>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Top action header */}
      <RNView style={styles.header}>
        {currentStep < 2 ? (
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: tintCol }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <RNView style={styles.headerSpacer} />
        )}
      </RNView>

      {/* Main Slide Container */}
      <RNView style={styles.body}>{renderStepContent()}</RNView>

      {/* Footer controls */}
      <RNView style={styles.footer}>
        {/* Page dot indicator */}
        <RNView style={styles.indicatorContainer}>
          {[0, 1, 2].map((index) => (
            <RNView
              key={index}
              style={[
                styles.dot,
                { backgroundColor: borderCol },
                currentStep === index && { backgroundColor: tintCol, width: 20 },
              ]}
            />
          ))}
        </RNView>

        {/* Buttons */}
        <RNView style={styles.buttonRow}>
          {currentStep > 0 ? (
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.navButton, styles.backButton, { borderColor: tintCol }]}
              onPress={handleBack}
            >
              <Text style={[styles.navButtonText, { color: tintCol }]}>Back</Text>
            </TouchableOpacity>
          ) : (
            <RNView style={styles.navButtonPlaceholder} />
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.navButton, styles.nextButton, { backgroundColor: tintCol }]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              {currentStep === 2 ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </RNView>
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: Theme.spacing.xxl,
  },
  header: {
    height: 40,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Theme.spacing.xl,
    alignItems: 'center',
  },
  headerSpacer: {
    height: 40,
  },
  skipButton: {
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
  },
  skipText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
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
  logo: {
    width: 140,
    height: 140,
    borderRadius: Theme.borderRadius.lg + 4,
    marginBottom: Theme.spacing.xl,
  },
  title: {
    fontSize: Theme.typography.fontSize.xxl - 2,
    fontWeight: Theme.typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
    lineHeight: Theme.typography.lineHeight.xxl,
  },
  subtitle: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  description: {
    fontSize: Theme.typography.fontSize.sm + 1,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: Theme.typography.lineHeight.md + 2,
    paddingHorizontal: Theme.spacing.sm,
  },
  featuresList: {
    width: '100%',
    marginTop: Theme.spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
    elevation: 1,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: Theme.spacing.md,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: Theme.typography.fontSize.sm + 1,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: Theme.typography.fontSize.xs,
    color: '#6B7280',
    lineHeight: Theme.typography.lineHeight.xs + 2,
  },
  congratulationsEmoji: {
    fontSize: 64,
    marginBottom: Theme.spacing.xl,
  },
  footer: {
    paddingHorizontal: Theme.spacing.xl,
    alignItems: 'center',
    marginTop: Theme.spacing.lg,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingBottom: Theme.spacing.md,
  },
  navButton: {
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  backButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
    marginRight: Theme.spacing.md,
  },
  navButtonPlaceholder: {
    flex: 1,
    marginRight: Theme.spacing.md,
  },
  nextButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navButtonText: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
});
