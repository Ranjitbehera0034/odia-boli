import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  View as RNView,
} from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/useAuthStore';
import { getDB } from '../services/srs';
import {
  VictoryBar,
  VictoryChart,
  VictoryAxis,
  VictoryLine,
  VictoryPie,
  VictoryScatter,
} from 'victory-native';

const { width } = Dimensions.get('window');

interface XPLogEntry {
  id: number;
  amount: number;
  source: string;
  timestamp: number;
}

interface ExerciseAttempt {
  id: number;
  lesson_id: string;
  exercise_type: string;
  is_correct: number;
  timestamp: number;
}

interface VocabEntry {
  id: string;
  odia: string;
  english: string;
  category: string;
  is_learned: number;
  is_saved: number;
  saved_at: number | null;
  learned_at: number | null;
}

export default function MyProgressScreen() {
  const navigation = useNavigation();
  const session = useAuthStore((state) => state.session);
  const isGuest = useAuthStore((state) => state.isGuest);
  const userId = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [xpLog, setXpLog] = useState<XPLogEntry[]>([]);
  const [attempts, setAttempts] = useState<ExerciseAttempt[]>([]);
  const [vocab, setVocab] = useState<VocabEntry[]>([]);
  const [srsReps, setSrsReps] = useState<Record<string, number>>({});

  // Filter for exercise accuracy trend
  const [selectedExerciseType, setSelectedExerciseType] = useState<string>('all');

  // Colors
  const backgroundCol = useThemeColor({}, 'background');
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const tintCol = useThemeColor({}, 'tint');
  const textCol = useThemeColor({}, 'text');
  const textMutedCol = useThemeColor({}, 'textMuted');

  const exerciseTypeLabels: Record<string, string> = {
    all: 'All Exercises',
    multiple_choice_en_to_or: 'Multiple Choice (EN → OR)',
    multiple_choice_or_to_en: 'Multiple Choice (OR → EN)',
    listening: 'Listening',
    word_jumble: 'Word Jumble',
    text_input: 'Text Input',
    translate_sentence: 'Translate Sentence',
    listen_type: 'Listen & Type',
    match_pairs: 'Match Pairs',
  };

  const loadData = async () => {
    try {
      const db = getDB();

      // 1. Fetch XP Log
      const xpRows = await db.getAllAsync<any>('SELECT * FROM xp_log ORDER BY timestamp DESC;');
      setXpLog(xpRows || []);

      // 2. Fetch Exercise Attempts
      const attemptRows = await db.getAllAsync<any>('SELECT * FROM exercise_attempts ORDER BY timestamp DESC;');
      setAttempts(attemptRows || []);

      // 3. Fetch Vocabulary items
      const vocabRows = await db.getAllAsync<any>('SELECT * FROM vocabulary;');
      setVocab(vocabRows || []);

      // 4. Fetch SRS Cards to extract repetition state for learning definition
      const srsRows = await db.getAllAsync<any>('SELECT id, repetitions FROM srs_cards;');
      const repsMap: Record<string, number> = {};
      (srsRows || []).forEach((row: any) => {
        repsMap[row.id] = row.repetitions || 0;
      });
      setSrsReps(repsMap);
    } catch (e) {
      console.error('Failed to load progress analytics data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: backgroundCol }]}>
        <ActivityIndicator size="large" color={tintCol} />
        <Text style={[styles.loadingText, { color: textMutedCol }]}>Compiling your analytics...</Text>
      </View>
    );
  }

  // ─── 1. WEEKLY XP DATA CALCULATION (Last 8 Weeks) ───
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const xpChartData = [];

  for (let i = 7; i >= 0; i--) {
    const weekStart = now - (i + 1) * oneWeekMs;
    const weekEnd = now - i * oneWeekMs;

    const weekXpSum = xpLog
      .filter((entry) => entry.timestamp >= weekStart && entry.timestamp < weekEnd)
      .reduce((sum, entry) => sum + entry.amount, 0);

    const weekStartDate = new Date(weekStart);
    const label = `${weekStartDate.getMonth() + 1}/${weekStartDate.getDate()}`;
    xpChartData.push({ x: label, y: weekXpSum });
  }

  // ─── 2. ACCURACY TREND DATA CALCULATION (Last 8 Weeks) ───
  const accuracyChartData = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = now - (i + 1) * oneWeekMs;
    const weekEnd = now - i * oneWeekMs;

    const weekAttempts = attempts.filter((attempt) => {
      const matchType = selectedExerciseType === 'all' || attempt.exercise_type === selectedExerciseType;
      return attempt.timestamp >= weekStart && attempt.timestamp < weekEnd && matchType;
    });

    const totalCount = weekAttempts.length;
    const correctCount = weekAttempts.filter((a) => a.is_correct === 1).length;

    let rate = 80; // default initial baseline
    if (totalCount > 0) {
      rate = Math.round((correctCount / totalCount) * 100);
    } else {
      // Smooth visual curve by inheriting previous week's accuracy instead of dropping to zero
      const prevWeekVal = accuracyChartData[accuracyChartData.length - 1]?.y;
      rate = prevWeekVal !== undefined ? prevWeekVal : 80;
    }

    const weekStartDate = new Date(weekStart);
    const label = `${weekStartDate.getMonth() + 1}/${weekStartDate.getDate()}`;
    accuracyChartData.push({ x: label, y: rate });
  }

  // ─── 3. VOCABULARY MASTERY DONUT CHART ───
  let learnedCount = 0;
  let learningCount = 0;
  let newCount = 0;

  vocab.forEach((item) => {
    const reps = srsReps[item.id] || 0;
    if (item.is_learned === 1) {
      learnedCount++;
    } else if (item.is_saved === 1 || reps > 0) {
      learningCount++;
    } else {
      newCount++;
    }
  });

  const totalVocab = vocab.length || 1;
  const vocabChartData = [
    { x: 'Learned', y: learnedCount },
    { x: 'Learning', y: learningCount },
    { x: 'New', y: newCount },
  ];

  // ─── 4. CONTRIBUTION HEATMAP GRID (Last 12 Weeks / 84 Days) ───
  const heatmapCells = [];
  const heatmapStart = now - 83 * 24 * 60 * 60 * 1000;
  const alignedStart = heatmapStart - new Date(heatmapStart).getDay() * 24 * 60 * 60 * 1000;

  for (let i = 0; i < 84; i++) {
    const dayTimestamp = alignedStart + i * 24 * 60 * 60 * 1000;
    const dayDate = new Date(dayTimestamp);

    const dayStart = new Date(dayDate).setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate).setHours(23, 59, 59, 999);

    const dayXp = xpLog
      .filter((entry) => entry.timestamp >= dayStart && entry.timestamp <= dayEnd)
      .reduce((sum, entry) => sum + entry.amount, 0);

    let activeLevel = 0;
    if (dayXp > 0 && dayXp <= 30) activeLevel = 1;
    else if (dayXp > 30 && dayXp <= 60) activeLevel = 2;
    else if (dayXp > 60) activeLevel = 3;

    heatmapCells.push({
      dateStr: `${dayDate.getMonth() + 1}/${dayDate.getDate()}`,
      xp: dayXp,
      level: activeLevel,
    });
  }

  // Split cells into 12 weekly columns of 7 days
  const heatmapColumns = [];
  for (let c = 0; c < 12; c++) {
    heatmapColumns.push(heatmapCells.slice(c * 7, (c + 1) * 7));
  }

  // Heatmap level colors mapping
  const getHeatmapColor = (level: number) => {
    if (level === 0) return borderCol;
    if (level === 1) return tintCol + '35'; // light
    if (level === 2) return tintCol + '80'; // medium
    return tintCol; // dark / max
  };

  // ─── 5. BEST TIME OF DAY TO PRACTICE ───
  const practiceHours = xpLog.map((entry) => new Date(entry.timestamp).getHours());
  let morning = 0;
  let afternoon = 0;
  let evening = 0;
  let night = 0;

  practiceHours.forEach((hour) => {
    if (hour >= 6 && hour < 12) morning++;
    else if (hour >= 12 && hour < 18) afternoon++;
    else if (hour >= 18 && hour < 22) evening++;
    else night++;
  });

  let goldenHourTitle = 'Evening';
  let goldenHourRange = '6:00 PM - 10:00 PM';
  let goldenHourEmoji = '🌅';
  let maxHourCount = evening;
  let totalLogs = xpLog.length || 1;

  if (morning > maxHourCount) {
    goldenHourTitle = 'Morning';
    goldenHourRange = '6:00 AM - 12:00 PM';
    goldenHourEmoji = '☀️';
    maxHourCount = morning;
  }
  if (afternoon > maxHourCount) {
    goldenHourTitle = 'Afternoon';
    goldenHourRange = '12:00 PM - 6:00 PM';
    goldenHourEmoji = '🌤️';
    maxHourCount = afternoon;
  }
  if (night > maxHourCount) {
    goldenHourTitle = 'Night';
    goldenHourRange = '10:00 PM - 6:00 AM';
    goldenHourEmoji = '🌙';
    maxHourCount = night;
  }

  const goldenHourPercent = Math.round((maxHourCount / totalLogs) * 100);

  // ─── 6. ESTIMATE DAYS TO CONVERSATIONAL FLUENCY ───
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
  const recentLearnedCount = vocab.filter(
    (item) => item.is_learned === 1 && item.learned_at !== null && item.learned_at >= twoWeeksAgo
  ).length;

  // words learned per day in last 14 days
  const vocabPace = recentLearnedCount / 14;
  const fluencyTargetWords = 200;
  const wordsRemaining = Math.max(0, fluencyTargetWords - learnedCount);

  let daysToConversational = 120; // default estimated benchmark at casual pace
  let fluencyVelocityMsg = 'You are practicing at a casual pace. Complete one lesson daily to speed up!';

  if (vocabPace > 0) {
    daysToConversational = Math.ceil(wordsRemaining / vocabPace);
    if (vocabPace >= 2) {
      fluencyVelocityMsg = 'Incredible! You are at a hyper-active pace. Conversational fluency is right around the corner! 🔥';
    } else if (vocabPace >= 0.7) {
      fluencyVelocityMsg = 'Great steady momentum! Keeping up this daily pace will yield rapid results. 👍';
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: backgroundCol }]} contentContainerStyle={styles.scrollContent}>
      
      {/* ─── GENERAL METRICS QUICK VIEW ─── */}
      <RNView style={styles.metricsSummaryRow}>
        <RNView style={[styles.summaryCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.summaryLabel}>Total XP</Text>
          <Text style={[styles.summaryVal, { color: tintCol }]}>
            {xpLog.reduce((sum, entry) => sum + entry.amount, 0)}
          </Text>
        </RNView>
        <RNView style={[styles.summaryCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={styles.summaryLabel}>Mistakes Fixed</Text>
          <Text style={[styles.summaryVal, { color: '#10B981' }]}>
            {attempts.filter((a) => a.is_correct === 1).length} / {attempts.length || 1}
          </Text>
        </RNView>
      </RNView>

      {/* ─── WEEKLY XP BAR CHART ─── */}
      <Text style={styles.sectionHeading}>Weekly XP (Last 8 Weeks)</Text>
      <RNView style={[styles.chartCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <VictoryChart width={width - 32} height={200} domainPadding={{ x: 15 }}>
          <VictoryAxis
            style={{
              axis: { stroke: borderCol },
              tickLabels: { fill: textMutedCol, fontSize: 10, fontWeight: 'bold' },
            }}
          />
          <VictoryAxis
            dependentAxis
            style={{
              axis: { stroke: borderCol },
              tickLabels: { fill: textMutedCol, fontSize: 10, fontWeight: 'bold' },
              grid: { stroke: borderCol, strokeDasharray: '4' },
            }}
          />
          <VictoryBar
            data={xpChartData}
            cornerRadius={{ top: 4 }}
            style={{
              data: {
                fill: tintCol,
                width: 14,
              },
            }}
          />
        </VictoryChart>
      </RNView>

      {/* ─── ACCURACY TREND LINE CHART ─── */}
      <Text style={styles.sectionHeading}>Accuracy Trend Line (%)</Text>
      <RNView style={[styles.chartCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        {/* Exercise type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
          {Object.keys(exerciseTypeLabels).map((key) => {
            const isSelected = selectedExerciseType === key;
            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.8}
                onPress={() => setSelectedExerciseType(key)}
                style={[
                  styles.filterChip,
                  {
                    borderColor: isSelected ? tintCol : borderCol,
                    backgroundColor: isSelected ? tintCol + '10' : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.filterChipText, { color: isSelected ? tintCol : textMutedCol }]}>
                  {exerciseTypeLabels[key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <VictoryChart width={width - 32} height={190} domainPadding={{ x: 15 }} minDomain={{ y: 0 }} maxDomain={{ y: 100 }}>
          <VictoryAxis
            style={{
              axis: { stroke: borderCol },
              tickLabels: { fill: textMutedCol, fontSize: 10, fontWeight: 'bold' },
            }}
          />
          <VictoryAxis
            dependentAxis
            style={{
              axis: { stroke: borderCol },
              tickLabels: { fill: textMutedCol, fontSize: 10, fontWeight: 'bold' },
              grid: { stroke: borderCol, strokeDasharray: '4' },
            }}
          />
          <VictoryLine
            data={accuracyChartData}
            interpolation="monotoneX"
            style={{
              data: {
                stroke: '#10B981',
                strokeWidth: 3.5,
              },
            }}
          />
          <VictoryScatter
            data={accuracyChartData}
            size={5}
            style={{
              data: {
                fill: '#10B981',
              },
            }}
          />
        </VictoryChart>
      </RNView>

      {/* ─── VOCABULARY MASTERY DONUT CHART ─── */}
      <Text style={styles.sectionHeading}>Vocabulary Mastery</Text>
      <RNView style={[styles.donutCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={styles.donutWrapper}>
          <VictoryPie
            data={vocabChartData}
            innerRadius={58}
            width={180}
            height={180}
            colorScale={[tintCol, '#2196F3', borderCol]}
            labels={() => null} // Hide default labels to keep it clean
          />
          <RNView style={styles.donutCenterLabel}>
            <Text style={[styles.donutNumber, { color: tintCol }]}>{learnedCount}</Text>
            <Text style={[styles.donutSub, { color: textMutedCol }]}>/ {totalVocab} Learned</Text>
          </RNView>
        </RNView>

        {/* Legend */}
        <RNView style={styles.legendRow}>
          <RNView style={styles.legendItem}>
            <RNView style={[styles.legendDot, { backgroundColor: tintCol }]} />
            <Text style={styles.legendText}>Learned ({learnedCount})</Text>
          </RNView>
          <RNView style={styles.legendItem}>
            <RNView style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>Learning ({learningCount})</Text>
          </RNView>
          <RNView style={styles.legendItem}>
            <RNView style={[styles.legendDot, { backgroundColor: borderCol }]} />
            <Text style={styles.legendText}>New ({newCount})</Text>
          </RNView>
        </RNView>
      </RNView>

      {/* ─── DAILY ACTIVITY HEATMAP ─── */}
      <Text style={styles.sectionHeading}>Practice Consistency (Heatmap)</Text>
      <RNView style={[styles.heatmapCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={styles.heatmapGrid}>
          {heatmapColumns.map((col, colIdx) => (
            <RNView key={colIdx} style={styles.heatmapColumn}>
              {col.map((cell, rowIdx) => (
                <RNView
                  key={rowIdx}
                  style={[
                    styles.heatmapCell,
                    {
                      backgroundColor: getHeatmapColor(cell.level),
                    },
                  ]}
                />
              ))}
            </RNView>
          ))}
        </RNView>

        {/* Heatmap Legend */}
        <RNView style={styles.heatmapLegend}>
          <Text style={[styles.heatmapLegendText, { color: textMutedCol }]}>Less</Text>
          <RNView style={[styles.heatmapLegendCell, { backgroundColor: borderCol }]} />
          <RNView style={[styles.heatmapLegendCell, { backgroundColor: tintCol + '35' }]} />
          <RNView style={[styles.heatmapLegendCell, { backgroundColor: tintCol + '80' }]} />
          <RNView style={[styles.heatmapLegendCell, { backgroundColor: tintCol }]} />
          <Text style={[styles.heatmapLegendText, { color: textMutedCol }]}>More</Text>
        </RNView>
      </RNView>

      {/* ─── INSIGHTS (BEST TIME OF DAY & FLUENCY ESTIMATOR) ─── */}
      <Text style={styles.sectionHeading}>Personal Insights</Text>

      {/* Golden practice Hour */}
      <RNView style={[styles.insightCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={styles.insightHeader}>
          <Text style={styles.insightEmoji}>{goldenHourEmoji}</Text>
          <RNView style={styles.insightTitleBlock}>
            <Text style={styles.insightTitle}>Practice Golden Hour</Text>
            <Text style={[styles.insightSubtitle, { color: textMutedCol }]}>{goldenHourRange}</Text>
          </RNView>
        </RNView>
        <Text style={[styles.insightDesc, { color: textCol }]}>
          Your best time to practice is the <Text style={{ fontWeight: '800', color: tintCol }}>{goldenHourTitle}</Text>! You complete{' '}
          <Text style={{ fontWeight: '800' }}>{goldenHourPercent}%</Text> of your study reviews during this period.
        </Text>
      </RNView>

      {/* Conversational Fluency Estimation */}
      <RNView style={[styles.insightCard, { backgroundColor: cardCol, borderColor: borderCol }]}>
        <RNView style={styles.insightHeader}>
          <Text style={styles.insightEmoji}>💬</Text>
          <RNView style={styles.insightTitleBlock}>
            <Text style={styles.insightTitle}>Days to Conversational Fluency</Text>
            <Text style={[styles.insightSubtitle, { color: textMutedCol }]}>
              At current pace ({learnedCount} learned)
            </Text>
          </RNView>
        </RNView>
        <RNView style={styles.fluencyCountBlock}>
          <Text style={[styles.fluencyNumber, { color: '#10B981' }]}>
            {daysToConversational === 0 ? 'Reached' : `~${daysToConversational}`}
          </Text>
          <Text style={[styles.fluencyLabel, { color: textMutedCol }]}>estimated days</Text>
        </RNView>
        <Text style={[styles.insightDesc, { color: textCol }]}>{fluencyVelocityMsg}</Text>
      </RNView>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  metricsSummaryRow: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    gap: 12,
    marginBottom: Theme.spacing.lg,
  },
  summaryCard: {
    flex: 1,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    padding: Theme.spacing.md,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  chartCard: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  filterScrollView: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: Theme.spacing.sm,
    marginVertical: Theme.spacing.xs,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  donutCard: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  donutWrapper: {
    position: 'relative',
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  donutCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  donutNumber: {
    fontSize: 26,
    fontWeight: '800',
  },
  donutSub: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    gap: 16,
    marginTop: Theme.spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
  },
  heatmapCard: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  heatmapGrid: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    gap: 4,
  },
  heatmapColumn: {
    backgroundColor: 'transparent',
    gap: 4,
  },
  heatmapCell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Theme.spacing.md,
    gap: 4,
    backgroundColor: 'transparent',
  },
  heatmapLegendText: {
    fontSize: 9,
    fontWeight: '700',
    marginHorizontal: 4,
  },
  heatmapLegendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  insightCard: {
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: Theme.spacing.sm,
    gap: 10,
  },
  insightEmoji: {
    fontSize: 24,
  },
  insightTitleBlock: {
    backgroundColor: 'transparent',
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  insightSubtitle: {
    fontSize: 10,
    fontWeight: '700',
  },
  insightDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  fluencyCountBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'transparent',
    marginBottom: 6,
    gap: 6,
  },
  fluencyNumber: {
    fontSize: 26,
    fontWeight: '800',
  },
  fluencyLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
