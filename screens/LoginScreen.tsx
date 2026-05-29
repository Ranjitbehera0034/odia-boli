import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, View as RNView, Keyboard } from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/useAuthStore';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tintCol = useThemeColor({}, 'tint');
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const textCol = useThemeColor({}, 'text');

  const { signIn, loading } = useAuthStore();

  const handleLogin = async () => {
    setError(null);
    Keyboard.dismiss();

    const emailTrimmed = email.trim();
    if (!emailTrimmed || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    const { error: signInError } = await signIn(emailTrimmed, password);

    if (signInError) {
      setError(signInError.message || 'Failed to log in. Please check your credentials.');
    }
  };

  return (
    <View style={styles.container}>
      <RNView style={styles.formContainer}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Log in to continue your Odia learning path</Text>

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

        <Text style={styles.inputLabel}>PASSWORD</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { borderColor: borderCol, backgroundColor: cardCol, color: textCol }]}
        />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ForgotPassword')}
          style={styles.forgotButton}
        >
          <Text style={[styles.forgotButtonText, { color: tintCol }]}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={loading}
          style={[styles.loginButton, { backgroundColor: tintCol, opacity: loading ? 0.7 : 1 }]}
          onPress={handleLogin}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <RNView style={styles.signupPromptRow}>
          <Text style={styles.signupPromptText}>Don't have an account? </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Signup')}>
            <Text style={[styles.signupLinkText, { color: tintCol }]}>Sign Up</Text>
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: Theme.spacing.xl,
  },
  forgotButtonText: {
    fontSize: Theme.typography.fontSize.xs,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  loginButton: {
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
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: Theme.typography.fontSize.md - 1,
    fontWeight: Theme.typography.fontWeight.bold,
  },
  signupPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  signupPromptText: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
  },
  signupLinkText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
  },
});
