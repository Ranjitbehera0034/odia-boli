import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View as RNView,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { CURRICULUM, Unit, Lesson } from '../services/curriculumData';
import {
  getUnitProgress,
  getOverallCurriculumProgress,
  getLessonProgress,
  getUserProfile,
  LessonProgress,
  UnitProgress,
} from '../services/curriculum';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Unit colors matching Duolingo's vibrant theme palette
const UNIT_THEME_COLORS: Record<number, string> = {
  1: '#FF9F1C', // Unit 1: Orange
  2: '#2EC4B6', // Unit 2: Teal/Green
  3: '#3A86C8', // Unit 3: Blue
  4: '#7209B7', // Unit 4: Purple
  5: '#F72585', // Unit 5: Pink
};

const UNIT_THEME_ICONS: Record<number, string> = {
  1: '👋',
  2: '🔢',
  3: '👪',
  4: '🍲',
  5: '✈️',
};

type LessonState = 'completed' | 'current' | 'locked';

export default function CurriculumScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [overallProgress, setOverallProgress] = useState({ completedLessons: 0, totalLessons: 0, progressPercent: 0 });
  const [unitProgresses, setUnitProgresses] = useState<Record<number, UnitProgress>>({});
  const [lessonProgresses, setLessonProgresses] = useState<Record<string, LessonProgress>>({});
  const [totalXp, setTotalXp] = useState(0);
  
  // Interactive Popover State
  const [selectedLesson, setSelectedLesson] = useState<{ lesson: Lesson; unitId: number; state: LessonState } | null>(null);
  const [isPopoverVisible, setIsPopoverVisible] = useState(false);

  // Theme colors
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');

  // Pulse animation values for the current node
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  // Run the pulsing ring animation loop on mount
  useEffect(() => {
    const startPulseAnimation = () => {
      pulseScale.setValue(1);
      pulseOpacity.setValue(0.7);

      Animated.loop(
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1.5,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startPulseAnimation();
  }, []);

  // Fetch progress data from SQLite when screen is active
  useEffect(() => {
    if (isFocused) {
      loadProgressData();
    }
  }, [isFocused]);

  const loadProgressData = async () => {
    try {
      setLoading(true);
      const overall = await getOverallCurriculumProgress();
      setOverallProgress(overall);

      // Load XP from SQLite user profile
      const profile = await getUserProfile();
      setTotalXp(profile.xp);

      const uProgs: Record<number, UnitProgress> = {};
      const lProgs: Record<string, LessonProgress> = {};

      for (const unit of CURRICULUM) {
        const prog = await getUnitProgress(unit.id);
        uProgs[unit.id] = prog;

        for (const lesson of unit.lessons) {
          const lProg = await getLessonProgress(lesson.id);
          if (lProg) {
            lProgs[lesson.id] = lProg;
          }
        }
      }

      setUnitProgresses(uProgs);
      setLessonProgresses(lProgs);
    } catch (e) {
      console.error('Failed to load curriculum progress:', e);
    } finally {
      setLoading(false);
    }
  };

  // Helper: map lessonId to its calculated state ('completed', 'current', 'locked')
  const getLessonStates = (): Record<string, LessonState> => {
    const states: Record<string, LessonState> = {};
    let foundCurrent = false;

    // Traverse all units and lessons sequentially
    for (const unit of CURRICULUM) {
      for (const lesson of unit.lessons) {
        const isCompleted = lessonProgresses[lesson.id]?.isCompleted || false;
        
        if (isCompleted) {
          states[lesson.id] = 'completed';
        } else if (!foundCurrent) {
          // The first uncompleted lesson is "current"
          states[lesson.id] = 'current';
          foundCurrent = true;
        } else {
          // Everything after the current lesson is locked
          states[lesson.id] = 'locked';
        }
      }
    }

    // Edge case: if all lessons are completed, the first lesson stays completed
    // and there is no current. If no lessons are completed, Lesson 1 is current.
    return states;
  };

  const lessonStates = getLessonStates();

  const handleNodeTap = (lesson: Lesson, unitId: number, state: LessonState) => {
    if (state === 'locked') {
      Alert.alert(
        'Locked Topic 🔒',
        'Please complete the previous lessons on your roadmap to unlock this topic!',
        [{ text: 'Got It', style: 'default' }]
      );
      return;
    }

    // Show interactive bottom popover sheet
    setSelectedLesson({ lesson, unitId, state });
    setIsPopoverVisible(true);
  };

  const handleStartLesson = () => {
    if (!selectedLesson) return;
    setIsPopoverVisible(false);
    navigation.navigate('Lesson', { lessonId: selectedLesson.lesson.id });
  };

  // Curved horizontal offset index calculation (snake path)
  const getXOffset = (index: number) => {
    const offsets = [0, -45, 0, 45];
    return offsets[index % offsets.length];
  };

  if (loading && Object.keys(unitProgresses).length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tintCol} />
        <Text style={styles.loadingText}>Assembling learning map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.mapScrollView} 
        contentContainerStyle={styles.mapContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Overall progress status card */}
        <RNView style={[styles.overallStatusCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <RNView style={styles.statusInfoRow}>
            <RNView style={styles.titleWithXpRow}>
              <Text style={styles.statusTitle}>Learning Map Progress</Text>
              <RNView style={[styles.xpBadge, { backgroundColor: '#FBBF2415', borderColor: '#FBBF24' }]}>
                <Text style={styles.xpText}>🏆 {totalXp} XP</Text>
              </RNView>
            </RNView>
            <Text style={[styles.statusPercentage, { color: tintCol }]}>
              {overallProgress.progressPercent}%
            </Text>
          </RNView>
          <RNView style={styles.overallProgressBarBg}>
            <RNView 
              style={[
                styles.overallProgressBarFill, 
                { backgroundColor: tintCol, width: `${overallProgress.progressPercent}%` }
              ]} 
            />
          </RNView>
          <Text style={styles.statusSubtitle}>
            {overallProgress.completedLessons} / {overallProgress.totalLessons} lessons finished
          </Text>
        </RNView>

        {/* Learning roadmap pathway */}
        {CURRICULUM.map((unit) => {
          const color = UNIT_THEME_COLORS[unit.id] || tintCol;
          const icon = UNIT_THEME_ICONS[unit.id] || '🌟';
          const progress = unitProgresses[unit.id] || { progressPercent: 0, completedLessonsCount: 0, totalLessonsCount: 0 };

          return (
            <RNView key={unit.id} style={styles.unitSection}>
              {/* Unit Header Band */}
              <RNView style={[styles.unitHeaderCard, { borderColor: borderCol, backgroundColor: cardCol }]}>
                <RNView style={[styles.unitIconContainer, { backgroundColor: color }]}>
                  <Text style={styles.unitIconText}>{icon}</Text>
                </RNView>
                <RNView style={styles.unitHeaderDetails}>
                  <Text style={[styles.unitHeading, { color: color }]}>UNIT {unit.id}</Text>
                  <Text style={styles.unitTitleText}>{unit.title}</Text>
                  <Text style={styles.unitSubtitleText}>{unit.description}</Text>
                </RNView>
                <RNView style={styles.unitProgressCircle}>
                  <Text style={[styles.unitProgressPercentage, { color: color }]}>
                    {progress.progressPercent}%
                  </Text>
                  <Text style={styles.unitProgressCountText}>
                    {progress.completedLessonsCount}/{progress.totalLessonsCount}
                  </Text>
                </RNView>
              </RNView>

              {/* Pathway layout with nodes */}
              <RNView style={styles.pathwayContainer}>
                {/* Background Connecting vertical dotted line */}
                <RNView style={[styles.dottedLine, { borderColor: color + '40' }]} />

                {unit.lessons.map((lesson, idx) => {
                  const state = lessonStates[lesson.id] || 'locked';
                  const xOffset = getXOffset(idx);
                  const isCompleted = state === 'completed';
                  const isCurrent = state === 'current';
                  const isLocked = state === 'locked';

                  return (
                    <RNView 
                      key={lesson.id} 
                      style={[
                        styles.nodeRow, 
                        { transform: [{ translateX: xOffset }] }
                      ]}
                    >
                      {/* Pulse ring wrapper for active lesson */}
                      {isCurrent && (
                        <Animated.View
                          style={[
                            styles.pulseRing,
                            {
                              borderColor: color,
                              transform: [{ scale: pulseScale }],
                              opacity: pulseOpacity,
                            },
                          ]}
                        />
                      )}

                      {/* Main Node Button */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleNodeTap(lesson, unit.id, state)}
                        style={[
                          styles.nodeCircle,
                          {
                            backgroundColor: isLocked 
                              ? (Platform.OS === 'ios' ? '#E5E7EB' : '#D1D5DB')
                              : color,
                            borderColor: isCurrent ? '#FFFFFF' : 'transparent',
                            borderWidth: isCurrent ? 3 : 0,
                            shadowColor: color,
                            shadowOpacity: isCurrent ? 0.4 : 0.1,
                            shadowRadius: isCurrent ? 8 : 2,
                            elevation: isCurrent ? 6 : 2,
                          },
                        ]}
                      >
                        {isCompleted && <Text style={styles.nodeTextIcon}>✓</Text>}
                        {isCurrent && <Text style={styles.nodeTextIcon}>▶</Text>}
                        {isLocked && <Text style={[styles.nodeTextIcon, { color: '#9CA3AF', fontSize: 16 }]}>🔒</Text>}
                      </TouchableOpacity>

                      {/* Lesson title label right next to the node (only for unlocked lessons) */}
                      <RNView 
                        style={[
                          styles.nodeLabelBubble, 
                          { 
                            backgroundColor: cardCol, 
                            borderColor: borderCol,
                            left: xOffset < 0 ? 80 : undefined,
                            right: xOffset > 0 ? 80 : undefined,
                          }
                        ]}
                      >
                        <Text 
                          style={[
                            styles.nodeLabelText, 
                            isLocked && { color: '#9CA3AF' },
                            isCurrent && { fontWeight: 'bold', color: color }
                          ]}
                          numberOfLines={1}
                        >
                          {lesson.title}
                        </Text>
                      </RNView>
                    </RNView>
                  );
                })}
              </RNView>
            </RNView>
          );
        })}
      </ScrollView>

      {/* Interactive Bottom popover sheet */}
      <Modal
        visible={isPopoverVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPopoverVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsPopoverVisible(false)}
        >
          <RNView 
            style={[styles.popoverCard, { backgroundColor: cardCol, borderColor: borderCol }]}
            onStartShouldSetResponder={() => true} // prevent dismiss when clicking inside popover
          >
            {selectedLesson && (
              <RNView style={styles.popoverContent}>
                <RNView style={styles.popoverHeaderRow}>
                  <RNView 
                    style={[
                      styles.popoverBadge, 
                      { backgroundColor: (UNIT_THEME_COLORS[selectedLesson.unitId] || tintCol) + '15' }
                    ]}
                  >
                    <Text 
                      style={[
                        styles.popoverBadgeText, 
                        { color: UNIT_THEME_COLORS[selectedLesson.unitId] || tintCol }
                      ]}
                    >
                      {selectedLesson.state === 'completed' ? 'COMPLETED REVIEW' : 'NEXT LESSON'}
                    </Text>
                  </RNView>
                  <TouchableOpacity 
                    onPress={() => setIsPopoverVisible(false)}
                    style={styles.popoverCloseBtn}
                  >
                    <Text style={styles.popoverCloseText}>✕</Text>
                  </TouchableOpacity>
                </RNView>

                <Text style={styles.popoverTitle}>{selectedLesson.lesson.title}</Text>
                <Text style={styles.popoverDescription}>{selectedLesson.lesson.description}</Text>

                {/* Score stats if lesson is completed */}
                {selectedLesson.state === 'completed' && lessonProgresses[selectedLesson.lesson.id] && (
                  <RNView style={[styles.popoverStatsCard, { backgroundColor: borderCol + '40' }]}>
                    <Text style={styles.popoverStatsLabel}>Previous High Score:</Text>
                    <Text style={[styles.popoverStatsValue, { color: tintCol }]}>
                      {lessonProgresses[selectedLesson.lesson.id].score} / {selectedLesson.lesson.exercises.length} Correct
                    </Text>
                  </RNView>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleStartLesson}
                  style={[
                    styles.popoverStartBtn,
                    { backgroundColor: UNIT_THEME_COLORS[selectedLesson.unitId] || tintCol }
                  ]}
                >
                  <Text style={styles.popoverStartBtnText}>
                    {selectedLesson.state === 'completed' ? 'Review Lesson' : 'Let\'s Go!'}
                  </Text>
                </TouchableOpacity>
              </RNView>
            )}
          </RNView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
  },
  mapScrollView: {
    flex: 1,
  },
  mapContent: {
    padding: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    paddingBottom: 60,
  },
  overallStatusCard: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
    backgroundColor: 'transparent',
  },
  statusTitle: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  titleWithXpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderRadius: Theme.borderRadius.xs + 2,
    paddingHorizontal: Theme.spacing.xs,
    paddingVertical: 1,
    marginLeft: Theme.spacing.sm,
  },
  xpText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#D97706',
  },
  statusPercentage: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.heavy,
  },
  overallProgressBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: Theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: Theme.spacing.xs,
  },
  overallProgressBarFill: {
    height: '100%',
    borderRadius: Theme.borderRadius.round,
  },
  statusSubtitle: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  unitSection: {
    marginBottom: Theme.spacing.xl,
    backgroundColor: 'transparent',
  },
  unitHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  unitIconContainer: {
    width: 48,
    height: 48,
    borderRadius: Theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  unitIconText: {
    fontSize: 24,
  },
  unitHeaderDetails: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  unitHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.0,
    marginBottom: 2,
  },
  unitTitleText: {
    fontSize: Theme.typography.fontSize.sm + 1,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: 2,
  },
  unitSubtitleText: {
    fontSize: 9,
    color: '#9CA3AF',
    lineHeight: 12,
  },
  unitProgressCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: Theme.spacing.sm,
    backgroundColor: 'transparent',
  },
  unitProgressPercentage: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.heavy,
  },
  unitProgressCountText: {
    fontSize: 8,
    color: '#9CA3AF',
    marginTop: 2,
  },
  pathwayContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    minHeight: 100,
    backgroundColor: 'transparent',
  },
  dottedLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  nodeRow: {
    width: 80,
    height: 80,
    marginVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  pulseRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 999,
    borderWidth: 4,
    zIndex: 1,
  },
  nodeCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  nodeTextIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  nodeLabelBubble: {
    position: 'absolute',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs - 2,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  nodeLabelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  popoverCard: {
    borderTopLeftRadius: Theme.borderRadius.xl + 4,
    borderTopRightRadius: Theme.borderRadius.xl + 4,
    borderTopWidth: 1,
    padding: Theme.spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 44 : Theme.spacing.xl,
  },
  popoverContent: {
    backgroundColor: 'transparent',
  },
  popoverHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    backgroundColor: 'transparent',
  },
  popoverBadge: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.sm,
  },
  popoverBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  popoverCloseBtn: {
    padding: 6,
  },
  popoverCloseText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  popoverTitle: {
    fontSize: Theme.typography.fontSize.md + 2,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.xs,
  },
  popoverDescription: {
    fontSize: Theme.typography.fontSize.xs + 2,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: Theme.spacing.lg,
  },
  popoverStatsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    marginBottom: Theme.spacing.lg,
  },
  popoverStatsLabel: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: 'bold',
  },
  popoverStatsValue: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: 'heavy',
  },
  popoverStartBtn: {
    borderRadius: Theme.borderRadius.lg,
    paddingVertical: Theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  popoverStartBtnText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: 'bold',
  },
});
