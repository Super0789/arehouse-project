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

/** Adjust stock for an item via admin_adjust_stock RPC. qty can be + or -. */
export async function adjustStock(input: {
  supervisor_id: string;
  item_id: string;
  qty: number;
  reason: string;
}): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!input.supervisor_id || !input.item_id)
    return { ok: false, error: "المشرف والصنف مطلوبان." };
  if (!Number.isInteger(input.qty) || input.qty === 0)
    return { ok: false, error: "الكمية يجب أن تكون عدداً صحيحاً غير صفر." };
  if (!input.reason.trim()) return { ok: false, error: "سبب التعديل مطلوب." };

  const supabase = createClient();
  const { error } = await supabase.rpc("admin_adjust_stock", {
    p_supervisor_id: input.supervisor_id,
    p_item_id: input.item_id,
    p_qty: input.qty,
    p_reason: input.reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/stock/supervisors");
  revalidatePath("/dashboard");
  return { ok: true, message: "تم تعديل الرصيد." };
}
