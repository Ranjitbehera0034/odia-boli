import React from 'react';
import { StyleSheet, TouchableOpacity, View as RNView, Platform } from 'react-native';
import { Text, View } from '../components/Themed';
import { useThemeColor } from '../hooks/useThemeColor';
import Theme from '../constants/Theme';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/useAuthStore';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../services/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const tintCol = useThemeColor({}, 'tint');
  const cardCol = useThemeColor({}, 'card');
  const borderCol = useThemeColor({}, 'border');
  const setGuestMode = useAuthStore((state) => state.setGuestMode);

  const handleGoogleSignIn = async () => {
    try {
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'odia-agent' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === 'success' && result.url) {
          const hash = result.url.split('#')[1];
          if (hash) {
            const params = Object.fromEntries(new URLSearchParams(hash));
            if (params.access_token && params.refresh_token) {
              await supabase.auth.setSession({
                access_token: params.access_token,
                refresh_token: params.refresh_token,
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Google Sign In Error:', e);
      alert('Failed to sign in with Google. Please try again.');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) throw error;
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        console.error('Apple Sign In Error:', e);
        alert('Failed to sign in with Apple. Please try again.');
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Branding and Peacock Icon */}
      <RNView style={styles.brandingContainer}>
        <Text style={styles.mascotEmoji}>🦚</Text>
        <Text style={styles.title}>Odia Boli</Text>
        <Text style={styles.subtitle}>Learn Odia & Explore Odisha's Cultural Heritage</Text>
      </RNView>

      {/* Button container */}
      <RNView style={styles.buttonsContainer}>
        {/* Email Register / Log In */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.primaryButton, { backgroundColor: tintCol }]}
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={styles.primaryButtonText}>Get Started (Email Signup)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.outlineButton, { borderColor: borderCol, backgroundColor: cardCol }]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={[styles.outlineButtonText, { color: tintCol }]}>I Already Have An Account</Text>
        </TouchableOpacity>

        <RNView style={styles.dividerRow}>
          <RNView style={[styles.dividerLine, { backgroundColor: borderCol }]} />
          <Text style={styles.dividerText}>OR</Text>
          <RNView style={[styles.dividerLine, { backgroundColor: borderCol }]} />
        </RNView>

        {/* Social Sign-In buttons */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.socialButton, { borderColor: borderCol, backgroundColor: cardCol }]}
          onPress={handleGoogleSignIn}
        >
          <Text style={styles.socialButtonIcon}>🌐</Text>
          <Text style={styles.socialButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={Theme.borderRadius.md}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        )}

        {/* Guest Skip mode */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.guestButton}
          onPress={setGuestMode}
        >
          <Text style={[styles.guestButtonText, { color: tintCol }]}>Skip & Continue as Guest →</Text>
        </TouchableOpacity>
      </RNView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 50,
  },
  brandingContainer: {
    alignItems: 'center',
    marginTop: 40,
    backgroundColor: 'transparent',
  },
  mascotEmoji: {
    fontSize: 80,
    marginBottom: Theme.spacing.md,
  },
  title: {
    fontSize: Theme.typography.fontSize.xxxl + 4,
    fontWeight: Theme.typography.fontWeight.heavy,
    marginBottom: Theme.spacing.xs,
  },
  subtitle: {
    fontSize: Theme.typography.fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.lg,
    lineHeight: Theme.typography.lineHeight.sm,
  },
  buttonsContainer: {
    width: '100%',
    backgroundColor: 'transparent',
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xl,
    backgroundColor: 'transparent',
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Theme.spacing.md,
    fontSize: Theme.typography.fontSize.xs,
    color: '#9CA3AF',
    fontWeight: Theme.typography.fontWeight.bold,
  },
  socialButton: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: Theme.spacing.lg - 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  socialButtonIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  socialButtonText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.semibold,
  },
  appleButton: {
    width: '100%',
    height: 52,
    marginBottom: Theme.spacing.md,
  },
  guestButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  guestButtonText: {
    fontSize: Theme.typography.fontSize.sm,
    fontWeight: Theme.typography.fontWeight.bold,
  },
});
