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

// Get scheduled jobs from 7 days ago onwards (up to 200 jobs)
export async function getScheduledJobs(
  companyId: string,
  page: number = 1,
  pageSize: number = 200
): Promise<ApiResponse<HCPJobsResponse>> {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());

  // Start from 7 days ago, no end date limit
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  params.append('work_status', 'scheduled');
  params.append('scheduled_start_min', sevenDaysAgo.toISOString());

  const result = await hcpFetch<HCPJobsResponse>(companyId, `/jobs?${params}`);

  if (result.error) {
    console.error('HCP Jobs Error:', result.error);
  }

  return result;
}

// Get jobs within date range: 7 days ago to 7 days ahead
// Fetches all pages, API handles date filtering
export async function getAllScheduledJobs(
  companyId: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<ApiResponse<HCPJob[]>> {
  const matchingJobs: HCPJob[] = [];
  let currentPage = 1;
  const pageSize = 200;
  const maxPages = 50;

  // Date range: 7 days ago to 7 days ahead
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const sevenDaysAhead = new Date();
  sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);
  sevenDaysAhead.setHours(23, 59, 59, 999);

  console.log(`HCP: Fetching jobs from ${sevenDaysAgo.toISOString()} to ${sevenDaysAhead.toISOString()}`);

  while (currentPage <= maxPages) {
    const params = new URLSearchParams();
    params.append('page', currentPage.toString());
    params.append('page_size', pageSize.toString());
    // API handles date filtering
    params.append('scheduled_start_min', sevenDaysAgo.toISOString());
    params.append('scheduled_start_max', sevenDaysAhead.toISOString());

    const result = await hcpFetch<HCPJobsResponse>(companyId, `/jobs?${params}`);

    if (result.error) {
      console.error('HCP Jobs Error on page', currentPage, ':', result.error);
      if (matchingJobs.length > 0) break;
      return { data: null, error: result.error };
    }

    if (!result.data) break;

    const jobs = result.data.jobs || [];
    if (jobs.length === 0) break;

    // Only filter out completed/canceled jobs - trust API for date filtering
    let skippedCompleted = 0;

    for (const job of jobs) {
      const status = (job.work_status || '').toLowerCase();
      const isCompleted = status === 'complete' || status === 'canceled' ||
                          status === 'cancelled' || status.includes('complete');

      if (isCompleted) {
        skippedCompleted++;
        continue;
      }

      // Include all non-completed jobs from the API response
      matchingJobs.push(job);

      // Log job details for debugging
      console.log(`HCP: Job #${job.invoice_number || job.id} - status: ${job.work_status}, date: ${job.schedule?.scheduled_start || 'none'}`);
    }

    console.log(`HCP: Page ${currentPage}: ${jobs.length} jobs from API, ${skippedCompleted} completed/canceled, ${jobs.length - skippedCompleted} active`);

    if (onProgress) {
      onProgress(matchingJobs.length, result.data.total_items || 0);
    }

    // Stop if we've checked all pages
    if (currentPage >= (result.data.total_pages || 1)) break;

    currentPage++;
  }

  console.log(`HCP: Done. Found ${matchingJobs.length} active jobs in date range.`);

  return { data: matchingJobs, error: null };
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
  const apiKey = await getApiKey(companyId);

  if (!apiKey) {
    return { data: null, error: 'Housecall Pro API key not configured' };
  }

  try {
    if (Platform.OS === 'web') {
      // Web: Fetch file URI as blob
      const fileResponse = await fetch(fileUri);
      const blob = await fileResponse.blob();

      // Create fresh FormData for the request
      const formData = new FormData();
      formData.append('file', blob, fileName);

      // Use proxy on web to avoid CORS issues
      const proxyUrl = `${HCP_PROXY_URL}?endpoint=${encodeURIComponent(`/jobs/${jobId}/attachments`)}`;

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'x-hcp-api-key': apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
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
      return { data, error: null };
    } else {
      // Native: Use file URI directly with FormData
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      } as any);

      const response = await fetch(`${HCP_API_BASE}/jobs/${jobId}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          data: null,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      return { data, error: null };
    }
  } catch (error) {
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
