import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as companyService from '../services/company.service';
import { useAuth } from './AuthContext';
import type { Company, CompanyMember, MemberRole } from '../types';

const SELECTED_COMPANY_KEY = 'selected_company_id';

interface CompanyContextValue {
  companies: Company[];
  currentCompany: Company | null;
  membership: CompanyMember | null;
  members: CompanyMember[];
  isLoading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  selectCompany: (company: Company) => Promise<void>;
  createCompany: (name: string) => Promise<{ error: string | null }>;
  updateCompany: (updates: Partial<Company>) => Promise<{ error: string | null }>;
  refreshCompanies: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  inviteMember: (email: string, role: MemberRole) => Promise<{ error: string | null }>;
  updateMemberRole: (memberId: string, role: MemberRole) => Promise<{ error: string | null }>;
  removeMember: (memberId: string) => Promise<{ error: string | null }>;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [membership, setMembership] = useState<CompanyMember | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
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

  // Load membership and members when company changes
  useEffect(() => {
    if (currentCompany && user) {
      loadMembership();
      loadMembers();
    } else {
      setMembership(null);
      setMembers([]);
    }
  }, [currentCompany, user]);

  async function loadCompanies() {
    if (!user) return;

    setIsLoading(true);
    const { data } = await companyService.getUserCompanies(user.id);
    setCompanies(data || []);

    // Try to restore previously selected company
    const savedCompanyId = await AsyncStorage.getItem(SELECTED_COMPANY_KEY);
    if (savedCompanyId && data) {
      const savedCompany = data.find((c) => c.id === savedCompanyId);
      if (savedCompany) {
        setCurrentCompany(savedCompany);
      } else if (data.length > 0) {
        setCurrentCompany(data[0]);
      }
    } else if (data && data.length > 0) {
      setCurrentCompany(data[0]);
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
        selectCompany,
        createCompany,
        updateCompany,
        refreshCompanies,
        refreshMembers,
        inviteMember,
        updateMemberRole,
        removeMember,
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
