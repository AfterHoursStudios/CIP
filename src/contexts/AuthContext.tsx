import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import * as authService from '../services/auth.service';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data } = await authService.getCurrentUser();
          setUser(data);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    try {
      console.log('Checking user authentication...');

      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Auth check timeout')), 10000)
      );

      const authPromise = authService.getCurrentUser();

      const { data } = await Promise.race([authPromise, timeoutPromise.then(() => ({ data: null, error: 'timeout' }))]) as any;

      console.log('Auth check complete, user:', data ? 'found' : 'not found');
      setUser(data);
    } catch (error) {
      console.log('Auth check error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await authService.signUp(email, password, fullName);
    if (data) {
      setUser(data);
    }
    return { error };
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await authService.signIn(email, password);
    if (data) {
      setUser(data);
    }
    return { error };
  }

  async function signOut() {
    await authService.signOut();
    setUser(null);
  }

  async function resetPassword(email: string) {
    const { error } = await authService.resetPassword(email);
    return { error };
  }

  async function signInWithGoogle() {
    const { data, error } = await authService.signInWithGoogle();
    if (data) {
      setUser(data);
    }
    return { error };
  }

  async function signInWithApple() {
    const { data, error } = await authService.signInWithApple();
    if (data) {
      setUser(data);
    }
    return { error };
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithApple,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
