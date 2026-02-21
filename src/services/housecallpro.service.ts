import { Platform } from 'react-native';
import type { ApiResponse } from '../types';
import { supabase, supabaseUrl } from '../lib/supabase';

const HCP_API_BASE = 'https://api.housecallpro.com';
const HCP_PROXY_URL = `${supabaseUrl}/functions/v1/hcp-proxy`;

// Housecall Pro Types
export interface HCPCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile_number: string;
  home_number: string | null;
  work_number: string | null;
  company: string | null;
  notifications_enabled: boolean;
  addresses: HCPAddress[];
}

export interface HCPAddress {
  id: string;
  type: string;
  street: string;
  street_line_2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface HCPJob {
  id: string;
  invoice_number: string;
  job_number?: string;
  name?: string;
  description: string | null;
  work_status: 'scheduled' | 'in_progress' | 'complete' | 'canceled' | 'unscheduled';
  invoice_status: string;
  customer: HCPCustomer;
  address: HCPAddress;
  schedule: {
    scheduled_start: string;
    scheduled_end: string;
  } | null;
  assigned_employees: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    mobile_number: string;
    role: string;
  }[];
  notes: { id: string; content: string }[];
  total_amount: number;
  outstanding_balance: number;
  created_at: string;
  updated_at: string;
}

export interface HCPJobsResponse {
  jobs: HCPJob[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

interface CompanyIntegration {
  id: string;
  company_id: string;
  integration_type: string;
  api_key: string | null;
  is_active: boolean;
  connected_by: string | null;
  connected_at: string;
}

// API Key Management - Now uses database at company level
export async function saveApiKey(companyId: string, apiKey: string, userId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase
    .from('company_integrations')
    .upsert({
      company_id: companyId,
      integration_type: 'housecall_pro',
      api_key: apiKey,
      is_active: true,
      connected_by: userId,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'company_id,integration_type',
    });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: null, error: null };
}

export async function getApiKey(companyId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('company_integrations')
    .select('api_key')
    .eq('company_id', companyId)
    .eq('integration_type', 'housecall_pro')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data.api_key;
}

export async function removeApiKey(companyId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase
    .from('company_integrations')
    .delete()
    .eq('company_id', companyId)
    .eq('integration_type', 'housecall_pro');

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: null, error: null };
}

export async function isConnected(companyId: string): Promise<boolean> {
  const apiKey = await getApiKey(companyId);
  return !!apiKey;
}

