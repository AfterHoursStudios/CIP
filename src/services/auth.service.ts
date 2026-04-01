import { supabase, supabaseUrl } from '../lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { User, ApiResponse } from '../types';

// Required for web browser auth session
WebBrowser.maybeCompleteAuthSession();

// Helper to get the correct redirect URL for the current platform
function getRedirectUrl(path: string): string {
  if (Platform.OS === 'web') {
    // On web, use the current origin
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cipro.vercel.app';
    return `${origin}/${path}`;
  }
  // On native, use expo's makeRedirectUri
  return makeRedirectUri({
    scheme: 'inspectionpro',
    path,
  });
}

export async function signUp(
  email: string,
  password: string,
  fullName: string
): Promise<ApiResponse<User>> {
  try {
    console.log('SignUp: Starting signup for', email);
    console.log('SignUp: Supabase URL configured:', !!supabaseUrl);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    console.log('SignUp: Response received', {
      hasData: !!authData,
      hasUser: !!authData?.user,
      hasSession: !!authData?.session,
      error: authError ? { message: authError.message, status: authError.status, code: authError.code } : null
    });

    if (authError) {
      console.error('SignUp: Auth error', authError);
      return { data: null, error: authError.message };
    }

    if (!authData.user) {
      return { data: null, error: 'Failed to create user' };
    }

    // Create user profile (ignore errors - might already exist or RLS issues)
    await supabase.from('users').insert({
      id: authData.user.id,
      email: authData.user.email,
      full_name: fullName,
    }).then(() => {});

    // Process any pending invitations for this email
    try {
      await supabase.rpc('process_pending_invitations', {
        p_user_id: authData.user.id,
      });
    } catch (e) {
      // Ignore errors - invitations will be processed on next login
      console.log('Error processing pending invitations:', e);
    }

    return {
      data: {
        id: authData.user.id,
        email: authData.user.email || email,
        full_name: fullName,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<ApiResponse<User>> {
  try {
    console.log('Calling Supabase signInWithPassword...', { supabaseUrl });

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('Supabase response:', { authData: !!authData, authError });

    if (authError) {
      console.error('Auth error:', authError);
      return { data: null, error: authError.message };
    }

    if (!authData.user) {
      return { data: null, error: 'Failed to sign in' };
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    // Process any pending invitations for this user
    try {
      await supabase.rpc('process_pending_invitations', {
        p_user_id: authData.user.id,
      });
    } catch (e) {
      console.log('Error processing pending invitations:', e);
    }

    if (profileError || !profile) {
      return {
        data: {
          id: authData.user.id,
          email: authData.user.email!,
          full_name: authData.user.user_metadata?.full_name || null,
          avatar_url: null,
          created_at: authData.user.created_at,
          updated_at: authData.user.updated_at || authData.user.created_at,
        },
        error: null,
      };
    }

    return { data: profile, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return { data: null, error: (error as Error).message || 'Network error. Please try again.' };
  }
}

export async function signOut(): Promise<ApiResponse<null>> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { data: null, error: error.message };
  }
  return { data: null, error: null };
}

export async function resetPassword(email: string): Promise<ApiResponse<null>> {
  const redirectUrl = getRedirectUrl('auth/reset-password');

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    return { data: null, error: error.message };
  }
  return { data: null, error: null };
}

export async function getCurrentUser(): Promise<ApiResponse<User>> {
  try {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return { data: null, error: authError?.message || 'Not authenticated' };
    }

  let userProfile: User;

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (profileError || !profile) {
    // Profile doesn't exist - create it (for OAuth users)
    const fullName = authUser.user_metadata?.full_name ||
                     authUser.user_metadata?.name ||
                     '';
    const avatarUrl = authUser.user_metadata?.avatar_url ||
                      authUser.user_metadata?.picture ||
                      null;

    const { data: newProfile, error: createError } = await supabase
      .from('users')
      .upsert({
        id: authUser.id,
        email: authUser.email!,
        full_name: fullName,
        avatar_url: avatarUrl,
      })
      .select()
      .single();

    if (createError || !newProfile) {
      // Return fallback data if upsert fails (table might not exist)
      userProfile = {
        id: authUser.id,
        email: authUser.email!,
        full_name: fullName,
        avatar_url: avatarUrl,
        created_at: authUser.created_at,
        updated_at: authUser.updated_at || authUser.created_at,
      };
    } else {
      userProfile = newProfile;
    }
  } else {
    userProfile = profile;
  }

  // Process any pending invitations on every login (must complete before returning)
  try {
    await supabase.rpc('process_pending_invitations', {
      p_user_id: authUser.id,
    });
  } catch (e) {
    // Ignore errors - invitations will be processed on next login
    console.log('Error processing pending invitations:', e);
  }

    return { data: userProfile, error: null };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string; avatar_url?: string }
): Promise<ApiResponse<User>> {
  const { data, error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function signInWithGoogle(): Promise<ApiResponse<User>> {
  try {
    const redirectUrl = getRedirectUrl('auth/callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });

    if (error) {
      return { data: null, error: error.message };
    }

    // For web, the redirect happens automatically
    if (Platform.OS === 'web') {
      return { data: null, error: null };
    }

    // For native, open the browser
    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      if (result.type === 'success') {
        const url = new URL(result.url);

        // Supabase returns tokens in the URL fragment (hash), not query params
        // Parse the hash fragment to get the tokens
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const accessToken = hashParams.get('access_token') || url.searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || url.searchParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (sessionError) {
            return { data: null, error: sessionError.message };
          }

          // Get user profile
          const { data: profile } = await getCurrentUser();
          return { data: profile, error: null };
        }
      }

      return { data: null, error: 'Authentication cancelled or no tokens received' };
    }

    return { data: null, error: 'Failed to initiate OAuth' };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}

export async function signInWithApple(): Promise<ApiResponse<User>> {
  try {
    const redirectUrl = getRedirectUrl('auth/callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });

    if (error) {
      return { data: null, error: error.message };
    }

    if (Platform.OS === 'web') {
      return { data: null, error: null };
    }

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      if (result.type === 'success') {
        const url = new URL(result.url);

        // Supabase returns tokens in the URL fragment (hash), not query params
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const accessToken = hashParams.get('access_token') || url.searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || url.searchParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (sessionError) {
            return { data: null, error: sessionError.message };
          }

          const { data: profile } = await getCurrentUser();
          return { data: profile, error: null };
        }
      }

      return { data: null, error: 'Authentication cancelled or no tokens received' };
    }

    return { data: null, error: 'Failed to initiate OAuth' };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}
