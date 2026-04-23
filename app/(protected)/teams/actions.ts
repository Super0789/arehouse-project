"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types/database";

type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

async function requireAdmin(): Promise<
  { ok: true; profile: UserProfile } | { ok: false; error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "جلستك منتهية." };
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<UserProfile>();
  if (!profile) return { ok: false, error: "الملف الشخصي غير موجود." };
  if (profile.role !== "admin") return { ok: false, error: "صلاحيات المدير مطلوبة." };
  return { ok: true, profile };
}

// ---------- Teams ----------

export async function createTeam(input: {
  team_name: string;
  area: string | null;
}): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!input.team_name.trim()) return { ok: false, error: "اسم الفريق مطلوب." };
  const supabase = createClient();
  const { error } = await supabase.from("teams").insert({
    team_name: input.team_name.trim(),
    area: input.area?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teams");
  return { ok: true, message: "تم إضافة الفريق." };
}

export async function updateTeam(
  id: string,
  input: { team_name: string; area: string | null },
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!input.team_name.trim()) return { ok: false, error: "اسم الفريق مطلوب." };
  const supabase = createClient();
  const { error } = await supabase
    .from("teams")
    .update({
      team_name: input.team_name.trim(),
      area: input.area?.trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teams");
  return { ok: true, message: "تم تحديث الفريق." };
}

export async function setTeamActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const supabase = createClient();
  const { error } = await supabase.from("teams").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teams");
  return { ok: true };
}

// ---------- Supervisors ----------

export async function createSupervisor(input: {
  full_name: string;
  team_id: string;
  phone: string | null;
}): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!input.full_name.trim()) return { ok: false, error: "اسم المشرف مطلوب." };
  if (!input.team_id) return { ok: false, error: "الفريق مطلوب." };
  const supabase = createClient();
  const { error } = await supabase.from("supervisors").insert({
    full_name: input.full_name.trim(),
    team_id: input.team_id,
    phone: input.phone?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teams");
  return { ok: true, message: "تم إضافة المشرف." };
}

export async function updateSupervisor(
  id: string,
  input: { full_name: string; team_id: string; phone: string | null },
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!input.full_name.trim()) return { ok: false, error: "اسم المشرف مطلوب." };
  const supabase = createClient();
  const { error } = await supabase
    .from("supervisors")
    .update({
      full_name: input.full_name.trim(),
      team_id: input.team_id,
      phone: input.phone?.trim() || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teams");
  return { ok: true, message: "تم تحديث المشرف." };
}

export async function setSupervisorActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const supabase = createClient();
  const { error } = await supabase
    .from("supervisors")
    .update({ active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teams");
  return { ok: true };
}

// ---------- Promoters ----------

export async function createPromoter(input: {
  full_name: string;
  team_id: string;
  supervisor_id: string;
}): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!input.full_name.trim()) return { ok: false, error: "اسم المروّج مطلوب." };
  if (!input.team_id) return { ok: false, error: "الفريق مطلوب." };
  if (!input.supervisor_id) return { ok: false, error: "المشرف مطلوب." };
  const supabase = createClient();
  const { error } = await supabase.from("promoters").insert({
    full_name: input.full_name.trim(),
    team_id: input.team_id,
    supervisor_id: input.supervisor_id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teams");
  return { ok: true, message: "تم إضافة المروّج." };
}

export async function updatePromoter(
  id: string,
  input: { full_name: string; team_id: string; supervisor_id: string },
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!input.full_name.trim()) return { ok: false, error: "اسم المروّج مطلوب." };
  const supabase = createClient();
  const { error } = await supabase
    .from("promoters")
    .update({
      full_name: input.full_name.trim(),
      team_id: input.team_id,
      supervisor_id: input.supervisor_id,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teams");
  return { ok: true, message: "تم تحديث المروّج." };
}

export async function setPromoterActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const supabase = createClient();
  const { error } = await supabase
    .from("promoters")
    .update({ active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teams");
  return { ok: true };
}
