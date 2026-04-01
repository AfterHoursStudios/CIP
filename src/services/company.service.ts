import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import type { Company, CompanyMember, MemberRole, ApiResponse } from '../types';

async function sendInvitationEmail(
  email: string,
  companyName: string,
  inviterName: string,
  role: string
) {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return;
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-invitation-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email,
          companyName,
          inviterName,
          role,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      // Email send failed silently
    }
  } catch (error) {
    // Failed to send invitation email
  }
}

export async function createCompany(
  name: string,
  userId: string
): Promise<ApiResponse<Company>> {
  // Use database function to create company and add owner atomically
  const { data, error } = await supabase
    .rpc('create_company_with_owner', {
      p_name: name,
      p_user_id: userId,
    });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as Company, error: null };
}

export async function getUserCompanies(userId: string): Promise<ApiResponse<Company[]>> {
  const { data, error } = await supabase
    .from('company_members')
    .select('company:companies(*)')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    return { data: null, error: error.message };
  }

  const companies = data.map((item: any) => item.company).filter(Boolean);
  return { data: companies, error: null };
}

export async function getCompanyById(companyId: string): Promise<ApiResponse<Company>> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function updateCompany(
  companyId: string,
  updates: Partial<Company>
): Promise<ApiResponse<Company>> {
  const { data, error } = await supabase
    .from('companies')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', companyId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function getCompanyMembers(
  companyId: string
): Promise<ApiResponse<CompanyMember[]>> {
  const { data, error } = await supabase
    .from('company_members')
    .select('*, user:users(*)')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function getUserMembership(
  companyId: string,
  userId: string
): Promise<ApiResponse<CompanyMember>> {
  const { data, error } = await supabase
    .from('company_members')
    .select('*')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function inviteMember(
  companyId: string,
  email: string,
  role: MemberRole,
  inviterId: string,
  companyName: string,
  inviterName: string
): Promise<ApiResponse<{ invited: boolean; type: 'added' | 'invited' }>> {
  const { data, error } = await supabase.rpc('invite_user_to_company', {
    p_company_id: companyId,
    p_email: email.toLowerCase(),
    p_role: role,
    p_inviter_id: inviterId,
  });

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data) {
    return { data: null, error: 'No data returned' };
  }

  if (!data.success) {
    return { data: null, error: data.error };
  }

  // Send invitation email
  try {
    await sendInvitationEmail(email.toLowerCase(), companyName, inviterName, role);
  } catch (emailError) {
    // Email failed but invitation was created
  }

  return { data: { invited: true, type: data.type }, error: null };
}

export async function updateMemberRole(
  memberId: string,
  role: MemberRole
): Promise<ApiResponse<CompanyMember>> {
  const { data, error } = await supabase
    .from('company_members')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .select()
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function removeMember(
  memberId: string,
  removerId: string
): Promise<ApiResponse<null>> {
  const { data, error } = await supabase.rpc('remove_company_member', {
    p_member_id: memberId,
    p_remover_id: removerId,
  });

  if (error) {
    return { data: null, error: error.message };
  }

  if (!data.success) {
    return { data: null, error: data.error };
  }

  return { data: null, error: null };
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: MemberRole;
  created_at: string;
  expires_at: string;
}

export async function getPendingInvitations(
  companyId: string
): Promise<ApiResponse<PendingInvitation[]>> {
  const { data, error } = await supabase
    .from('company_invitations')
    .select('id, email, role, created_at, expires_at')
    .eq('company_id', companyId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data || [], error: null };
}

export async function cancelInvitation(
  invitationId: string
): Promise<ApiResponse<null>> {
  const { error } = await supabase
    .from('company_invitations')
    .delete()
    .eq('id', invitationId);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: null, error: null };
}

export async function uploadCompanyLogo(
  companyId: string,
  uri: string
): Promise<ApiResponse<string>> {
  try {
    const fileName = `${companyId}/logo_${Date.now()}.jpg`;

    // Fetch the image
    const response = await fetch(uri);
    const blob = await response.blob();

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return { data: null, error: uploadError.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('company-logos')
      .getPublicUrl(fileName);

    const logoUrl = urlData.publicUrl;

    // Update company with logo URL
    const { error: updateError } = await supabase
      .from('companies')
      .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq('id', companyId);

    if (updateError) {
      return { data: null, error: updateError.message };
    }

    return { data: logoUrl, error: null };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}

export async function removeCompanyLogo(
  companyId: string
): Promise<ApiResponse<null>> {
  const { error } = await supabase
    .from('companies')
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq('id', companyId);

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: null, error: null };
}

export async function getCompanyOwner(
  companyId: string
): Promise<ApiResponse<CompanyMember | null>> {
  const { data, error } = await supabase
    .from('company_members')
    .select('*, user:users(*)')
    .eq('company_id', companyId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export interface InspectionReportEmailData {
  companyId: string;
  companyName: string;
  inspectorName: string;
  projectName: string;
  projectAddress?: string;
  clientName?: string;
  completionPercentage: number;
  pdfBase64?: string;
  pdfFileName?: string;
}

export async function sendInspectionReportToOwner(
  data: InspectionReportEmailData
): Promise<ApiResponse<null>> {
  try {
    // Get company owner
    const { data: owner, error: ownerError } = await getCompanyOwner(data.companyId);

    if (ownerError || !owner) {
      return { data: null, error: null };
    }

    const ownerEmail = owner.user?.email;
    const ownerName = owner.user?.full_name;

    if (!ownerEmail) {
      return { data: null, error: null };
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      return { data: null, error: 'No valid session' };
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-inspection-report`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ownerEmail,
          ownerName,
          companyName: data.companyName,
          inspectorName: data.inspectorName,
          projectName: data.projectName,
          projectAddress: data.projectAddress,
          clientName: data.clientName,
          completionPercentage: data.completionPercentage,
          pdfBase64: data.pdfBase64,
          pdfFileName: data.pdfFileName,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return { data: null, error: result.error || 'Failed to send email' };
    }

    return { data: null, error: null };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}
