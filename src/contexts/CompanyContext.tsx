import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as companyService from '../services/company.service';
import * as subscriptionService from '../services/subscription.service';
import { useAuth } from './AuthContext';
import type { Company, CompanyMember, MemberRole } from '../types';
import type { SubscriptionInfo, SubscriptionPlan, BillingInterval } from '../services/subscription.service';

const SELECTED_COMPANY_KEY = 'selected_company_id';

export interface EmployeeLimitInfo {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  limit: number;
  plan: string;
  nextPlan?: string;
}

interface CompanyContextValue {
  companies: Company[];
  currentCompany: Company | null;
  membership: CompanyMember | null;
  members: CompanyMember[];
  isLoading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  subscription: SubscriptionInfo | null;
  selectCompany: (company: Company) => Promise<void>;
  createCompany: (name: string) => Promise<{ error: string | null }>;
  updateCompany: (updates: Partial<Company>) => Promise<{ error: string | null }>;
  refreshCompanies: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  inviteMember: (email: string, role: MemberRole) => Promise<{ error: string | null }>;
  updateMemberRole: (memberId: string, role: MemberRole) => Promise<{ error: string | null }>;
  removeMember: (memberId: string) => Promise<{ error: string | null }>;
  checkCanAddEmployee: () => Promise<EmployeeLimitInfo | null>;
  createCheckoutSession: (plan: 'basic' | 'plus' | 'pro', interval?: BillingInterval) => Promise<{ url: string | null; error: string | null }>;
  createPortalSession: () => Promise<{ url: string | null; error: string | null }>;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [membership, setMembership] = useState<CompanyMember | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isOwner = membership?.role === 'owner';
  const isAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  // Load companies when user changes
  useEffect(() => {
    if (isAuthenticated && user) {
      loadCompanies();
    } else {
      setCompanies([]);
      setCurrentCompany(null);
      setMembership(null);
      setMembers([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // Load membership, members, and subscription when company changes
  useEffect(() => {
    if (currentCompany && user) {
      loadMembership();
      loadMembers();
      // Set subscription from company data immediately (avoids timing issues)
      if (currentCompany.subscription_plan || currentCompany.subscription_status) {
        setSubscription({
          plan: (currentCompany.subscription_plan || 'none') as any,
          status: (currentCompany.subscription_status || 'inactive') as any,
          currentPeriodEnd: currentCompany.subscription_current_period_end || null,
          stripeCustomerId: currentCompany.stripe_customer_id || null,
          stripeSubscriptionId: currentCompany.stripe_subscription_id || null,
        });
      } else {
        // Fallback to separate query if not in company data
        loadSubscription();
      }
    } else {
      setMembership(null);
      setMembers([]);
      setSubscription(null);
    }
  }, [currentCompany, user]);

  async function loadCompanies() {
    if (!user) return;

    setIsLoading(true);
    const { data, error } = await companyService.getUserCompanies(user.id);

    if (error) {
      console.error('Error loading companies:', error);
    }

    setCompanies(data || []);

    // Try to restore previously selected company
    const savedCompanyId = await AsyncStorage.getItem(SELECTED_COMPANY_KEY);
    let selectedCompany: Company | null = null;

    if (savedCompanyId && data) {
      selectedCompany = data.find((c) => c.id === savedCompanyId) || null;
      if (!selectedCompany && data.length > 0) {
        selectedCompany = data[0];
      }
    } else if (data && data.length > 0) {
      selectedCompany = data[0];
    }

    if (selectedCompany) {
      setCurrentCompany(selectedCompany);
      // Set subscription from company data immediately
      if (selectedCompany.subscription_plan || selectedCompany.subscription_status) {
        setSubscription({
          plan: (selectedCompany.subscription_plan || 'none') as any,
          status: (selectedCompany.subscription_status || 'inactive') as any,
          currentPeriodEnd: selectedCompany.subscription_current_period_end || null,
          stripeCustomerId: selectedCompany.stripe_customer_id || null,
          stripeSubscriptionId: selectedCompany.stripe_subscription_id || null,
        });
      }
    }

    setIsLoading(false);
  }

  async function loadMembership() {
    if (!currentCompany || !user) return;

    const { data } = await companyService.getUserMembership(currentCompany.id, user.id);
    setMembership(data);
  }

  async function loadMembers() {
    if (!currentCompany) return;

    const { data } = await companyService.getCompanyMembers(currentCompany.id);
    setMembers(data || []);
  }

  async function loadSubscription(retryCount = 0) {
    if (!currentCompany) return;

    const { data, error } = await subscriptionService.getSubscriptionInfo(currentCompany.id);

    if (error) {
      console.error('Error loading subscription:', error);
      // Retry up to 3 times with a delay (session might not be ready yet)
      if (retryCount < 3) {
        console.log(`Retrying subscription load (attempt ${retryCount + 2})...`);
        setTimeout(() => loadSubscription(retryCount + 1), 1000);
        return;
      }
    }

    setSubscription(data);
  }

  const selectCompany = useCallback(async (company: Company) => {
    setCurrentCompany(company);
    await AsyncStorage.setItem(SELECTED_COMPANY_KEY, company.id);
  }, []);

  const createCompany = useCallback(async (name: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { data, error } = await companyService.createCompany(name, user.id);
    if (data) {
      setCompanies((prev) => [...prev, data]);
      await selectCompany(data);
    }
    return { error };
  }, [user, selectCompany]);

  const updateCompany = useCallback(async (updates: Partial<Company>) => {
    if (!currentCompany) return { error: 'No company selected' };

    const { data, error } = await companyService.updateCompany(currentCompany.id, updates);
    if (data) {
      setCurrentCompany(data);
      setCompanies((prev) =>
        prev.map((c) => (c.id === data.id ? data : c))
      );
    }
    return { error };
  }, [currentCompany]);

  const refreshCompanies = useCallback(async () => {
    await loadCompanies();
  }, [user]);

  const refreshMembers = useCallback(async () => {
    await loadMembers();
  }, [currentCompany]);

  const refreshSubscription = useCallback(async () => {
    if (!currentCompany) return;

    // Fetch fresh company data to get updated subscription info
    const { data: freshCompany, error } = await companyService.getCompanyById(currentCompany.id);

    if (freshCompany) {
      // Update the company with fresh data
      setCurrentCompany(freshCompany);
      setCompanies((prev) =>
        prev.map((c) => (c.id === freshCompany.id ? freshCompany : c))
      );

      // Update subscription from fresh company data
      setSubscription({
        plan: (freshCompany.subscription_plan || 'none') as any,
        status: (freshCompany.subscription_status || 'inactive') as any,
        currentPeriodEnd: freshCompany.subscription_current_period_end || null,
        stripeCustomerId: freshCompany.stripe_customer_id || null,
        stripeSubscriptionId: freshCompany.stripe_subscription_id || null,
      });
    } else if (error) {
      console.error('Error refreshing subscription:', error);
      // Fallback to separate subscription query
      await loadSubscription();
    }
  }, [currentCompany]);

  const checkCanAddEmployee = useCallback(async (): Promise<EmployeeLimitInfo | null> => {
    if (!currentCompany) return null;

    const { data, error } = await subscriptionService.canAddEmployee(currentCompany.id);
    if (error || !data) return null;

    return data;
  }, [currentCompany]);

  const createCheckoutSession = useCallback(async (plan: 'basic' | 'plus' | 'pro', interval: BillingInterval = 'monthly') => {
    if (!currentCompany) return { url: null, error: 'No company selected' };

    const { data, error } = await subscriptionService.createCheckoutSession(currentCompany.id, plan, interval);
    return { url: data?.url || null, error };
  }, [currentCompany]);

  const createPortalSession = useCallback(async () => {
    if (!currentCompany) return { url: null, error: 'No company selected' };

    const { data, error } = await subscriptionService.createPortalSession(currentCompany.id);
    return { url: data?.url || null, error };
  }, [currentCompany]);

  const inviteMember = useCallback(async (email: string, role: MemberRole) => {
    if (!currentCompany) return { error: 'No company selected' };
    if (!user) return { error: 'Not authenticated' };

    const { error } = await companyService.inviteMember(
      currentCompany.id,
      email,
      role,
      user.id,
      currentCompany.name,
      user.full_name || user.email
    );
    if (!error) {
      await loadMembers();
    }
    return { error };
  }, [currentCompany, user]);

  const updateMemberRole = useCallback(async (memberId: string, role: MemberRole) => {
    const { error } = await companyService.updateMemberRole(memberId, role);
    if (!error) {
      await loadMembers();
    }
    return { error };
  }, []);

  const removeMember = useCallback(async (memberId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await companyService.removeMember(memberId, user.id);
    if (!error) {
      await loadMembers();
    }
    return { error };
  }, [user]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        currentCompany,
        membership,
        members,
        isLoading,
        isOwner,
        isAdmin,
        subscription,
        selectCompany,
        createCompany,
        updateCompany,
        refreshCompanies,
        refreshMembers,
        refreshSubscription,
        inviteMember,
        updateMemberRole,
        removeMember,
        checkCanAddEmployee,
        createCheckoutSession,
        createPortalSession,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return context;
}
