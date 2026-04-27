"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile, UserRole } from "@/lib/types/database";

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function requireAdmin(): Promise<
  { ok: true; profile: UserProfile } | { ok: false; error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "جلستك منتهية." };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<UserProfile>();

  if (!profile) {
    return {
      ok: false,
      error: "الملف الشخصي غير موجود.",
    };
  }

  if (profile.role !== "admin") {
    return {
      ok: false,
      error: "صلاحيات المدير مطلوبة.",
    };
  }

  return { ok: true, profile };
}

export async function updateUserProfile(
  id: string,
  input: {
    full_name: string;
    role: UserRole;
    linked_supervisor_id: string | null;
    linked_team_id: string | null;
  },
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (!input.full_name.trim()) {
    return {
      ok: false,
      error: "اسم المستخدم مطلوب.",
    };
  }

  if (input.role === "supervisor") {
    if (!input.linked_supervisor_id || !input.linked_team_id) {
      return {
        ok: false,
        error:
          "يجب ربط حساب المشرف بمشرف وفريق.",
      };
    }
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({
      full_name: input.full_name.trim(),
      role: input.role,
      linked_supervisor_id:
        input.role === "supervisor" ? input.linked_supervisor_id : null,
      linked_team_id:
        input.role === "supervisor"
          ? input.linked_team_id
          : input.linked_team_id || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  return {
    ok: true,
    message: "تم تحديث المستخدم.",
  };
}

export async function setUserProfileActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const supabase = createClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ active })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}
