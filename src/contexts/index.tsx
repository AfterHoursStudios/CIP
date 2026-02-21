import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { CompanyProvider, useCompany } from './CompanyContext';

export { useAuth, useCompany };

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CompanyProvider>
        {children}
      </CompanyProvider>
    </AuthProvider>
  );
}
