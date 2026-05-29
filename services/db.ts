import { getDB } from './srs';
import { CURRICULUM } from './curriculumData';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function initAppDatabase(): Promise<void> {
  const db = getDB();

  // 1. users table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      hearts INTEGER NOT NULL DEFAULT 5,
      last_refill_time INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      streak_freeze_count INTEGER NOT NULL DEFAULT 0,
      was_streak_broken INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT,
      activity_dates TEXT NOT NULL DEFAULT '[]',
      freeze_used_dates TEXT NOT NULL DEFAULT '[]',
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      quizzes_taken INTEGER NOT NULL DEFAULT 0,
      quiz_high_score INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      username TEXT,
      email TEXT,
      avatar_url TEXT,
      bio TEXT,
      location TEXT,
      native_language TEXT,
      learning_goal TEXT,
      longest_streak INTEGER DEFAULT 0,
      is_public INTEGER DEFAULT 1,
      badges TEXT DEFAULT '[]',
      interests TEXT,
      created_at INTEGER,
      gems INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Seed default user if not exists
  await db.runAsync(`
    INSERT OR IGNORE INTO users (id, xp, level, hearts, last_refill_time, streak, streak_freeze_count, was_streak_broken, last_active_date, activity_dates, freeze_used_dates, onboarding_completed, quizzes_taken, quiz_high_score, gems)
    VALUES (1, 0, 1, 5, 0, 0, 0, 0, NULL, '[]', '[]', 0, 0, 0, 0);
  `);

  // 2. lessons table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      unit_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      total_exercises INTEGER NOT NULL
    );
  `);

  // Seed lessons if empty
  const lessonsCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM lessons;');
  if (lessonsCountRow && lessonsCountRow.count === 0) {
    for (const unit of CURRICULUM) {
      for (const lesson of unit.lessons) {
        await db.runAsync(
          'INSERT INTO lessons (id, unit_id, title, description, total_exercises) VALUES (?, ?, ?, ?, ?);',
          [lesson.id, unit.id, lesson.title, lesson.description, lesson.exercises.length]
        );
      }
    }
  }

  // 3. progress table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS progress (
      lesson_id TEXT PRIMARY KEY,
      unit_id INTEGER NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migrate existing data from lesson_progress if it exists
  try {
    const tableCheck = await db.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='lesson_progress';"
    );
    if (tableCheck) {
      // Copy entries over
      await db.execAsync(`
        INSERT OR IGNORE INTO progress (lesson_id, unit_id, is_completed, score, completed_at)
        SELECT lesson_id, unit_id, is_completed, score, completed_at FROM lesson_progress;
      `);
      // Drop legacy table
      await db.execAsync('DROP TABLE IF EXISTS lesson_progress;');
      console.log('Migrated lesson_progress to progress.');
    }
  } catch (e) {
    // Fail silently if table doesn't exist
  }

  // 4. vocabulary table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS vocabulary (
      id TEXT PRIMARY KEY,
      odia TEXT NOT NULL,
      english TEXT NOT NULL,
      category TEXT NOT NULL,
      is_learned INTEGER NOT NULL DEFAULT 0,
      is_saved INTEGER NOT NULL DEFAULT 0,
      saved_at INTEGER,
      learned_at INTEGER,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Seed vocabulary if empty
  const vocabCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM vocabulary;');
  if (vocabCountRow && vocabCountRow.count === 0) {
    const { PRACTICAL_PHRASES } = require('./phrases');
    for (const phrase of PRACTICAL_PHRASES) {
      await db.runAsync(
        'INSERT INTO vocabulary (id, odia, english, category, is_learned, is_saved, saved_at, learned_at) VALUES (?, ?, ?, ?, 0, 0, NULL, NULL);',
        [phrase.id, phrase.odia, phrase.english, phrase.category]
      );
    }
  }

  // 5. srs_cards table (replace srs_items)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS srs_cards (
      id TEXT PRIMARY KEY,
      odia TEXT NOT NULL,
      english TEXT NOT NULL,
      category TEXT NOT NULL,
      repetitions INTEGER NOT NULL DEFAULT 0,
      interval INTEGER NOT NULL DEFAULT 0,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      next_review INTEGER NOT NULL
    );
  `);

  // Migrate existing data from srs_items to srs_cards if srs_items exists
  try {
    const srsItemsCheck = await db.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='srs_items';"
    );
    if (srsItemsCheck) {
      await db.execAsync(`
        INSERT OR IGNORE INTO srs_cards (id, odia, english, category, repetitions, interval, ease_factor, next_review)
        SELECT id, odia, english, category, repetitions, interval, ease_factor, next_review FROM srs_items;
      `);
      await db.execAsync('DROP TABLE IF EXISTS srs_items;');
      console.log('Migrated srs_items to srs_cards.');
    }
  } catch (e) {
    // Fail silently if table doesn't exist
  }

  // 6. xp_log table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS xp_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount INTEGER NOT NULL,
      source TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);

  // 7. saved_translations table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS saved_translations (
      id TEXT PRIMARY KEY,
      odia TEXT NOT NULL,
      english TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);

  // 8. translation_history table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS translation_history (
      id TEXT PRIMARY KEY,
      odia TEXT NOT NULL,
      english TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);

  // 9. translation_cache table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS translation_cache (
      odia TEXT PRIMARY KEY,
      english TEXT NOT NULL,
      result_json TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);

  // 10. mistake_log table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS mistake_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id TEXT NOT NULL,
      question TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      user_answer TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);

  // 11. pronunciation_scores table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pronunciation_scores (
      word TEXT PRIMARY KEY,
      score INTEGER NOT NULL,
      feedback TEXT,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 12. generated_sentences table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS generated_sentences (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      focus TEXT,
      odia TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // 13. grammar_explanations table — tracks which explanations were viewed (feeds L3-6 personalization)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS grammar_explanations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id TEXT NOT NULL,
      question TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      user_answer TEXT NOT NULL,
      explanation TEXT NOT NULL,
      odia_example TEXT NOT NULL,
      tip TEXT NOT NULL,
      viewed_at INTEGER NOT NULL
    );
  `);



  // Run dynamic schema migrations to add updated_at columns if upgrading from a previous version
  try {
    await db.execAsync('ALTER TABLE users ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;');
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.execAsync('ALTER TABLE progress ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;');
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.execAsync('ALTER TABLE vocabulary ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;');
  } catch (e) {
    // Column already exists, ignore
  }

  // Profile fields migrations
  const newCols = [
    { name: 'username', type: 'TEXT' },
    { name: 'email', type: 'TEXT' },
    { name: 'avatar_url', type: 'TEXT' },
    { name: 'bio', type: 'TEXT' },
    { name: 'location', type: 'TEXT' },
    { name: 'native_language', type: 'TEXT' },
    { name: 'learning_goal', type: 'TEXT' },
    { name: 'longest_streak', type: 'INTEGER DEFAULT 0' },
    { name: 'is_public', type: 'INTEGER DEFAULT 1' },
    { name: 'badges', type: "TEXT DEFAULT '[]'" },
    { name: 'interests', type: 'TEXT' },
    { name: 'created_at', type: 'INTEGER' },
    { name: 'gems', type: 'INTEGER NOT NULL DEFAULT 0' }
  ];

  for (const col of newCols) {
    try {
      await db.execAsync(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type};`);
    } catch (e) {
      // Column already exists, ignore
    }
  }

  // 9.1. Create exercise_attempts table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS exercise_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);

  // 9.3. Create daily_challenges table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_challenges (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      target_count INTEGER NOT NULL,
      current_progress INTEGER NOT NULL DEFAULT 0,
      is_completed INTEGER NOT NULL DEFAULT 0,
      reward_xp INTEGER NOT NULL,
      reward_gems INTEGER NOT NULL,
      date TEXT NOT NULL
    );
  `);

  // 9.4. Create daily_chest_claimed table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_chest_claimed (
      date TEXT PRIMARY KEY,
      is_claimed INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 9.2. Seed mock exercise attempts and XP logs if initially empty
  try {
    const attemptsCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercise_attempts;');
    if (attemptsCountRow && attemptsCountRow.count === 0) {
      console.log('[SQLite Seed] Seeding mock analytics data for charts...');
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const exerciseTypes = [
        'multiple_choice_en_to_or',
        'multiple_choice_or_to_en',
        'listening',
        'word_jumble',
        'text_input',
        'translate_sentence',
        'listen_type',
        'match_pairs'
      ];

      // Seed data spread across the last 8 weeks (56 days)
      for (let dayOffset = 56; dayOffset >= 0; dayOffset--) {
        const dayTimestamp = now - dayOffset * oneDay;
        const dayOfWeek = new Date(dayTimestamp).getDay();
        
        // Sunday, Monday, Wednesday, Friday are set as active study days
        const practiceProb = [0, 1, 3, 5].includes(dayOfWeek) ? 0.8 : 0.35;
        if (Math.random() < practiceProb) {
          // Choose standard practice times (usually evening 7-9 PM or morning 8-10 AM)
          const hour = Math.random() < 0.7 ? 19 + Math.floor(Math.random() * 2) : 8 + Math.floor(Math.random() * 2);
          const practiceTime = new Date(dayTimestamp);
          practiceTime.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
          const practiceTimestamp = practiceTime.getTime();

          // 1. Insert XP log entry
          const xpAmount = Math.random() < 0.3 ? 50 : 30; // 30 XP or 50 XP
          await db.runAsync(
            'INSERT INTO xp_log (amount, source, timestamp) VALUES (?, ?, ?);',
            [xpAmount, 'Lesson completion', practiceTimestamp]
          );

          // 2. Insert mock exercise attempts (8-11 exercises per lesson session)
          const totalExercises = 8 + Math.floor(Math.random() * 4);
          for (let i = 0; i < totalExercises; i++) {
            const type = exerciseTypes[Math.floor(Math.random() * exerciseTypes.length)];
            
            // Higher accuracy on multiple choice, lower on translation / text entry
            let accuracy = 0.82;
            if (['translate_sentence', 'text_input', 'listen_type'].includes(type)) {
              accuracy = 0.65;
            } else if (['listening', 'multiple_choice_or_to_en'].includes(type)) {
              accuracy = 0.90;
            }
            
            const isCorrect = Math.random() < accuracy ? 1 : 0;
            await db.runAsync(
              'INSERT INTO exercise_attempts (lesson_id, exercise_type, is_correct, timestamp) VALUES (?, ?, ?, ?);',
              ['mock_lesson', type, isCorrect, practiceTimestamp]
            );
          }
        }
      }

      // 3. Mark some vocabulary words as learned historically
      const learnedCountRow = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM vocabulary WHERE is_learned = 1;"
      );
      if (learnedCountRow && learnedCountRow.count === 0) {
        const vocabItems = await db.getAllAsync<any>('SELECT id FROM vocabulary LIMIT 25;');
        for (const item of vocabItems) {
          const dayOffset = Math.floor(Math.random() * 30);
          const learnedAt = now - dayOffset * oneDay;
          await db.runAsync(
            'UPDATE vocabulary SET is_learned = 1, learned_at = ? WHERE id = ?;',
            [learnedAt, item.id]
          );
        }
      }
      console.log('[SQLite Seed] Seeding completed.');
    }
  } catch (seedErr) {
    console.error('[SQLite Seed] Failed to seed mock analytics:', seedErr);
  }

  // 10. Run AsyncStorage to SQLite migration if needed
  await runAsyncStorageMigration();
}

async function runAsyncStorageMigration(): Promise<void> {
  const db = getDB();

  try {
    const onboardingCompleted = await AsyncStorage.getItem('@odia_agent:onboarding_completed');
    const lastActiveDate = await AsyncStorage.getItem('@odia_agent:last_active_date');
    const streakCount = await AsyncStorage.getItem('@odia_agent:streak_count');
    const streakFreeze = await AsyncStorage.getItem('@odia_agent:streak_freeze');
    const activityDates = await AsyncStorage.getItem('@odia_agent:activity_dates');
    const freezeUsedDates = await AsyncStorage.getItem('@odia_agent:streak_freeze_used_dates');
    const savedTranslations = await AsyncStorage.getItem('@odia_agent:saved_translations');
    const translationHistory = await AsyncStorage.getItem('@odia_agent:translation_history');
    const quizStats = await AsyncStorage.getItem('@odia_agent:quiz_stats');
    
    // Check if we need to migrate user details
    if (onboardingCompleted || lastActiveDate || streakCount || streakFreeze || quizStats || activityDates || freezeUsedDates) {
      console.log('Migrating AsyncStorage profile data to SQLite...');
      
      const onboardingVal = onboardingCompleted === 'true' ? 1 : 0;
      const streakVal = streakCount ? parseInt(streakCount, 10) : 0;
      const freezeVal = streakFreeze ? parseInt(streakFreeze, 10) : 0;
      const activityDatesVal = activityDates ? activityDates : '[]';
      const freezeUsedDatesVal = freezeUsedDates ? freezeUsedDates : '[]';
      let quizzesTakenVal = 0;
      let quizHighScoreVal = 0;

      if (quizStats) {
        try {
          const parsed = JSON.parse(quizStats);
          quizzesTakenVal = parsed.totalQuizzes || 0;
          quizHighScoreVal = parsed.highScore || 0;
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Update users table with values from AsyncStorage
      await db.runAsync(`
        UPDATE users SET
          streak = MAX(streak, ?),
          streak_freeze_count = MAX(streak_freeze_count, ?),
          last_active_date = COALESCE(last_active_date, ?),
          activity_dates = ?,
          freeze_used_dates = ?,
          onboarding_completed = MAX(onboarding_completed, ?),
          quizzes_taken = MAX(quizzes_taken, ?),
          quiz_high_score = MAX(quiz_high_score, ?)
        WHERE id = 1;
      `, [streakVal, freezeVal, lastActiveDate, activityDatesVal, freezeUsedDatesVal, onboardingVal, quizzesTakenVal, quizHighScoreVal]);

      // Remove migrated keys
      const keysToRemove = [
        '@odia_agent:onboarding_completed',
        '@odia_agent:last_active_date',
        '@odia_agent:streak_count',
        '@odia_agent:streak_freeze',
        '@odia_agent:streak_freeze_used_dates',
        '@odia_agent:activity_dates',
        '@odia_agent:quiz_stats'
      ];
      await AsyncStorage.multiRemove(keysToRemove);
      console.log('AsyncStorage profile migration completed.');
    }

    // Migrate saved translations
    if (savedTranslations) {
      console.log('Migrating AsyncStorage saved translations...');
      try {
        const parsed = JSON.parse(savedTranslations) as any[];
        for (const item of parsed) {
          await db.runAsync(
            'INSERT OR IGNORE INTO saved_translations (id, odia, english, timestamp) VALUES (?, ?, ?, ?);',
            [item.id || Math.random().toString(36).substring(2, 9), item.odia, item.english, item.timestamp || Date.now()]
          );
        }
        await AsyncStorage.removeItem('@odia_agent:saved_translations');
      } catch (e) {
        console.error('Error parsing saved translations for migration:', e);
      }
    }

    // Migrate translation history
    if (translationHistory) {
      console.log('Migrating AsyncStorage translation history...');
      try {
        const parsed = JSON.parse(translationHistory) as any[];
        for (const item of parsed) {
          await db.runAsync(
            'INSERT OR IGNORE INTO translation_history (id, odia, english, timestamp) VALUES (?, ?, ?, ?);',
            [item.id || Math.random().toString(36).substring(2, 9), item.odia, item.english, item.timestamp || Date.now()]
          );
        }
        await AsyncStorage.removeItem('@odia_agent:translation_history');
      } catch (e) {
        console.error('Error parsing translation history for migration:', e);
      }
    }
  } catch (err) {
    console.error('Error migrating from AsyncStorage to SQLite:', err);
  }
}
