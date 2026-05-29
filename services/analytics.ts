/**
 * services/analytics.ts
 *
 * Unified analytics module for Odia Agent.
 * Integrates Sentry (crash reporting) + PostHog (product analytics).
 *
 * Setup:
 *   1. Set SENTRY_DSN in .env
 *   2. Set POSTHOG_API_KEY in .env
 *   3. Call initAnalytics() once during app startup (App.tsx)
 *   4. Call identifyUser() after login
 *   5. Call trackEvent() anywhere in the app
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// ─── Event Constants ────────────────────────────────────────────────────────

export const EVENTS = {
  // Learning
  LESSON_STARTED: 'lesson_started',
  LESSON_COMPLETED: 'lesson_completed',
  EXERCISE_CORRECT: 'exercise_correct',
  EXERCISE_WRONG: 'exercise_wrong',

  // Social
  FRIEND_ADDED: 'friend_added',
  CHALLENGE_SENT: 'challenge_sent',

  // Retention
  STREAK_LOST: 'streak_lost',
  STREAK_MILESTONE: 'streak_milestone',

  // Engagement
  DAILY_CHEST_CLAIMED: 'daily_chest_claimed',
  QUIZ_COMPLETED: 'quiz_completed',
  PRONUNCIATION_ANALYZED: 'pronunciation_analyzed',
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];

// ─── PostHog lazy import (avoids crash if package not installed yet) ─────────

let posthogInstance: any = null;

async function getPostHog() {
  if (posthogInstance) return posthogInstance;
  try {
    const { PostHog } = await import('posthog-react-native');
    const apiKey = Constants.expoConfig?.extra?.posthogApiKey;
    if (!apiKey) {
      console.warn('[Analytics] PostHog API key not set. Skipping PostHog init.');
      return null;
    }
    posthogInstance = new PostHog(apiKey, {
      host: 'https://us.i.posthog.com',
      // Flush every 30 events or every 30 seconds — battery-friendly
      flushAt: 30,
      flushInterval: 30000,
    });
    return posthogInstance;
  } catch (e) {
    console.warn('[Analytics] PostHog not available:', e);
    return null;
  }
}

// ─── Sentry Init ─────────────────────────────────────────────────────────────

export function initSentry() {
  const dsn = Constants.expoConfig?.extra?.sentryDsn;
  if (!dsn) {
    console.warn('[Analytics] Sentry DSN not set. Crash reporting disabled.');
    return;
  }

  Sentry.init({
    dsn,
    // Performance tracing: 10% of sessions in production
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    // Capture 100% of errors always
    sampleRate: 1.0,
    environment: __DEV__ ? 'development' : 'production',
    // Attach device/app context automatically
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Call once during app startup before mounting the root component.
 */
export async function initAnalytics(): Promise<void> {
  initSentry();
  await getPostHog(); // Pre-warm the PostHog client
}

/**
 * Identify the current user in both Sentry and PostHog.
 * Call after successful login / session restore.
 */
export async function identifyUser(
  userId: string,
  traits: { username?: string; email?: string; level?: number } = {}
): Promise<void> {
  // Sentry context
  Sentry.setUser({ id: userId, username: traits.username, email: traits.email });

  // PostHog identify
  const ph = await getPostHog();
  if (ph) {
    ph.identify(userId, {
      username: traits.username,
      email: traits.email,
      level: traits.level,
    });
  }
}

/**
 * Clear user identity (on logout).
 */
export async function resetAnalyticsUser(): Promise<void> {
  Sentry.setUser(null);
  const ph = await getPostHog();
  if (ph) {
    ph.reset();
  }
}

/**
 * Track a product analytics event.
 * Properties are optional but recommended for actionable insights.
 *
 * @example
 * trackEvent(EVENTS.LESSON_COMPLETED, { lessonId: 'greetings_1', score: 90, xp: 20 })
 */
export async function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>
): Promise<void> {
  if (__DEV__) {
    console.log(`[Analytics] ${event}`, properties ?? '');
  }

  const ph = await getPostHog();
  if (ph) {
    ph.capture(event, properties);
  }
}

/**
 * Capture an error with Sentry (call from catch blocks for non-fatal errors).
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) {
    console.error('[Sentry] Captured error:', error);
  }
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, val]) => scope.setExtra(key, val));
    }
    Sentry.captureException(error);
  });
}
