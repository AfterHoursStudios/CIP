import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { COLORS, SPACING, FONT_SIZE } from '../../src/lib/constants';

export default function AuthCallbackScreen() {
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    // Small delay to let Supabase process the callback
    const timer = setTimeout(() => {
      handleCallback();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  async function handleCallback() {
    try {
      setStatus('Checking authentication...');

      // For web, Supabase auto-handles the hash fragment
      // Just check if we have a session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session error:', error);
        setStatus('Authentication error');
        setTimeout(() => router.replace('/(auth)/login'), 1500);
        return;
      }

      if (session) {
        setStatus('Success! Redirecting...');
        router.replace('/(tabs)');
      } else {
        setStatus('No session found');
        setTimeout(() => router.replace('/(auth)/login'), 1500);
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      setStatus('Something went wrong');
      setTimeout(() => router.replace('/(auth)/login'), 1500);
    }
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  status: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
});
