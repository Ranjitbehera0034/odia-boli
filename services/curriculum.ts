import { getDB } from './srs';
import { CURRICULUM } from './curriculumData';

/**
 * Initialize the curriculum progress tracking table.
 */
export async function initCurriculumDatabase(): Promise<void> {
  try {
    const db = getDB();
    
    // Create progress table for lessons
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS lesson_progress (
        lesson_id TEXT PRIMARY KEY,
        unit_id INTEGER NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        score INTEGER NOT NULL DEFAULT 0,
        completed_at INTEGER
      );
    `);
    
    console.log('Curriculum progress database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize curriculum database:', error);
  }
}

export interface LessonProgress {
  lessonId: string;
  unitId: number;
  isCompleted: boolean;
  score: number;
  completedAt: number | null;
}

/**
 * Retrieve progress for a single lesson.
 */
export async function getLessonProgress(lessonId: string): Promise<LessonProgress | null> {
  try {
    const db = getDB();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM lesson_progress WHERE lesson_id = ?;',
      [lessonId]
    );

    if (!row) return null;

    return {
      lessonId: row.lesson_id,
      unitId: row.unit_id,
      isCompleted: row.is_completed === 1,
      score: row.score,
      completedAt: row.completed_at,
    };
  } catch (error) {
    console.error(`Failed to get progress for lesson ${lessonId}:`, error);
    return null;
  }
}

/**
 * Mark a lesson as completed with a given score.
 */
export async function completeLesson(lessonId: string, unitId: number, score: number): Promise<void> {
  try {
    const db = getDB();
    const now = Date.now();
    
    await db.runAsync(
      `INSERT INTO lesson_progress (lesson_id, unit_id, is_completed, score, completed_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(lesson_id) DO UPDATE SET
         is_completed = 1,
         score = MAX(score, excluded.score),
         completed_at = excluded.completed_at;`,
      [lessonId, unitId, score, now]
    );
    
    console.log(`Lesson ${lessonId} marked completed with score ${score}.`);
  } catch (error) {
    console.error(`Failed to complete lesson ${lessonId}:`, error);
  }
}

export interface UnitProgress {
  unitId: number;
  completedLessonsCount: number;
  totalLessonsCount: number;
  progressPercent: number; // 0 to 100
}

/**
 * Get progress details for a specific unit.
 */
export async function getUnitProgress(unitId: number): Promise<UnitProgress> {
  try {
    const db = getDB();
    
    // Find the unit in static data to see how many lessons it has
    const staticUnit = CURRICULUM.find(u => u.id === unitId);
    if (!staticUnit) {
      return { unitId, completedLessonsCount: 0, totalLessonsCount: 0, progressPercent: 0 };
    }
    
    const totalLessonsCount = staticUnit.lessons.length;
    
    // Fetch completed lessons count for this unit from DB
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM lesson_progress WHERE unit_id = ? AND is_completed = 1;',
      [unitId]
    );
    
    const completedLessonsCount = row ? row.count : 0;
    const progressPercent = totalLessonsCount > 0 
      ? Math.round((completedLessonsCount / totalLessonsCount) * 100) 
      : 0;
      
    return {
      unitId,
      completedLessonsCount,
      totalLessonsCount,
      progressPercent,
    };
  } catch (error) {
    console.error(`Failed to get unit progress for unit ${unitId}:`, error);
    return { unitId, completedLessonsCount: 0, totalLessonsCount: 0, progressPercent: 0 };
  }
}

/**
 * Get completion stats for the entire curriculum.
 */
export async function getOverallCurriculumProgress(): Promise<{ completedLessons: number; totalLessons: number; progressPercent: number }> {
  try {
    const db = getDB();
    
    let totalLessons = 0;
    for (const unit of CURRICULUM) {
      totalLessons += unit.lessons.length;
    }
    
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM lesson_progress WHERE is_completed = 1;'
    );
    const completedLessons = row ? row.count : 0;
    const progressPercent = totalLessons > 0 
      ? Math.round((completedLessons / totalLessons) * 100) 
      : 0;
      
    return {
      completedLessons,
      totalLessons,
      progressPercent,
    };
  } catch (error) {
    console.error('Failed to get overall curriculum progress:', error);
    return { completedLessons: 0, totalLessons: 0, progressPercent: 0 };
  }
}

/**
 * Reset all curriculum progress back to default.
 */
export async function resetCurriculumProgress(): Promise<void> {
  try {
    const db = getDB();
    await db.runAsync('DELETE FROM lesson_progress;');
    console.log('Curriculum progress reset successfully.');
  } catch (error) {
    console.error('Failed to reset curriculum progress:', error);
  }
}
