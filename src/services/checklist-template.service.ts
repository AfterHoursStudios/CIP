import { supabase } from '../lib/supabase';
import type { ApiResponse, ItemType } from '../types';

export interface ChecklistItem {
  name: string;
  item_type?: ItemType; // defaults to 'status' if not specified
  description?: string;
}

export interface ChecklistCategory {
  name: string;
  items: (string | ChecklistItem)[]; // Support both simple strings and full objects
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  categories: ChecklistCategory[];
  is_system: boolean;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyChecklistTemplate {
  id: string;
  company_id: string;
  template_id: string;
  is_default: boolean;
  created_at: string;
  template?: ChecklistTemplate;
}

// Get all system templates
export async function getSystemTemplates(): Promise<ApiResponse<ChecklistTemplate[]>> {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('*')
    .eq('is_system', true)
    .order('name');

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// Get templates enabled for a company
export async function getCompanyTemplates(companyId: string): Promise<ApiResponse<CompanyChecklistTemplate[]>> {
  const { data, error } = await supabase
    .from('company_checklist_templates')
    .select('*, template:checklist_templates(*)')
    .eq('company_id', companyId)
    .order('created_at');

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// Get only the templates available for employees to use (enabled by company)
export async function getAvailableTemplates(companyId: string): Promise<ApiResponse<ChecklistTemplate[]>> {
  const { data, error } = await supabase
    .from('company_checklist_templates')
    .select('template:checklist_templates(*)')
    .eq('company_id', companyId);

  if (error) {
    return { data: null, error: error.message };
  }

  // Extract templates from the join result
  const templates = data
    ?.map((item: any) => item.template)
    .filter(Boolean) as ChecklistTemplate[];

  return { data: templates || [], error: null };
}

// Get default template for a company
export async function getDefaultTemplate(companyId: string): Promise<ApiResponse<ChecklistTemplate | null>> {
  const { data, error } = await supabase
    .from('company_checklist_templates')
    .select('template:checklist_templates(*)')
    .eq('company_id', companyId)
    .eq('is_default', true)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    return { data: null, error: error.message };
  }

  return { data: (data as any)?.template || null, error: null };
}

// Enable a template for a company
export async function enableTemplate(
  companyId: string,
  templateId: string,
  isDefault: boolean = false
): Promise<ApiResponse<CompanyChecklistTemplate>> {
  // If setting as default, first unset any existing default
  if (isDefault) {
    await supabase
      .from('company_checklist_templates')
      .update({ is_default: false })
      .eq('company_id', companyId);
  }

  const { data, error } = await supabase
    .from('company_checklist_templates')
    .upsert({
      company_id: companyId,
      template_id: templateId,
      is_default: isDefault,
    }, {
      onConflict: 'company_id,template_id',
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// Disable a template for a company
export async function disableTemplate(
  companyId: string,
  templateId: string
): Promise<ApiResponse<null>> {
  const { error } = await supabase
    .from('company_checklist_templates')
    .delete()
    .eq('company_id', companyId)
    .eq('template_id', templateId);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: null, error: null };
}

// Set a template as the default for a company
export async function setDefaultTemplate(
  companyId: string,
  templateId: string
): Promise<ApiResponse<null>> {
  // First unset all defaults
  await supabase
    .from('company_checklist_templates')
    .update({ is_default: false })
    .eq('company_id', companyId);

  // Set the new default
  const { error } = await supabase
    .from('company_checklist_templates')
    .update({ is_default: true })
    .eq('company_id', companyId)
    .eq('template_id', templateId);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: null, error: null };
}

// Helper to flatten template categories into items array
export function flattenTemplateCategories(categories: ChecklistCategory[]) {
  const items: { category: string; name: string; item_type?: ItemType; description?: string }[] = [];

  categories.forEach((category) => {
    category.items.forEach((item) => {
      if (typeof item === 'string') {
        items.push({
          category: category.name,
          name: item,
          item_type: 'status',
        });
      } else {
        items.push({
          category: category.name,
          name: item.name,
          item_type: item.item_type || 'status',
          description: item.description,
        });
      }
    });
  });

  return items;
}
