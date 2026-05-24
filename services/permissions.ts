import { Audio } from 'expo-av';

export interface PermissionState {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
}

/**
 * Check the status of microphone permission.
 */
export async function checkMicrophonePermission(): Promise<PermissionState> {
  try {
    const { status, canAskAgain } = await Audio.getPermissionsAsync();
    return {
      granted: status === 'granted',
      canAskAgain,
      status: status as any,
    };
  } catch (error) {
    console.error('Failed to get microphone permissions:', error);
    return { granted: false, canAskAgain: true, status: 'undetermined' };
  }
}

/**
 * Request microphone permissions.
 */
export async function requestMicrophonePermission(): Promise<PermissionState> {
  try {
    const { status, canAskAgain } = await Audio.requestPermissionsAsync();
    return {
      granted: status === 'granted',
      canAskAgain,
      status: status as any,
    };
  } catch (error) {
    console.error('Failed to request microphone permissions:', error);
    return { granted: false, canAskAgain: true, status: 'undetermined' };
  }
}
