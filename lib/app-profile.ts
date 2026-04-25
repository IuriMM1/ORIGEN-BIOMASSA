import type { SupabaseClient } from "@supabase/supabase-js";

export type AppProfileRole = "admin" | "usuario";

export type AppProfileRow = {
  id: string;
  email: string | null;
  full_name: string;
  job_title: string | null;
  phone: string | null;
  company: string | null;
  role: AppProfileRole;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

export async function fetchMyAppProfile(client: SupabaseClient): Promise<AppProfileRow | null> {
  const { data: sessionData } = await client.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return null;

  const { data, error } = await client.from("app_profiles").select("*").eq("id", uid).maybeSingle();

  if (error) {
    console.warn("app_profiles:", error.message);
    return null;
  }
  return data as unknown as AppProfileRow | null;
}

/** Marca último acesso na plataforma (requer linha em app_profiles). */
export async function touchLastSeen(client: SupabaseClient, userId: string): Promise<{ error: string | null }> {
  const iso = new Date().toISOString();
  const { error } = await client.from("app_profiles").update({ last_seen_at: iso }).eq("id", userId);
  if (error) {
    console.warn("touchLastSeen:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

/** Preenche empresa/cargo/telefone na BD só quando estão vazios e existem nos metadados do Auth. */
export async function syncAppProfileGapsFromMetadata(
  client: SupabaseClient,
  userId: string,
  userMetadata: Record<string, unknown> | null | undefined,
): Promise<void> {
  if (!userMetadata) return;
  const { data: row, error: selErr } = await client
    .from("app_profiles")
    .select("company, job_title, phone")
    .eq("id", userId)
    .maybeSingle();
  if (selErr || !row) return;

  const cur = row as Pick<AppProfileRow, "company" | "job_title" | "phone">;
  const company = typeof userMetadata.company === "string" ? userMetadata.company.trim() : "";
  const jobTitle = typeof userMetadata.job_title === "string" ? userMetadata.job_title.trim() : "";
  const phone = typeof userMetadata.phone === "string" ? userMetadata.phone.trim() : "";

  const patch: Record<string, string> = {};
  if (company && !cur.company?.trim()) patch.company = company;
  if (jobTitle && !cur.job_title?.trim()) patch.job_title = jobTitle;
  if (phone && !cur.phone?.trim()) patch.phone = phone;

  if (Object.keys(patch).length === 0) return;
  const { error } = await client.from("app_profiles").update(patch).eq("id", userId);
  if (error) console.warn("syncAppProfileGapsFromMetadata:", error.message);
}

export async function fetchAllAppProfiles(client: SupabaseClient): Promise<{ data: AppProfileRow[]; error: string | null }> {
  const { data, error } = await client
    .from("app_profiles")
    .select("id, email, full_name, job_title, phone, company, role, last_seen_at, created_at, updated_at")
    .order("full_name", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data as unknown as AppProfileRow[]) ?? [], error: null };
}
