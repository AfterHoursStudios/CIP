import { supabase } from '../lib/supabase';
import type { ApiResponse, ItemType, SelectionOption } from '../types';

export interface ChecklistItem {
  name: string;
  item_type?: ItemType; // defaults to 'status' if not specified
  description?: string;
  options?: SelectionOption[]; // For 'selection' type only
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
  const items: { category: string; name: string; item_type?: ItemType; description?: string; options?: SelectionOption[] }[] = [];

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
          options: item.options,
        });
      }
    });
  });

  return items;
}

// Get custom templates created by a company
export async function getCompanyCustomTemplates(companyId: string): Promise<ApiResponse<ChecklistTemplate[]>> {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_system', false)
    .order('name');

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// Create a custom template for a company
export async function createCustomTemplate(
  companyId: string,
  template: {
    name: string;
    description?: string;
    industry?: string;
    categories: ChecklistCategory[];
  }
): Promise<ApiResponse<ChecklistTemplate>> {
  const { data, error } = await supabase
    .from('checklist_templates')
    .insert({
      name: template.name,
      description: template.description || null,
      industry: template.industry || 'custom',
      categories: template.categories,
      is_system: false,
      company_id: companyId,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  // Auto-enable the template for the company
  await enableTemplate(companyId, data.id, false);

  return { data, error: null };
}

// Update a custom template
export async function updateCustomTemplate(
  templateId: string,
  companyId: string,
  updates: {
    name?: string;
    description?: string;
    industry?: string;
    categories?: ChecklistCategory[];
  }
): Promise<ApiResponse<ChecklistTemplate>> {
  const { data, error } = await supabase
    .from('checklist_templates')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .eq('company_id', companyId) // Ensure company owns this template
    .eq('is_system', false) // Can't edit system templates
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// Delete a custom template
export async function deleteCustomTemplate(
  templateId: string,
  companyId: string
): Promise<ApiResponse<null>> {
  // First remove from company_checklist_templates
  await supabase
    .from('company_checklist_templates')
    .delete()
    .eq('template_id', templateId);

  // Then delete the template itself
  const { error } = await supabase
    .from('checklist_templates')
    .delete()
    .eq('id', templateId)
    .eq('company_id', companyId) // Ensure company owns this template
    .eq('is_system', false); // Can't delete system templates

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: null, error: null };
}

// Clone a template (system or custom) to create a new custom template
export async function cloneTemplate(
  templateId: string,
  companyId: string,
  newName: string
): Promise<ApiResponse<ChecklistTemplate>> {
  // Get the source template
  const { data: sourceTemplate, error: fetchError } = await supabase
    .from('checklist_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (fetchError || !sourceTemplate) {
    return { data: null, error: fetchError?.message || 'Template not found' };
  }

  // Create a copy
  return createCustomTemplate(companyId, {
    name: newName,
    description: sourceTemplate.description,
    industry: sourceTemplate.industry,
    categories: sourceTemplate.categories,
  });
}
