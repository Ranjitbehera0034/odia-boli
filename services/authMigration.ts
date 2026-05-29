import { supabase } from './supabase';
import { getDB } from './srs';

/**
 * Migrates local SQLite guest user progress, streaks, stats, curriculum progress,
 * and vocabulary preferences to the cloud (Supabase) tables under the given auth userId.
 */
export async function migrateLocalProgressToCloud(userId: string): Promise<void> {
  const db = getDB();

  try {
    console.log('[AuthMigration] Starting progress migration for user ID:', userId);

    // 1. Sync User stats (XP, level, hearts, quiz records, and profile details)
    const localUser = await db.getFirstAsync<any>('SELECT * FROM users WHERE id = 1;');
    if (localUser) {
      console.log('[AuthMigration] Migrating profile stats and details...');
      
      const updatePayload: any = {
        xp: localUser.xp,
        level: localUser.level,
        hearts: localUser.hearts,
        last_refill_time: localUser.last_refill_time,
        quizzes_taken: localUser.quizzes_taken,
        quiz_high_score: localUser.quiz_high_score,
        onboarding_completed: localUser.onboarding_completed === 1,
      };

      if (localUser.username) updatePayload.username = localUser.username;
      if (localUser.avatar_url) updatePayload.avatar_url = localUser.avatar_url;
      if (localUser.bio) updatePayload.bio = localUser.bio;
      if (localUser.location) updatePayload.location = localUser.location;
      if (localUser.native_language) updatePayload.native_language = localUser.native_language;
      if (localUser.learning_goal) updatePayload.learning_goal = localUser.learning_goal;
      if (localUser.longest_streak) updatePayload.longest_streak = localUser.longest_streak;
      if (localUser.is_public !== undefined && localUser.is_public !== null) {
        updatePayload.is_public = localUser.is_public === 1;
      }
      if (localUser.badges) {
        try {
          updatePayload.badges = JSON.parse(localUser.badges);
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Update public.profiles table (created automatically by trigger, now filled with guest stats)
      const { error: profileError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId);

      if (profileError) {
        console.error('[AuthMigration] Failed to migrate profiles stats/details:', profileError);
      }

      // Update public.streaks table
      const { error: streakError } = await supabase
        .from('streaks')
        .update({
          current_streak: localUser.streak,
          streak_freeze_count: localUser.streak_freeze_count,
          was_streak_broken: localUser.was_streak_broken === 1,
          last_active_date: localUser.last_active_date,
          activity_dates: JSON.parse(localUser.activity_dates || '[]'),
          freeze_used_dates: JSON.parse(localUser.freeze_used_dates || '[]'),
        })
        .eq('user_id', userId);

      if (streakError) {
        console.error('[AuthMigration] Failed to migrate streaks stats:', streakError);
      }
    }

    // 2. Sync Curriculum progress
    const progressRows = await db.getAllAsync<any>('SELECT * FROM progress;');
    if (progressRows.length > 0) {
      console.log(`[AuthMigration] Migrating ${progressRows.length} lesson progress rows...`);
      const records = progressRows.map((row) => ({
        user_id: userId,
        lesson_id: row.lesson_id,
        unit_id: row.unit_id,
        is_completed: row.is_completed === 1,
        score: row.score,
        completed_at: row.completed_at,
      }));

      const { error: progressError } = await supabase
        .from('progress')
        .upsert(records, { onConflict: 'user_id,lesson_id' });

      if (progressError) {
        console.error('[AuthMigration] Failed to migrate curriculum progress:', progressError);
      }
    }

    // 3. Sync Vocabulary mastery
    const vocabRows = await db.getAllAsync<any>('SELECT * FROM vocabulary WHERE is_learned = 1 OR is_saved = 1;');
    if (vocabRows.length > 0) {
      console.log(`[AuthMigration] Migrating ${vocabRows.length} vocabulary mastery rows...`);
      const records = vocabRows.map((row) => ({
        user_id: userId,
        vocab_id: row.id,
        is_learned: row.is_learned === 1,
        is_saved: row.is_saved === 1,
        learned_at: row.learned_at,
        saved_at: row.saved_at,
      }));

      const { error: vocabError } = await supabase
        .from('vocabulary_mastery')
        .upsert(records, { onConflict: 'user_id,vocab_id' });

      if (vocabError) {
        console.error('[AuthMigration] Failed to migrate vocabulary mastery:', vocabError);
      }
    }

    // 4. Sync XP Log History
    const xpRows = await db.getAllAsync<any>('SELECT * FROM xp_log;');
    if (xpRows.length > 0) {
      console.log(`[AuthMigration] Migrating ${xpRows.length} XP log entries...`);
      const records = xpRows.map((row) => ({
        user_id: userId,
        amount: row.amount,
        source: row.source,
        timestamp: row.timestamp,
      }));

      const { error: xpError } = await supabase
        .from('xp_history')
        .insert(records);

      if (xpError) {
        console.error('[AuthMigration] Failed to migrate XP history:', xpError);
      }
    }

    console.log('[AuthMigration] Local guest data successfully migrated to Supabase Cloud.');
  } catch (e) {
    console.error('[AuthMigration] Unexpected error during guest migration:', e);
  }
}
