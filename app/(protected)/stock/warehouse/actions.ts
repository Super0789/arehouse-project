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

export async function receiveWarehouseStock(input: {
  item_id: string;
  qty: number;
  notes: string | null;
}): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (!input.item_id) return { ok: false, error: "الصنف مطلوب." };
  if (!Number.isInteger(input.qty) || input.qty <= 0)
    return { ok: false, error: "الكمية يجب أن تكون عدداً صحيحاً موجباً." };

  const supabase = createClient();
  const { error } = await supabase.rpc("admin_warehouse_receive", {
    p_item_id: input.item_id,
    p_qty: input.qty,
    p_notes: input.notes?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/stock/warehouse");
  revalidatePath("/stock/transfers");
  return { ok: true, message: "تم إضافة الكمية إلى المخزن الرئيسي." };
}

export async function adjustWarehouseStock(input: {
  item_id: string;
  qty: number;
  reason: string;
}): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (!input.item_id) return { ok: false, error: "الصنف مطلوب." };
  if (!Number.isInteger(input.qty) || input.qty === 0)
    return { ok: false, error: "الكمية يجب أن تكون عدداً صحيحاً غير صفري." };
  if (!input.reason.trim()) return { ok: false, error: "السبب مطلوب." };

  const supabase = createClient();
  const { error } = await supabase.rpc("admin_warehouse_adjust", {
    p_item_id: input.item_id,
    p_qty: input.qty,
    p_reason: input.reason.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/stock/warehouse");
  revalidatePath("/stock/transfers");
  return { ok: true, message: "تم تعديل رصيد المخزن الرئيسي." };
}
