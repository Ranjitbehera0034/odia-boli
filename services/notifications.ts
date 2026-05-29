import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notifications presentation behavior (so they appear even when app is in foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and register notifications settings
 */
export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notifications!');
      return false;
    }

    // Android channel configuration
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('challenges-channel', {
        name: 'Challenges',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF9800',
      });
    }

    return true;
  } catch (e) {
    console.error('Failed to setup notifications:', e);
    return false;
  }
}

/**
 * Triggers a local push notification alert
 */
export async function showLocalNotification(title: string, body: string): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null, // trigger null = immediately
    });
    return notificationId;
  } catch (e) {
    console.error('Failed to trigger local notification:', e);
    return null;
  }
}

/**
 * Schedules a local push notification for a specific date/time
 */
export async function scheduleNotificationAt(title: string, body: string, date: Date): Promise<string | null> {
  try {
    // Only schedule if the date is in the future
    if (date.getTime() <= Date.now()) return null;

    const seconds = Math.max(1, Math.round((date.getTime() - Date.now()) / 1000));

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    });
    return notificationId;
  } catch (e) {
    console.error('Failed to schedule local notification:', e);
    return null;
  }
}

