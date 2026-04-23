"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DailySession, UserProfile } from "@/lib/types/database";

type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

async function getProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<UserProfile>();
  return data ?? null;
}

export interface ClosingLine {
  promoter_id: string;
  item_id: string;
  qty_remaining: number;
}

/**
 * Replaces the closing rows for this session with the given set.
 * Only allowed when session is in 'morning_submitted'.
 */
export async function saveClosing(
  sessionId: string,
  lines: ClosingLine[],
): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "جلستك منتهية." };

  const supabase = createClient();

  const { data: session, error: sErr } = await supabase
    .from("daily_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle<DailySession>();
  if (sErr || !session) return { ok: false, error: "الجلسة غير موجودة." };
  if (session.status === "closed") {
    return { ok: false, error: "لا يمكن تعديل جلسة مغلقة." };
  }
  if (session.status !== "morning_submitted") {
    return { ok: false, error: "يجب إرسال توزيع الصباح أولاً." };
  }
  if (
    profile.role === "supervisor" &&
    session.supervisor_id !== profile.linked_supervisor_id
  ) {
    return { ok: false, error: "غير مصرّح" };
  }
  if (profile.role === "viewer") return { ok: false, error: "غير مصرّح" };

  const clean = lines.filter(
    (l) =>
      Number.isInteger(l.qty_remaining) &&
      l.qty_remaining >= 0 &&
      l.promoter_id &&
      l.item_id,
  );

  const { error: delErr } = await supabase
    .from("promoter_closing")
    .delete()
    .eq("daily_session_id", sessionId);
  if (delErr) return { ok: false, error: delErr.message };

  if (clean.length > 0) {
    const { error: insErr } = await supabase.from("promoter_closing").insert(
      clean.map((l) => ({
        daily_session_id: sessionId,
        promoter_id: l.promoter_id,
        item_id: l.item_id,
        qty_remaining: l.qty_remaining,
      })),
    );
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath("/sessions/closing");
  return { ok: true, message: "تم حفظ بيانات الإغلاق." };
}

/**
 * Calls the close_session RPC. Validates all closing rows are present
 * and atomically returns remaining qty to supervisor stock.
 */
export async function closeSession(
  sessionId: string,
): Promise<ActionResult<DailySession>> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "جلستك منتهية." };
  if (profile.role === "viewer") return { ok: false, error: "غير مصرّح" };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("close_session", {
    p_session_id: sessionId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/sessions/closing");
  revalidatePath("/sessions/today");
  revalidatePath("/dashboard");
  return { ok: true, data: data as DailySession, message: "تم إغلاق الجلسة." };
}
