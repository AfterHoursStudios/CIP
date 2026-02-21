import { supabase } from '../lib/supabase';
import type {
  Inspection,
  InspectionItem,
  InspectionPhoto,
  InspectionStatus,
  ItemStatus,
  ApiResponse,
} from '../types';

export async function createInspection(
  companyId: string,
  inspectorId: string,
  data: {
    project_name: string;
    project_address?: string;
    client_name?: string;
    client_email?: string;
    scheduled_date?: string;
    hcp_job_id?: string;
    hcp_job_number?: string;
    hcp_assigned_employee?: string;
  }
): Promise<ApiResponse<Inspection>> {
  const { data: inspection, error } = await supabase
    .from('inspections')
    .insert({
      company_id: companyId,
      inspector_id: inspectorId,
      ...data,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: inspection, error: null };
}

// Check if HCP job already imported
export async function getInspectionByHcpJobId(
  hcpJobId: string
): Promise<ApiResponse<Inspection | null>> {
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('hcp_job_id', hcpJobId)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// Update HCP sync status
export async function updateHcpSyncStatus(
  inspectionId: string
): Promise<ApiResponse<Inspection>> {
  const { data, error } = await supabase
    .from('inspections')
    .update({ hcp_synced_at: new Date().toISOString() })
    .eq('id', inspectionId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function getCompanyInspections(
  companyId: string,
  options?: {
    status?: InspectionStatus;
    inspectorId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ApiResponse<Inspection[]>> {
  let query = supabase
    .from('inspections')
    .select('*, inspector:users(*)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.inspectorId) {
    query = query.eq('inspector_id', options.inspectorId);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function getInspectionById(
  inspectionId: string
): Promise<ApiResponse<Inspection>> {
  const { data, error } = await supabase
    .from('inspections')
    .select('*, inspector:users(*), items:inspection_items(*, photos:inspection_photos(*))')
    .eq('id', inspectionId)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function updateInspection(
  inspectionId: string,
  updates: Partial<Inspection>
): Promise<ApiResponse<Inspection>> {
  const { data, error } = await supabase
    .from('inspections')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', inspectionId)
    .select();

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data || data.length === 0) {
    return { data: null, error: 'Inspection not found or access denied' };
  }

  return { data: data[0], error: null };
}

export async function updateInspectionStatus(
  inspectionId: string,
  status: InspectionStatus
): Promise<ApiResponse<Inspection>> {
  const updates: Partial<Inspection> = { status };

  if (status === 'completed') {
    updates.completed_date = new Date().toISOString();
  }

  return updateInspection(inspectionId, updates);
}

export async function deleteInspection(inspectionId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase.from('inspections').delete().eq('id', inspectionId);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: null, error: null };
}

// Inspection Items
export async function addInspectionItem(
  inspectionId: string,
  item: {
    category: string;
    name: string;
    status?: ItemStatus;
    notes?: string;
  }
): Promise<ApiResponse<InspectionItem>> {
  // Get max sort order
  const { data: existing } = await supabase
    .from('inspection_items')
    .select('sort_order')
    .eq('inspection_id', inspectionId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const sortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('inspection_items')
    .insert({
      inspection_id: inspectionId,
      ...item,
      status: item.status || 'pending',
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function updateInspectionItem(
  itemId: string,
  updates: Partial<InspectionItem>
): Promise<ApiResponse<InspectionItem>> {
  const { data, error } = await supabase
    .from('inspection_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select();

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data || data.length === 0) {
    return { data: null, error: 'Item not found or access denied' };
  }

  return { data: data[0], error: null };
}

export async function deleteInspectionItem(itemId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase.from('inspection_items').delete().eq('id', itemId);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: null, error: null };
}

export async function updateItemStatus(
  itemId: string,
  status: ItemStatus
): Promise<ApiResponse<InspectionItem>> {
  return updateInspectionItem(itemId, { status });
}

export async function updateItemMeasurement(
  itemId: string,
  value: { feet: number; inches: number }
): Promise<ApiResponse<InspectionItem>> {
  // When a measurement is set, mark status as satisfactory (completed)
  return updateInspectionItem(itemId, {
    value: value as any,
    status: 'satisfactory'
  });
}

export async function bulkAddInspectionItems(
  inspectionId: string,
  items: { category: string; name: string; item_type?: string; description?: string }[]
): Promise<ApiResponse<InspectionItem[]>> {
  const itemsToInsert = items.map((item, index) => ({
    inspection_id: inspectionId,
    category: item.category,
    name: item.name,
    item_type: item.item_type || 'status',
    description: item.description || null,
    status: 'pending' as ItemStatus,
    sort_order: index,
  }));

  const { data, error } = await supabase
    .from('inspection_items')
    .insert(itemsToInsert)
    .select();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// Photos
export async function addItemPhoto(
  itemId: string,
  photoUrl: string,
  caption?: string
): Promise<ApiResponse<InspectionPhoto>> {
  const { data, error } = await supabase
    .from('inspection_photos')
    .insert({
      item_id: itemId,
      photo_url: photoUrl,
      caption,
    })
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function deleteItemPhoto(photoId: string): Promise<ApiResponse<null>> {
  const { error } = await supabase.from('inspection_photos').delete().eq('id', photoId);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: null, error: null };
}

export async function uploadPhoto(
  companyId: string,
  inspectionId: string,
  uri: string
): Promise<ApiResponse<string>> {
  try {
    const fileName = `${companyId}/${inspectionId}/${Date.now()}.jpg`;

    // Fetch the image
    const response = await fetch(uri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('inspection-photos')
      .upload(fileName, blob, { contentType: 'image/jpeg' });

    if (error) {
      return { data: null, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from('inspection-photos')
      .getPublicUrl(fileName);

    return { data: urlData.publicUrl, error: null };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}
