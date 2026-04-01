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

    // Listen for auth changes (only handle sign out - sign in is handled by signIn function)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event);
        if (event === 'SIGNED_OUT') {
          setUser(null);
          clearStaleSession();
        }
        // Don't handle SIGNED_IN here - it's handled by the signIn function
        // This prevents race conditions and double-fetching
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('Auth check timeout - clearing stale session');
      clearStaleSession();
      setUser(null);
      setIsLoading(false);
    }, 5000);

    try {
      const { data, error } = await authService.getCurrentUser();
      clearTimeout(timeout);
      if (error || !data) {
        // Clear stale session if auth fails
        clearStaleSession();
        setUser(null);
      } else {
        setUser(data);
      }
    } catch (error) {
      clearTimeout(timeout);
      clearStaleSession();
      setUser(null);
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  }

  function clearStaleSession() {
    if (typeof window !== 'undefined') {
      // Clear localStorage
      const localKeysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
          localKeysToRemove.push(key);
        }
      }
      localKeysToRemove.forEach(key => window.localStorage.removeItem(key));

      // Clear sessionStorage
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
          sessionKeysToRemove.push(key);
        }
      }
      sessionKeysToRemove.forEach(key => window.sessionStorage.removeItem(key));
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
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<{ data: null; error: string }>((resolve) => {
        setTimeout(() => resolve({ data: null, error: 'Login timed out. Please try again.' }), 15000);
      });

      const signInPromise = authService.signIn(email, password);
      const { data, error } = await Promise.race([signInPromise, timeoutPromise]);

      if (data) {
        setUser(data);
      }
      return { error };
    } catch (err) {
      console.error('SignIn error:', err);
      return { error: 'Login failed. Please try again.' };
    }
  }

  async function signOut() {
    // Clear user state first
    setUser(null);

    // Sign out from Supabase
    await authService.signOut();

    // Force clear ALL session data from localStorage on web
    if (typeof window !== 'undefined') {
      // Clear all Supabase-related keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => window.localStorage.removeItem(key));

      // Also clear sessionStorage
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth'))) {
          window.sessionStorage.removeItem(key);
        }
      }
    }
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
