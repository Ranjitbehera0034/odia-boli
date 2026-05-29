import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, View as RNView, Alert, Keyboard } from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import * as AuthSession from 'expo-auth-session';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tintCol = useThemeColor({}, 'tint');
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const textCol = useThemeColor({}, 'text');

  const handleResetRequest = async () => {
    setError(null);
    Keyboard.dismiss();

    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'odia-agent' });
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailTrimmed, {
        redirectTo: redirectUri,
      });

      if (resetError) throw resetError;

      Alert.alert(
        'Recovery Email Sent ✉️',
        'If an account exists with this email, you will receive a password reset link shortly.',
        [{ text: 'Back to Login', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <RNView style={styles.formContainer}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your email to receive a recovery link</Text>

        {error && (
          <RNView style={[styles.errorBox, { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </RNView>
        )}

        <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="example@email.com"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          style={[styles.input, { borderColor: borderCol, backgroundColor: cardCol, color: textCol }]}
        />

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={loading}
          style={[styles.resetButton, { backgroundColor: tintCol, opacity: loading ? 0.7 : 1, marginTop: Theme.spacing.md }]}
          onPress={handleResetRequest}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.resetButtonText}>Send Recovery Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={[styles.backButtonText, { color: tintCol }]}>← Back to Log In</Text>
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
  },
  formContainer: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: Theme.typography.fontSize.xxl,
    fontWeight: Theme.typography.fontWeight.bold,
    marginBottom: Theme.spacing.xs,
  },
  subtitle: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
    marginBottom: Theme.spacing.xl,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  errorText: {
    color: '#DC2626',
    fontSize: Theme.typography.fontSize.sm,
    lineHeight: Theme.typography.lineHeight.sm,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1.2,
    marginBottom: Theme.spacing.xs,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md - 2,
    fontSize: Theme.typography.fontSize.sm,
    marginBottom: Theme.spacing.lg,
  },
  resetButton: {
    width: '100%',
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resetButtonText: {
    color: '#FFFFFF',
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
