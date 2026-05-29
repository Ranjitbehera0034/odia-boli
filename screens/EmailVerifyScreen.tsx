import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, View as RNView, Alert } from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/useAuthStore';
import { RootStackParamList } from '../navigation/types';

type EmailVerifyScreenRouteProp = RouteProp<RootStackParamList, 'EmailVerify'>;

export default function EmailVerifyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<EmailVerifyScreenRouteProp>();
  const email = route.params?.email || 'your email';

  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [checking, setChecking] = useState(false);

  const tintCol = useThemeColor({}, 'tint');
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const textCol = useThemeColor({}, 'text');
  const textMutedCol = useThemeColor({}, 'textMuted');

  // Start a cooldown timer for resending email
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Poll for the session state in case the user verifies on the same device and it auto-logs-in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          // Update the auth store so AppNavigator shifts stack automatically
          useAuthStore.setState({
            session: currentSession,
            user: currentSession.user,
            isGuest: false,
            loading: false,
          });
        }
      } catch (err) {
        console.error('Error polling session on verify screen:', err);
      }
    };

    const interval = setInterval(checkSession, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      Alert.alert(
        'Email Sent ✉️',
        `A new verification link has been sent to ${email}.`
      );
      setResendCooldown(60); // 60 seconds cooldown
    } catch (err: any) {
      Alert.alert('Resend Failed', err.message || 'Could not resend email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        useAuthStore.setState({
          session: currentSession,
          user: currentSession.user,
          isGuest: false,
          loading: false,
        });
        Alert.alert('Success 🎉', 'Your email is verified and you are now logged in.');
      } else {
        Alert.alert(
          'Not Verified Yet ⏳',
          'We couldn\'t find an active verified session yet. Please verify your email by clicking the link in the email we sent you, then try logging in.',
          [
            { text: 'Go to Log In', onPress: () => navigation.navigate('Login') },
            { text: 'Wait', style: 'cancel' }
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred while checking status.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <RNView style={styles.contentContainer}>
        {/* Mascot & Mail Icon Visual */}
        <RNView style={styles.visualContainer}>
          <Text style={styles.mascotEmoji}>🦚</Text>
          <Text style={styles.mailEmoji}>✉️</Text>
        </RNView>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to:
        </Text>
        <Text style={[styles.emailText, { color: tintCol }]}>{email}</Text>

        <RNView style={[styles.card, { backgroundColor: cardCol, borderColor: borderCol }]}>
          <Text style={[styles.cardText, { color: textCol }]}>
            1. Open your email client on this device or another.
          </Text>
          <Text style={[styles.cardText, { color: textCol }]}>
            2. Click the verification link to confirm your email.
          </Text>
          <Text style={[styles.cardText, { color: textCol }]}>
            3. Once verified, you will be automatically logged in, or you can manually check below.
          </Text>
        </RNView>

        {/* Action Buttons */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={checking}
          style={[styles.primaryButton, { backgroundColor: tintCol }]}
          onPress={handleCheckStatus}
        >
          {checking ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Check Verification Status</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={loading || resendCooldown > 0}
          style={[
            styles.outlineButton, 
            { 
              borderColor: borderCol, 
              backgroundColor: cardCol,
              opacity: loading || resendCooldown > 0 ? 0.6 : 1
            }
          ]}
          onPress={handleResendEmail}
        >
          {loading ? (
            <ActivityIndicator size="small" color={tintCol} />
          ) : (
            <Text style={[styles.outlineButtonText, { color: tintCol }]}>
              {resendCooldown > 0 ? `Resend Email (${resendCooldown}s)` : 'Resend Verification Email'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Login')}
          style={styles.backButton}
        >
          <Text style={[styles.backButtonText, { color: textMutedCol }]}>← Back to Log In</Text>
        </TouchableOpacity>
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  visualContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Theme.spacing.lg,
    backgroundColor: 'transparent',
  },
  mascotEmoji: {
    fontSize: 70,
  },
  mailEmoji: {
    fontSize: 40,
    marginLeft: -15,
    marginBottom: -5,
  },
  title: {
    fontSize: Theme.typography.fontSize.xxl,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
  },
  emailText: {
    fontSize: Theme.typography.fontSize.md,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
  },
  cardText: {
    fontSize: Theme.typography.fontSize.sm - 1,
    lineHeight: Theme.typography.lineHeight.sm,
    marginBottom: Theme.spacing.sm,
  },
  primaryButton: {
    width: '100%',
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  outlineButton: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xl,
  },
  outlineButtonText: {
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
  },
  backButtonText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
  },
});
