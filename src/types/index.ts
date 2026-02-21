// User types
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Company types
export interface Company {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type MemberRole = 'owner' | 'admin' | 'inspector';

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: MemberRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user?: User;
}

// Inspection types
export type InspectionStatus = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Inspection {
  id: string;
  company_id: string;
  inspector_id: string;
  project_name: string;
  project_address: string | null;
  client_name: string | null;
  client_email: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  status: InspectionStatus;
  notes: string | null;
  completion_percentage: number;
  created_at: string;
  updated_at: string;
  inspector?: User;
  items?: InspectionItem[];
  // Housecall Pro integration
  hcp_job_id: string | null;
  hcp_job_number: string | null;
  hcp_assigned_employee: string | null;
  hcp_synced_at: string | null;
}

export type ItemStatus = 'pending' | 'satisfactory' | 'recommended' | 'unsafe' | 'na';

export type ItemType = 'status' | 'measurement';

export interface MeasurementValue {
  feet: number;
  inches: number;
}

export interface InspectionItem {
  id: string;
  inspection_id: string;
  category: string;
  name: string;
  description: string | null;
  status: ItemStatus;
  item_type: ItemType;
  value: MeasurementValue | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  photos?: InspectionPhoto[];
}

export interface InspectionPhoto {
  id: string;
  item_id: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
}

// Subscription types
export type SubscriptionTier = 'basic' | 'plus' | 'pro' | 'enterprise';
export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'unpaid';

export interface CompanySubscription {
  id: string;
  company_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  current_member_count: number;
  created_at: string;
  updated_at: string;
}

// API response type
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
