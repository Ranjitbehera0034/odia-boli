import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, View as RNView, Keyboard } from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/useAuthStore';

export default function SignupScreen() {
  const navigation = useNavigation<any>();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tintCol = useThemeColor({}, 'tint');
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const textCol = useThemeColor({}, 'text');

  const { signUp, loading } = useAuthStore();

  const handleSignup = async () => {
    setError(null);
    Keyboard.dismiss();

    const usernameTrimmed = username.trim();
    const emailTrimmed = email.trim();

    if (!usernameTrimmed || !emailTrimmed || !password) {
      setError('Please fill in all details.');
      return;
    }

    if (usernameTrimmed.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    const { error: signUpError } = await signUp(emailTrimmed, password, usernameTrimmed);

    if (signUpError) {
      setError(signUpError.message || 'Failed to sign up. Please try again.');
    } else {
      // Navigate to email verification pending screen
      navigation.navigate('EmailVerify', { email: emailTrimmed });
    }
  };

  return (
    <View style={styles.container}>
      <RNView style={styles.formContainer}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Sign up to sync your progress and compete in leagues</Text>

        {error && (
          <RNView style={[styles.errorBox, { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </RNView>
        )}

        <Text style={styles.inputLabel}>USERNAME</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Choose a display name"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { borderColor: borderCol, backgroundColor: cardCol, color: textCol }]}
        />

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

        <Text style={styles.inputLabel}>PASSWORD</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Min 6 characters"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { borderColor: borderCol, backgroundColor: cardCol, color: textCol }]}
        />

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={loading}
          style={[styles.signupButton, { backgroundColor: tintCol, opacity: loading ? 0.7 : 1, marginTop: Theme.spacing.md }]}
          onPress={handleSignup}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.signupButtonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <RNView style={styles.loginPromptRow}>
          <Text style={styles.loginPromptText}>Already have an account? </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.loginLinkText, { color: tintCol }]}>Log In</Text>
          </TouchableOpacity>
        </RNView>
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
  signupButton: {
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
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  loginPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  loginPromptText: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
  },
  loginLinkText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
  },
});
