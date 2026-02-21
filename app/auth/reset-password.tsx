import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card, Button, Input } from '../../src/components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../src/lib/constants';
import { supabase } from '../../src/lib/supabase';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionSet, setIsSessionSet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handle tokens from URL (could be in hash or query params)
    handleTokens();
  }, []);

  async function handleTokens() {
    try {
      // Check for tokens in URL params
      const accessToken = params.access_token as string;
      const refreshToken = params.refresh_token as string;

      if (accessToken && refreshToken) {
        console.log('Setting session from URL tokens...');
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setError('Invalid or expired reset link. Please request a new one.');
          return;
        }

        setIsSessionSet(true);
      } else {
        // Check if we already have a session (user might have clicked link while app was open)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsSessionSet(true);
        } else {
          setError('No reset token found. Please use the link from your email.');
        }
      }
    } catch (e) {
      setError('Failed to process reset link.');
    }
  }

  async function handleResetPassword() {
    if (!newPassword || !confirmPassword) {
      if (Platform.OS === 'web') {
        alert('Please fill in both password fields');
      } else {
        Alert.alert('Error', 'Please fill in both password fields');
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (Platform.OS === 'web') {
        alert('Passwords do not match');
      } else {
        Alert.alert('Error', 'Passwords do not match');
      }
      return;
    }

    if (newPassword.length < 6) {
      if (Platform.OS === 'web') {
        alert('Password must be at least 6 characters');
      } else {
        Alert.alert('Error', 'Password must be at least 6 characters');
      }
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setIsLoading(false);

    if (error) {
      if (Platform.OS === 'web') {
        alert('Error resetting password: ' + error.message);
      } else {
        Alert.alert('Error', error.message);
      }
    } else {
      // Sign out so they can log in with new password
      await supabase.auth.signOut();

      if (Platform.OS === 'web') {
        alert('Password reset successfully! Please log in with your new password.');
      } else {
        Alert.alert('Success', 'Password reset successfully! Please log in with your new password.');
      }

      router.replace('/(auth)/login');
    }
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Go to Login"
            onPress={() => router.replace('/(auth)/login')}
            style={styles.button}
          />
        </Card>
      </View>
    );
  }

  if (!isSessionSet) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Verifying reset link...</Text>
        </Card>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter your new password below</Text>

          <Input
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            secureTextEntry
          />

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secureTextEntry
          />

          <Button
            title="Reset Password"
            onPress={handleResetPassword}
            loading={isLoading}
            fullWidth
            style={styles.button}
          />

          <Button
            title="Cancel"
            onPress={() => router.replace('/(auth)/login')}
            variant="ghost"
            fullWidth
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    padding: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  button: {
    marginTop: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
});
