import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import type { ApiResponse } from '../types';

export type SubscriptionPlan = 'none' | 'basic' | 'plus' | 'pro';
export type SubscriptionStatus = 'active' | 'inactive' | 'past_due' | 'canceled' | 'trialing' | 'unpaid';
export type BillingInterval = 'monthly' | 'yearly';

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface PlanDetails {
  name: string;
  price: number | null;
  yearlyPrice: number | null;
  employeeLimit: number;
  memberRange: string;
  features: string[];
  contactSupport?: boolean;
}

export const PLAN_DETAILS: Record<SubscriptionPlan, PlanDetails> = {
  none: {
    name: 'No Plan',
    price: null,
    yearlyPrice: null,
    employeeLimit: 1,
    memberRange: 'Owner only',
    features: ['Limited access', 'Upgrade required to invite team members'],
  },
  basic: {
    name: 'Basic',
    price: 79,
    yearlyPrice: 854,
    employeeLimit: 1,
    memberRange: '1 employee',
    features: [
      '1 team member',
      'Unlimited inspections',
      'PDF report generation',
      'Email reports to owner',
      'HouseCall Pro integration',
    ],
  },
  plus: {
    name: 'Plus',
    price: 99,
    yearlyPrice: 1069,
    employeeLimit: 9,
    memberRange: '2-9 employees',
    features: [
      'Up to 9 team members',
      'Everything in Basic',
      'Team management',
      'Priority support',
    ],
  },
  pro: {
    name: 'Pro',
    price: 119,
    yearlyPrice: 1285,
    employeeLimit: 20,
    memberRange: '10-20 employees',
    features: [
      'Up to 20 team members',
      'Everything in Plus',
      'Advanced reporting',
      'Dedicated support',
    ],
  },
};

export const ENTERPRISE_INFO = {
  name: 'Enterprise',
  memberRange: '20+ employees',
  features: [
    'Unlimited team members',
    'Everything in Pro',
    'Custom integrations',
    'Dedicated account manager',
  ],
  contactSupport: true,
};

export async function getSubscriptionInfo(companyId: string): Promise<ApiResponse<SubscriptionInfo>> {
  const { data, error } = await supabase
    .from('companies')
    .select('subscription_plan, subscription_status, subscription_current_period_end, stripe_customer_id, stripe_subscription_id')
    .eq('id', companyId)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return {
    data: {
      plan: (data.subscription_plan || 'none') as SubscriptionPlan,
      status: (data.subscription_status || 'inactive') as SubscriptionStatus,
      currentPeriodEnd: data.subscription_current_period_end,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
    },
    error: null,
  };
}

export async function createCheckoutSession(
  companyId: string,
  plan: 'basic' | 'plus' | 'pro',
  interval: BillingInterval = 'monthly'
): Promise<ApiResponse<{ sessionId: string; url: string }>> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return { data: null, error: 'Not authenticated' };
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            companyId,
            plan,
            interval,
            successUrl: `${origin}/(tabs)/profile?subscription=success`,
            cancelUrl: `${origin}/(tabs)/profile?subscription=canceled`,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const result = await response.json();

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to create checkout session' };
      }

      return { data: result, error: null };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return { data: null, error: 'Request timed out. Please try again.' };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('createCheckoutSession error:', error);
    return { data: null, error: (error as Error).message };
  }
}

export async function createPortalSession(companyId: string): Promise<ApiResponse<{ url: string }>> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return { data: null, error: 'Not authenticated' };
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-portal-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            companyId,
            returnUrl: `${origin}/(tabs)/profile`,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const result = await response.json();

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to create portal session' };
      }

      return { data: result, error: null };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return { data: null, error: 'Request timed out. Please try again.' };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('createPortalSession error:', error);
    return { data: null, error: (error as Error).message };
  }
}

export async function canAddEmployee(companyId: string): Promise<ApiResponse<{
  allowed: boolean;
  reason?: string;
  currentCount: number;
  limit: number;
  plan: string;
  nextPlan?: string;
}>> {
  const { data, error } = await supabase.rpc('can_add_employee', {
    p_company_id: companyId,
  });

  if (error) {
    return { data: null, error: error.message };
  }

  return {
    data: {
      allowed: data.allowed,
      reason: data.reason,
      currentCount: data.current_count,
      limit: data.limit,
      plan: data.plan,
      nextPlan: data.next_plan,
    },
    error: null,
  };
}

export function getRequiredPlanForEmployeeCount(count: number): SubscriptionPlan {
  if (count <= 1) return 'basic';
  if (count <= 9) return 'plus';
  if (count <= 20) return 'pro';
  return 'pro'; // Enterprise needed - contact support
}

export function getPlanDisplayName(plan: SubscriptionPlan): string {
  return PLAN_DETAILS[plan]?.name || 'Unknown';
}

export function formatStatus(status: SubscriptionStatus): {
  label: string;
  color: string;
  bgColor: string;
} {
  const statusMap: Record<SubscriptionStatus, { label: string; color: string; bgColor: string }> = {
    active: { label: 'Active', color: '#2E7D32', bgColor: '#E8F5E9' },
    inactive: { label: 'Inactive', color: '#757575', bgColor: '#F5F5F5' },
    past_due: { label: 'Past Due', color: '#C62828', bgColor: '#FFEBEE' },
    canceled: { label: 'Canceled', color: '#757575', bgColor: '#F5F5F5' },
    trialing: { label: 'Trial', color: '#1565C0', bgColor: '#E3F2FD' },
    unpaid: { label: 'Unpaid', color: '#C62828', bgColor: '#FFEBEE' },
  };

  return statusMap[status] || { label: status, color: '#757575', bgColor: '#F5F5F5' };
}

export function isSubscriptionActive(status: SubscriptionStatus | null): boolean {
  if (!status) return false;
  return ['active', 'trialing'].includes(status);
}
