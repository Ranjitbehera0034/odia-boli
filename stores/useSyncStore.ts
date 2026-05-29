import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getDB } from '../services/srs';
import { supabase } from '../services/supabase';
import { useUserStore } from './useUserStore';
import { useProgressStore } from './useProgressStore';

export interface SyncState {
  syncState: 'idle' | 'syncing' | 'offline' | 'error';
  lastSyncedAt: number;
  isOnline: boolean;
  sync: () => Promise<void>;
  initialize: () => void;
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

export const useSyncStore = create<SyncState>((set, get) => ({
  syncState: 'idle',
  lastSyncedAt: 0,
  isOnline: false,

  sync: async () => {
    const { syncState, isOnline } = get();
    // Guard against concurrent syncs
    if (syncState === 'syncing') return;

    // Check active session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Not logged in, bypass sync silently
      set({ syncState: 'idle' });
      return;
    }

    if (!isOnline) {
      set({ syncState: 'offline' });
      return;
    }

    set({ syncState: 'syncing' });
    const userId = session.user.id;
    const db = getDB();

    try {
      const lastSyncedAtKey = `@odia_agent:last_synced_at:${userId}`;
      const lastSyncedAtStr = await AsyncStorage.getItem(lastSyncedAtKey);
      const lastSyncedAt = lastSyncedAtStr ? parseInt(lastSyncedAtStr, 10) : 0;

      const syncStartTime = Date.now();
      const sinceISO = new Date(lastSyncedAt).toISOString();

      // ----------------------------------------------------
      // 1. PULL PHASE: Fetch remote changes since lastSyncedAt
      // ----------------------------------------------------
      // A. Profiles
      const { data: remoteProfiles, error: pullProfileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .gt('updated_at', sinceISO);

      if (pullProfileErr) throw pullProfileErr;

      // B. Streaks
      const { data: remoteStreaks, error: pullStreakErr } = await supabase
        .from('streaks')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', sinceISO);

      if (pullStreakErr) throw pullStreakErr;

      // C. Leagues
      const { data: remoteLeagues, error: pullLeagueErr } = await supabase
        .from('leagues')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', sinceISO);

      if (pullLeagueErr) throw pullLeagueErr;

      // D. Progress
      const { data: remoteProgress, error: pullProgressErr } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', sinceISO);

      if (pullProgressErr) throw pullProgressErr;

      // E. Vocabulary Mastery
      const { data: remoteVocab, error: pullVocabErr } = await supabase
        .from('vocabulary_mastery')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', sinceISO);

      if (pullVocabErr) throw pullVocabErr;

      // F. Pronunciation Scores
      const { data: remotePronunciation, error: pullPronunciationErr } = await supabase
        .from('pronunciation_scores')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', sinceISO);

      if (pullPronunciationErr) throw pullPronunciationErr;

      // ----------------------------------------------------
      // 2. FETCH LOCAL CHANGES PHASE
      // ----------------------------------------------------
      const localUser = await db.getFirstAsync<any>(
        'SELECT * FROM users WHERE id = 1;'
      );

      const localProgress = await db.getAllAsync<any>(
        'SELECT * FROM progress WHERE updated_at > ?;',
        [lastSyncedAt]
      );

      const localVocab = await db.getAllAsync<any>(
        'SELECT * FROM vocabulary WHERE updated_at > ?;',
        [lastSyncedAt]
      );

      const localPronunciation = await db.getAllAsync<any>(
        'SELECT * FROM pronunciation_scores WHERE updated_at > ?;',
        [lastSyncedAt]
      );

      const localXpLog = await db.getAllAsync<any>(
        'SELECT * FROM xp_log WHERE timestamp > ?;',
        [lastSyncedAt]
      );

      const localUserLeague = await db.getFirstAsync<any>(
        'SELECT * FROM league_entries WHERE is_user = 1 LIMIT 1;'
      );

      // ----------------------------------------------------
      // 3. CONFLICT RESOLUTION & MERGE
      // ----------------------------------------------------
      let resolvedLocalProfile = null;
      let resolvedLocalStreak = null;
      let resolvedLocalLeague = null;

      // A. Profile Sync
      const remoteProfile = remoteProfiles && remoteProfiles.length > 0 ? remoteProfiles[0] : null;
      if (remoteProfile) {
        const remoteTime = new Date(remoteProfile.updated_at).getTime();
        const localTime = localUser?.updated_at || 0;

        if (localTime >= remoteTime) {
          resolvedLocalProfile = localUser;
        } else {
          await db.runAsync(
            `UPDATE users SET
              xp = ?,
              level = ?,
              hearts = ?,
              last_refill_time = ?,
              quizzes_taken = ?,
              quiz_high_score = ?,
              onboarding_completed = ?,
              username = ?,
              email = ?,
              avatar_url = ?,
              bio = ?,
              location = ?,
              native_language = ?,
              learning_goal = ?,
              longest_streak = ?,
              is_public = ?,
              badges = ?,
              interests = ?,
              created_at = ?,
              updated_at = ?
            WHERE id = 1;`,
            [
              remoteProfile.xp,
              remoteProfile.level,
              remoteProfile.hearts,
              Number(remoteProfile.last_refill_time),
              remoteProfile.quizzes_taken,
              remoteProfile.quiz_high_score,
              remoteProfile.onboarding_completed ? 1 : 0,
              remoteProfile.username || '',
              remoteProfile.email || '',
              remoteProfile.avatar_url || null,
              remoteProfile.bio || '',
              remoteProfile.location || '',
              remoteProfile.native_language || 'English',
              remoteProfile.learning_goal || 'casual',
              remoteProfile.longest_streak || 0,
              remoteProfile.is_public ? 1 : 0,
              JSON.stringify(remoteProfile.badges || []),
              remoteProfile.interests || '',
              remoteProfile.created_at ? new Date(remoteProfile.created_at).getTime() : Date.now(),
              remoteTime
            ]
          );
        }
      } else if (localUser && localUser.updated_at > lastSyncedAt) {
        resolvedLocalProfile = localUser;
      }

      // B. Streak Sync
      const remoteStreak = remoteStreaks && remoteStreaks.length > 0 ? remoteStreaks[0] : null;
      if (remoteStreak) {
        const remoteTime = new Date(remoteStreak.updated_at).getTime();
        const localTime = localUser?.updated_at || 0;

        if (localTime >= remoteTime) {
          resolvedLocalStreak = localUser;
        } else {
          await db.runAsync(
            `UPDATE users SET
              streak = ?,
              streak_freeze_count = ?,
              was_streak_broken = ?,
              last_active_date = ?,
              activity_dates = ?,
              freeze_used_dates = ?,
              updated_at = ?
            WHERE id = 1;`,
            [
              remoteStreak.current_streak,
              remoteStreak.streak_freeze_count,
              remoteStreak.was_streak_broken ? 1 : 0,
              remoteStreak.last_active_date,
              JSON.stringify(remoteStreak.activity_dates || []),
              JSON.stringify(remoteStreak.freeze_used_dates || []),
              remoteTime
            ]
          );
        }
      } else if (localUser && localUser.updated_at > lastSyncedAt) {
        resolvedLocalStreak = localUser;
      }

      // C. League Sync
      const remoteLeague = remoteLeagues && remoteLeagues.length > 0 ? remoteLeagues[0] : null;
      if (remoteLeague) {
        const remoteTime = new Date(remoteLeague.updated_at).getTime();
        const localTime = localUser?.updated_at || 0;

        if (localTime >= remoteTime) {
          resolvedLocalLeague = localUserLeague;
        } else {
          await db.runAsync(
            `UPDATE league_entries SET
              weekly_xp = ?,
              tier = ?
            WHERE is_user = 1;`,
            [
              remoteLeague.weekly_xp,
              remoteLeague.league_tier
            ]
          );
        }
      } else if (localUserLeague && localUser?.updated_at > lastSyncedAt) {
        resolvedLocalLeague = localUserLeague;
      }

      // D. Progress Sync
      const progressToPush = [];
      if (remoteProgress) {
        for (const rem of remoteProgress) {
          const remoteTime = new Date(rem.updated_at).getTime();
          const loc = await db.getFirstAsync<any>(
            'SELECT * FROM progress WHERE lesson_id = ?;',
            [rem.lesson_id]
          );

          if (!loc) {
            await db.runAsync(
              `INSERT OR REPLACE INTO progress (lesson_id, unit_id, is_completed, score, completed_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?);`,
              [rem.lesson_id, rem.unit_id, rem.is_completed ? 1 : 0, rem.score, rem.completed_at, remoteTime]
            );
          } else {
            const localTime = loc.updated_at || 0;
            if (localTime >= remoteTime) {
              progressToPush.push(loc);
            } else {
              await db.runAsync(
                `UPDATE progress SET
                  is_completed = ?,
                  score = ?,
                  completed_at = ?,
                  updated_at = ?
                WHERE lesson_id = ?;`,
                [rem.is_completed ? 1 : 0, rem.score, rem.completed_at, remoteTime, rem.lesson_id]
              );
            }
          }
        }
      }

      for (const loc of localProgress) {
        const matchingRemote = remoteProgress?.find(r => r.lesson_id === loc.lesson_id);
        if (!matchingRemote) {
          progressToPush.push(loc);
        }
      }

      // E. Vocabulary Sync
      const vocabToPush = [];
      if (remoteVocab) {
        for (const rem of remoteVocab) {
          const remoteTime = new Date(rem.updated_at).getTime();
          const loc = await db.getFirstAsync<any>(
            'SELECT * FROM vocabulary WHERE id = ?;',
            [rem.vocab_id]
          );

          if (!loc) {
            await db.runAsync(
              `INSERT OR REPLACE INTO vocabulary (id, odia, english, category, is_learned, is_saved, saved_at, learned_at, updated_at)
               VALUES (?, 'Unknown', 'Unknown', 'General', ?, ?, ?, ?, ?);`,
              [rem.vocab_id, rem.is_learned ? 1 : 0, rem.is_saved ? 1 : 0, rem.saved_at, rem.learned_at, remoteTime]
            );
          } else {
            const localTime = loc.updated_at || 0;
            if (localTime >= remoteTime) {
              vocabToPush.push(loc);
            } else {
              await db.runAsync(
                `UPDATE vocabulary SET
                  is_learned = ?,
                  is_saved = ?,
                  saved_at = ?,
                  learned_at = ?,
                  updated_at = ?
                WHERE id = ?;`,
                [rem.is_learned ? 1 : 0, rem.is_saved ? 1 : 0, rem.saved_at, rem.learned_at, remoteTime, rem.vocab_id]
              );
            }
          }
        }
      }

      for (const loc of localVocab) {
        const matchingRemote = remoteVocab?.find(r => r.vocab_id === loc.id);
        if (!matchingRemote) {
          vocabToPush.push(loc);
        }
      }

      // F. Pronunciation Scores Sync
      const pronunciationToPush = [];
      if (remotePronunciation) {
        for (const rem of remotePronunciation) {
          const remoteTime = new Date(rem.updated_at).getTime();
          const loc = await db.getFirstAsync<any>(
            'SELECT * FROM pronunciation_scores WHERE word = ?;',
            [rem.word]
          );

          if (!loc) {
            await db.runAsync(
              `INSERT OR REPLACE INTO pronunciation_scores (word, score, feedback, updated_at)
               VALUES (?, ?, ?, ?);`,
              [rem.word, rem.score, rem.feedback, remoteTime]
            );
          } else {
            const localTime = loc.updated_at || 0;
            if (localTime >= remoteTime) {
              pronunciationToPush.push(loc);
            } else {
              await db.runAsync(
                `UPDATE pronunciation_scores SET
                  score = ?,
                  feedback = ?,
                  updated_at = ?
                WHERE word = ?;`,
                [rem.score, rem.feedback, remoteTime, rem.word]
              );
            }
          }
        }
      }

      for (const loc of localPronunciation) {
        const matchingRemote = remotePronunciation?.find(r => r.word === loc.word);
        if (!matchingRemote) {
          pronunciationToPush.push(loc);
        }
      }

      // ----------------------------------------------------
      // 4. PUSH PHASES: Upload local changes to cloud
      // ----------------------------------------------------
      if (resolvedLocalProfile) {
        const { error: pushProfErr } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            xp: resolvedLocalProfile.xp,
            level: resolvedLocalProfile.level,
            hearts: resolvedLocalProfile.hearts,
            last_refill_time: resolvedLocalProfile.last_refill_time,
            quizzes_taken: resolvedLocalProfile.quizzes_taken,
            quiz_high_score: resolvedLocalProfile.quiz_high_score,
            onboarding_completed: resolvedLocalProfile.onboarding_completed === 1,
            username: resolvedLocalProfile.username || session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            avatar_url: resolvedLocalProfile.avatar_url,
            bio: resolvedLocalProfile.bio || '',
            location: resolvedLocalProfile.location || '',
            native_language: resolvedLocalProfile.native_language || 'English',
            learning_goal: resolvedLocalProfile.learning_goal || 'casual',
            longest_streak: resolvedLocalProfile.longest_streak || 0,
            is_public: resolvedLocalProfile.is_public === 1,
            badges: JSON.parse(resolvedLocalProfile.badges || '[]'),
            interests: resolvedLocalProfile.interests || '',
            updated_at: new Date(resolvedLocalProfile.updated_at || Date.now()).toISOString()
          });

        if (pushProfErr) throw pushProfErr;
      }

      if (resolvedLocalStreak) {
        const { error: pushStreakErr } = await supabase
          .from('streaks')
          .upsert({
            user_id: userId,
            current_streak: resolvedLocalStreak.streak,
            streak_freeze_count: resolvedLocalStreak.streak_freeze_count,
            was_streak_broken: resolvedLocalStreak.was_streak_broken === 1,
            last_active_date: resolvedLocalStreak.last_active_date,
            activity_dates: JSON.parse(resolvedLocalStreak.activity_dates),
            freeze_used_dates: JSON.parse(resolvedLocalStreak.freeze_used_dates),
            updated_at: new Date(resolvedLocalStreak.updated_at).toISOString()
          });

        if (pushStreakErr) throw pushStreakErr;
      }

      if (resolvedLocalLeague) {
        const { error: pushLeagueErr } = await supabase
          .from('leagues')
          .upsert({
            user_id: userId,
            weekly_xp: resolvedLocalLeague.weekly_xp,
            league_tier: resolvedLocalLeague.tier,
            updated_at: new Date().toISOString()
          });

        if (pushLeagueErr) throw pushLeagueErr;
      }

      if (progressToPush.length > 0) {
        const { error: pushProgErr } = await supabase
          .from('progress')
          .upsert(
            progressToPush.map(p => ({
              user_id: userId,
              lesson_id: p.lesson_id,
              unit_id: p.unit_id,
              is_completed: p.is_completed === 1,
              score: p.score,
              completed_at: p.completed_at,
              updated_at: new Date(p.updated_at || Date.now()).toISOString()
            })),
            { onConflict: 'user_id,lesson_id' }
          );

        if (pushProgErr) throw pushProgErr;
      }

      if (vocabToPush.length > 0) {
        const { error: pushVocabErr } = await supabase
          .from('vocabulary_mastery')
          .upsert(
            vocabToPush.map(v => ({
              user_id: userId,
              vocab_id: v.id,
              is_learned: v.is_learned === 1,
              is_saved: v.is_saved === 1,
              learned_at: v.learned_at,
              saved_at: v.saved_at,
              updated_at: new Date(v.updated_at || Date.now()).toISOString()
            })),
            { onConflict: 'user_id,vocab_id' }
          );

        if (pushVocabErr) throw pushVocabErr;
      }

      if (pronunciationToPush.length > 0) {
        const { error: pushPronunciationErr } = await supabase
          .from('pronunciation_scores')
          .upsert(
            pronunciationToPush.map(p => ({
              user_id: userId,
              word: p.word,
              score: p.score,
              feedback: p.feedback,
              updated_at: new Date(p.updated_at || Date.now()).toISOString()
            })),
            { onConflict: 'user_id,word' }
          );

        if (pushPronunciationErr) throw pushPronunciationErr;
      }

      if (localXpLog.length > 0) {
        const { error: pushXpErr } = await supabase
          .from('xp_history')
          .upsert(
            localXpLog.map(x => ({
              user_id: userId,
              amount: x.amount,
              source: x.source,
              timestamp: x.timestamp
            }))
          );

        if (pushXpErr) throw pushXpErr;
      }

      // ----------------------------------------------------
      // 5. UPDATE METADATA & REFRESH STORE STATES
      // ----------------------------------------------------
      await AsyncStorage.setItem(lastSyncedAtKey, String(syncStartTime));

      // Refresh stores so user UI matches fresh local SQLite pulls
      await useUserStore.getState().loadUser();
      await useProgressStore.getState().loadProgress();

      set({
        syncState: 'idle',
        lastSyncedAt: syncStartTime
      });

      retryCount = 0;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    } catch (err) {
      console.error('Failed Cloud Sync operation:', err);
      set({ syncState: 'error' });

      // Queue and schedule retry with exponential backoff
      retryCount += 1;
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 300000);

      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        get().sync().catch(console.error);
      }, backoffDelay);
    }
  },

  initialize: () => {
    // 1. Connection Event listener
    const unsubscribe = NetInfo.addEventListener(state => {
      const isOnline = !!state.isConnected && !!state.isInternetReachable;
      const wasOffline = !get().isOnline;
      
      set({ isOnline });

      if (isOnline) {
        // Reset retry counters on reconnection
        retryCount = 0;
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        // Fire sync immediately
        get().sync().catch(console.error);
      } else {
        set({ syncState: 'offline' });
      }
    });

    // 2. Initial fetch check
    NetInfo.fetch().then(state => {
      const isOnline = !!state.isConnected && !!state.isInternetReachable;
      set({ isOnline });
      if (isOnline) {
        get().sync().catch(console.error);
      } else {
        set({ syncState: 'offline' });
      }
    });
  }
}));
