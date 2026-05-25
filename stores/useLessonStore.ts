import { create } from 'zustand';
import { getDB } from '../services/srs';
import { CURRICULUM, Unit } from '../services/curriculumData';

export interface LessonStoreState {
  units: Unit[];
  activeUnitId: number | null;
  activeLessonId: string | null;
  loading: boolean;

  loadLessons: () => Promise<void>;
  setActiveUnit: (unitId: number | null) => void;
  setActiveLesson: (lessonId: string | null) => void;
}

export const useLessonStore = create<LessonStoreState>((set, get) => ({
  units: [],
  activeUnitId: null,
  activeLessonId: null,
  loading: true,

  loadLessons: async () => {
    try {
      const db = getDB();
      // Ensure the lessons are queryable to verify schema initialization
      await db.getAllAsync('SELECT * FROM lessons;');
      set({ units: CURRICULUM, loading: false });
    } catch (e) {
      console.error('Failed to query lessons in SQLite:', e);
      set({ units: CURRICULUM, loading: false });
    }
  },

  setActiveUnit: (unitId) => set({ activeUnitId: unitId }),
  setActiveLesson: (lessonId) => set({ activeLessonId: lessonId }),
}));
