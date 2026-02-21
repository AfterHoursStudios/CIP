import { supabase } from '../lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { User, ApiResponse } from '../types';

// Required for web browser auth session
WebBrowser.maybeCompleteAuthSession();

export async function signUp(
  email: string,
  password: string,
  fullName: string
): Promise<ApiResponse<User>> {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (authError) {
    return { data: null, error: authError.message };
  }

  if (!authData.user) {
    return { data: null, error: 'Failed to create user' };
  }

  // Create user profile
  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    email: authData.user.email,
    full_name: fullName,
  });

  if (profileError) {
    console.error('Profile creation error:', profileError);
  }

  return {
    data: {
      id: authData.user.id,
      email: authData.user.email!,
      full_name: fullName,
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    error: null,
  };
}

export async function signIn(
  email: string,
  password: string
): Promise<ApiResponse<User>> {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
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
}

export async function signOut(): Promise<ApiResponse<null>> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { data: null, error: error.message };
  }
  return { data: null, error: null };
}

export async function resetPassword(email: string): Promise<ApiResponse<null>> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'inspectionpro://reset-password',
  });

  if (error) {
    return { data: null, error: error.message };
  }
  return { data: null, error: null };
}

export async function getCurrentUser(): Promise<ApiResponse<User>> {
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

  // Process any pending invitations on every login
  try {
    console.log('Processing pending invitations for:', authUser.email);
    const { data: inviteCount, error: inviteError } = await supabase.rpc('process_pending_invitations', {
      p_user_id: authUser.id,
      p_email: authUser.email,
    });
    console.log('Invitations processed:', inviteCount, 'Error:', inviteError);
  } catch (e) {
    console.log('Error processing invitations:', e);
  }

  return { data: userProfile, error: null };
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
    const redirectUrl = makeRedirectUri({
      scheme: 'inspectionpro',
      path: 'auth/callback',
    });

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
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');

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

      return { data: null, error: 'Authentication cancelled' };
    }

    return { data: null, error: 'Failed to initiate OAuth' };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}

export async function signInWithApple(): Promise<ApiResponse<User>> {
  try {
    const redirectUrl = makeRedirectUri({
      scheme: 'inspectionpro',
      path: 'auth/callback',
    });

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
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');

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

      return { data: null, error: 'Authentication cancelled' };
    }

    return { data: null, error: 'Failed to initiate OAuth' };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}