// API Helper
async function hcpFetch<T>(
  companyId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const apiKey = await getApiKey(companyId);

  if (!apiKey) {
    return { data: null, error: 'Housecall Pro API key not configured' };
  }

  try {
    let response: Response;

    if (Platform.OS === 'web') {
      // Use proxy on web to avoid CORS issues
      const proxyUrl = `${HCP_PROXY_URL}?endpoint=${encodeURIComponent(endpoint)}`;
      response = await fetch(proxyUrl, {
        ...options,
        headers: {
          'x-hcp-api-key': apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    } else {
      // Direct API call on mobile
      response = await fetch(`${HCP_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HCP API Error Response:', errorText);
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { raw: errorText };
      }
      return {
        data: null,
        error: errorData.details || errorData.message || errorData.error || errorData.raw || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}

// Test API Connection
export async function testConnection(companyId: string): Promise<ApiResponse<boolean>> {
  const { data, error } = await hcpFetch<{ employees: any[] }>(companyId, '/employees');

  if (error) {
    return { data: false, error };
  }

  return { data: true, error: null };
}

// Get Scheduled Jobs
export async function getScheduledJobs(
  companyId: string,
  page: number = 1,
  pageSize: number = 50
): Promise<ApiResponse<HCPJobsResponse>> {
  const result = await hcpFetch<HCPJobsResponse>(companyId, `/jobs`);

  if (result.error) {
    console.error('HCP Jobs Error:', result.error);
  }

  return result;
}

// Get All Jobs (with filters)
export async function getJobs(
  companyId: string,
  options?: {
    workStatus?: 'scheduled' | 'in_progress' | 'complete' | 'canceled' | 'unscheduled';
    page?: number;
    pageSize?: number;
    scheduledStartMin?: string;
    scheduledStartMax?: string;
  }
): Promise<ApiResponse<HCPJobsResponse>> {
  const params = new URLSearchParams();

  if (options?.page) params.append('page', options.page.toString());
  if (options?.pageSize) params.append('page_size', options.pageSize.toString());
  if (options?.workStatus) params.append('work_status', options.workStatus);
  if (options?.scheduledStartMin) params.append('scheduled_start_min', options.scheduledStartMin);
  if (options?.scheduledStartMax) params.append('scheduled_start_max', options.scheduledStartMax);

  return hcpFetch<HCPJobsResponse>(companyId, `/jobs?${params}`);
}

// Get Single Job by ID
export async function getJobById(companyId: string, jobId: string): Promise<ApiResponse<HCPJob>> {
  return hcpFetch<HCPJob>(companyId, `/jobs/${jobId}`);
}

// Upload File Attachment to Job
export async function uploadJobAttachment(
  companyId: string,
  jobId: string,
  fileUri: string,
  fileName: string,
  mimeType: string = 'application/pdf'
): Promise<ApiResponse<{ id: string }>> {
  console.log('uploadJobAttachment called:', { companyId, jobId, fileName, mimeType });

  const apiKey = await getApiKey(companyId);
  console.log('API key retrieved:', apiKey ? 'yes' : 'no');

  if (!apiKey) {
    return { data: null, error: 'Housecall Pro API key not configured' };
  }

  try {
    console.log('Platform:', Platform.OS);

    if (Platform.OS === 'web') {
      // Web: Fetch file URI as blob
      console.log('Fetching blob from URI...');
      const fileResponse = await fetch(fileUri);
      const blob = await fileResponse.blob();
      console.log('Blob fetched, size:', blob.size);

      // Create fresh FormData for the request
      const formData = new FormData();
      formData.append('file', blob, fileName);
      console.log('FormData created');

      // Use proxy on web to avoid CORS issues
      const proxyUrl = `${HCP_PROXY_URL}?endpoint=${encodeURIComponent(`/jobs/${jobId}/attachments`)}`;
      console.log('Uploading to proxy URL:', proxyUrl);

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'x-hcp-api-key': apiKey,
        },
        body: formData,
      });
      console.log('Fetch completed, status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HCP attachment upload failed:', response.status, errorText);
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { raw: errorText };
        }
        return {
          data: null,
          error: errorData.details || errorData.message || errorData.raw || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      console.log('HCP attachment upload succeeded:', data);
      return { data, error: null };
    } else {
      // Native: Use file URI directly with FormData
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      } as any);

      console.log('Uploading attachment to HCP:', `/jobs/${jobId}/attachments`);

      const response = await fetch(`${HCP_API_BASE}/jobs/${jobId}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });
      console.log('Fetch completed, status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('HCP attachment upload failed:', response.status, errorData);
        return {
          data: null,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      console.log('HCP attachment upload succeeded:', data);
      return { data, error: null };
    }
  } catch (error) {
    console.error('HCP attachment upload error:', error);
    return { data: null, error: (error as Error).message };
  }
}

// Add Note to Job
export async function addJobNote(
  companyId: string,
  jobId: string,
  note: string
): Promise<ApiResponse<{ id: string }>> {
  return hcpFetch<{ id: string }>(companyId, `/jobs/${jobId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

// Update Job Work Status
export async function updateJobStatus(
  companyId: string,
  jobId: string,
  workStatus: 'scheduled' | 'in_progress' | 'complete' | 'canceled'
): Promise<ApiResponse<HCPJob>> {
  return hcpFetch<HCPJob>(companyId, `/jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify({ work_status: workStatus }),
  });
}
