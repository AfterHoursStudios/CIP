import { supabase } from '../lib/supabase';
import type {
  CompanySubscription,
  SubscriptionTier,
  SubscriptionStatus,
  ApiResponse,
} from '../types';

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  price: number | null;
  memberRange: string;
  minMembers: number;
  maxMembers: number | null;
  features: string[];
  contactSupport?: boolean;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  basic: {
    tier: 'basic',
    name: 'Basic',
    price: 79,
    memberRange: '1 login',
    minMembers: 1,
    maxMembers: 1,
    features: [
      '1 team member',
      'Unlimited inspections',
      'PDF report generation',
      'Email reports to clients',
      'Offline support',
    ],
  },
  plus: {
    tier: 'plus',
    name: 'Plus',
    price: 99,
    memberRange: '2-9 logins',
    minMembers: 2,
    maxMembers: 9,
    features: [
      'Up to 9 team members',
      'Unlimited inspections',
      'PDF report generation',
      'Email reports to clients',
      'Offline support',
    ],
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    price: 119,
    memberRange: '10-19 logins',
    minMembers: 10,
    maxMembers: 19,
    features: [
      'Up to 19 team members',
      'Unlimited inspections',
      'PDF report generation',
      'Email reports to clients',
      'Offline support',
      'Priority support',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    price: null,
    memberRange: '20+ logins',
    minMembers: 20,
    maxMembers: null,
    contactSupport: true,
    features: [
      'Unlimited team members',
      'Unlimited inspections',
      'PDF report generation',
      'Email reports to clients',
      'Offline support',
      'Priority support',
      'Custom integrations',
      'Dedicated account manager',
    ],
  },
};

export async function getCompanySubscription(
  companyId: string
): Promise<ApiResponse<CompanySubscription>> {
  const { data, error } = await supabase
    .from('company_subscriptions')
    .select('*')
    .eq('company_id', companyId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { data: null, error: null };
    }
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function hasActiveSubscription(companyId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('company_has_active_subscription', {
    p_company_id: companyId,
  });

  if (error) {
    console.error('Error checking subscription:', error);
    return false;
  }

  return data === true;
}

export async function createCheckoutSession(
  companyId: string,
  successUrl: string,
  cancelUrl: string,
  tier?: SubscriptionTier
): Promise<ApiResponse<{ checkoutUrl: string; sessionId: string }>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { data: null, error: 'Supabase configuration missing' };
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/stripe-create-checkout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ companyId, successUrl, cancelUrl, tier }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: data.error || `Request failed with status ${response.status}`,
      };
    }

    return {
      data: {
        checkoutUrl: data.checkoutUrl,
        sessionId: data.sessionId,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}

export async function createPortalSession(
  companyId: string,
  returnUrl: string
): Promise<ApiResponse<{ portalUrl: string }>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { data: null, error: 'Supabase configuration missing' };
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/stripe-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ companyId, returnUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: data.error || `Request failed with status ${response.status}`,
      };
    }

    return { data: { portalUrl: data.portalUrl }, error: null };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}

export function getPlanForTier(tier: SubscriptionTier): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[tier];
}

export function getTierForMemberCount(count: number): SubscriptionTier {
  if (count >= 20) return 'enterprise';
  if (count >= 10) return 'pro';
  if (count >= 2) return 'plus';
  return 'basic';
}

export function formatStatus(status: SubscriptionStatus): {
  label: string;
  color: string;
  bgColor: string;
} {
  const statusMap: Record<
    SubscriptionStatus,
    { label: string; color: string; bgColor: string }
  > = {
    active: { label: 'Active', color: '#2E7D32', bgColor: '#E8F5E9' },
    past_due: { label: 'Past Due', color: '#C62828', bgColor: '#FFEBEE' },
    canceled: { label: 'Canceled', color: '#757575', bgColor: '#F5F5F5' },
    incomplete: { label: 'Incomplete', color: '#F57C00', bgColor: '#FFF3E0' },
    incomplete_expired: { label: 'Expired', color: '#757575', bgColor: '#F5F5F5' },
    trialing: { label: 'Trial', color: '#1565C0', bgColor: '#E3F2FD' },
    unpaid: { label: 'Unpaid', color: '#C62828', bgColor: '#FFEBEE' },
  };

  return statusMap[status] || { label: status, color: '#757575', bgColor: '#F5F5F5' };
}

export function canAccessFeatures(status: SubscriptionStatus | null): boolean {
  if (!status) return false;
  return ['active', 'trialing', 'past_due'].includes(status);
}
