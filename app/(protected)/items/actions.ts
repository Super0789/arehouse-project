"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types/database";

type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
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
  if (profile.role !== "admin")
    return { ok: false, error: "صلاحيات المدير مطلوبة." };
  return { ok: true };
}

export interface ItemInput {
  item_name: string;
  item_code: string | null;
  category: string | null;
  unit: string;
}

function normalize(input: ItemInput): ItemInput {
  return {
    item_name: input.item_name.trim(),
    item_code: input.item_code?.trim() || null,
    category: input.category?.trim() || null,
    unit: input.unit.trim() || "pcs",
  };
}

export async function createItem(input: ItemInput): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const data = normalize(input);
  if (!data.item_name) return { ok: false, error: "اسم الصنف مطلوب." };

  const supabase = createClient();
  const { error } = await supabase.from("items").insert(data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/items");
  return { ok: true, message: "تم إضافة الصنف." };
}

export async function updateItem(
  id: string,
  input: ItemInput,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const data = normalize(input);
  if (!data.item_name) return { ok: false, error: "اسم الصنف مطلوب." };

  const supabase = createClient();
  const { error } = await supabase.from("items").update(data).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/items");
  return { ok: true, message: "تم تحديث الصنف." };
}

export async function setItemActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const supabase = createClient();
  const { error } = await supabase.from("items").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/items");
  return { ok: true };
}
