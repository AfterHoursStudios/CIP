import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts';
import { Button, Input, Card } from '../../src/components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../../src/lib/constants';

export default function LoginScreen() {
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loginError, setLoginError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Check if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  async function handleAddToHomeScreen() {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  }

  function validate() {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleLogin() {
    // Prevent double-clicks
    if (isLoading) return;
    if (!validate()) return;

    setLoginError(null);
    setIsLoading(true);

    try {
      console.log('Starting login...');
      const { error } = await signIn(email, password);
      console.log('Login result:', { error });

      if (error) {
        setLoginError(error);
        setIsLoading(false);
      } else {
        console.log('Login successful, navigating to schedule...');
        // Reset loading state before navigation
        setIsLoading(false);
        router.replace('/(tabs)/schedule');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setIsGoogleLoading(false);

    if (error && error !== 'Authentication cancelled') {
      Alert.alert('Google Sign In Failed', error);
    }
  }

  async function handleAppleSignIn() {
    setIsAppleLoading(true);
    const { error } = await signInWithApple();
    setIsAppleLoading(false);

    if (error && error !== 'Authentication cancelled') {
      Alert.alert('Apple Sign In Failed', error);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Link href="/(marketing)" asChild>
          <TouchableOpacity style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../CIP Logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>Construction Inspection Pro</Text>
            </View>
          </TouchableOpacity>
        </Link>

        {Platform.OS === 'web' && installPrompt && !isInstalled && (
          <TouchableOpacity style={styles.addToHomeButton} onPress={handleAddToHomeScreen}>
            <Ionicons name="download-outline" size={18} color={COLORS.primary} />
            <Text style={styles.addToHomeText}>Add to Home Screen</Text>
          </TouchableOpacity>
        )}

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardSubtitle}>Sign in to continue</Text>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon="mail-outline"
            error={errors.email}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            autoComplete="password"
            leftIcon="lock-closed-outline"
            error={errors.password}
          />

          <Link href="/(auth)/forgot-password" asChild>
            <Text style={styles.forgotPassword}>Forgot Password?</Text>
          </Link>

          {loginError && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{loginError}</Text>
            </View>
          )}

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            fullWidth
            style={styles.button}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.oauthButtons}>
            <TouchableOpacity
              style={styles.oauthButton}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading}
            >
              <Ionicons name="logo-google" size={24} color="#DB4437" />
              <Text style={styles.oauthButtonText}>Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.oauthButton, styles.appleButton]}
                onPress={handleAppleSignIn}
                disabled={isAppleLoading}
              >
                <Ionicons name="logo-apple" size={24} color={COLORS.white} />
                <Text style={[styles.oauthButtonText, styles.appleButtonText]}>Apple</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <Text style={styles.footerLink}>Sign Up</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
    // @ts-ignore - web only
    maxWidth: 440,
    // @ts-ignore - web only
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addToHomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary + '15',
    borderRadius: RADIUS.full,
    marginBottom: SPACING.lg,
    alignSelf: 'center',
  },
  addToHomeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
  },
  card: {
    padding: SPACING.xl,
    borderRadius: 20,
    elevation: 10,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.25)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.25,
          shadowRadius: 20,
        }),
  } as any,
  cardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  cardSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  forgotPassword: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    textAlign: 'right',
    marginBottom: SPACING.lg,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
  },
  button: {
    marginTop: SPACING.md,
    borderRadius: 12,
    height: 52,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gray300,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  oauthButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  oauthButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
    gap: SPACING.sm,
    height: 48,
  },
  oauthButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
  },
  appleButton: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.black,
  },
  appleButtonText: {
    color: COLORS.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  footerText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  footerLink: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
