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
    return { ok: false, error: "\u062c\u0644\u0633\u062a\u0643 \u0645\u0646\u062a\u0647\u064a\u0629." };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<UserProfile>();

  if (!profile) {
    return {
      ok: false,
      error: "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f.",
    };
  }

  if (profile.role !== "admin") {
    return {
      ok: false,
      error: "\u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0627\u0644\u0645\u062f\u064a\u0631 \u0645\u0637\u0644\u0648\u0628\u0629.",
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
      error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0645\u0637\u0644\u0648\u0628.",
    };
  }

  if (input.role === "supervisor") {
    if (!input.linked_supervisor_id || !input.linked_team_id) {
      return {
        ok: false,
        error:
          "\u064a\u062c\u0628 \u0631\u0628\u0637 \u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0634\u0631\u0641 \u0628\u0645\u0634\u0631\u0641 \u0648\u0641\u0631\u064a\u0642.",
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
    message: "\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645.",
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
