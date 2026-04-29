"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";
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

/**
 * Create today's session if none exists yet. Idempotent — if one already
 * exists for (supervisor, today), returns it.
 */
export async function createTodaySession(
  supervisorId: string,
): Promise<ActionResult<DailySession>> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "جلستك منتهية. سجّل الدخول مجدداً." };

  // Supervisor can only create for themselves; admin can create for anyone.
  if (
    profile.role === "supervisor" &&
    profile.linked_supervisor_id !== supervisorId
  ) {
    return { ok: false, error: "غير مصرّح لك بإنشاء جلسة لمشرف آخر." };
  }
  if (profile.role !== "admin" && profile.role !== "supervisor") {
    return { ok: false, error: "غير مصرّح" };
  }

  const supabase = createClient();
  const today = todayISO();

  // Fetch supervisor's team
  const { data: supervisor, error: supErr } = await supabase
    .from("supervisors")
    .select("id, team_id, active")
    .eq("id", supervisorId)
    .maybeSingle();
  if (supErr || !supervisor) {
    return { ok: false, error: "المشرف غير موجود." };
  }
  if (!supervisor.active) {
    return { ok: false, error: "المشرف غير نشط." };
  }

  // Check if one exists
  const { data: existing } = await supabase
    .from("daily_sessions")
    .select("*")
    .eq("supervisor_id", supervisorId)
    .eq("session_date", today)
    .maybeSingle<DailySession>();

  if (existing) {
    return { ok: true, data: existing };
  }

  const { data: created, error: insErr } = await supabase
    .from("daily_sessions")
    .insert({
      session_date: today,
      team_id: supervisor.team_id,
      supervisor_id: supervisorId,
      status: "draft",
    })
    .select("*")
    .maybeSingle<DailySession>();

  if (insErr || !created) {
    // Unique violation = race; someone else inserted. Just read it back.
    if (insErr?.code === "23505") {
      const { data: again } = await supabase
        .from("daily_sessions")
        .select("*")
        .eq("supervisor_id", supervisorId)
        .eq("session_date", today)
        .maybeSingle<DailySession>();
      if (again) {
        revalidatePath("/sessions/today");
        return { ok: true, data: again };
      }
    }
    return { ok: false, error: insErr?.message ?? "تعذّر إنشاء الجلسة." };
  }

  revalidatePath("/sessions/today");
  revalidatePath("/dashboard");
  return { ok: true, data: created };
}

export interface DistributionLine {
  promoter_id: string;
  item_id: string;
  qty_given: number;
}

/**
 * Save the matrix as a draft. We replace the full set of rows for this session
 * — simpler than diffing, and safe because the session is still 'draft'.
 * No stock_movements are written on draft save (stock is only reserved on submit).
 */
export async function saveDraftDistribution(
  sessionId: string,
  lines: DistributionLine[],
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
  if (session.status !== "draft") {
    return { ok: false, error: "لا يمكن تعديل جلسة بعد إرسالها." };
  }

  if (
    profile.role === "supervisor" &&
    session.supervisor_id !== profile.linked_supervisor_id
  ) {
    return { ok: false, error: "غير مصرّح" };
  }

  // Normalize + validate
  const clean = lines.filter(
    (l) =>
      Number.isInteger(l.qty_given) &&
      l.qty_given > 0 &&
      l.promoter_id &&
      l.item_id,
  );

  // Replace rows
  const { error: delErr } = await supabase
    .from("morning_distribution")
    .delete()
    .eq("daily_session_id", sessionId);
  if (delErr) return { ok: false, error: delErr.message };

  if (clean.length > 0) {
    const { error: insErr } = await supabase.from("morning_distribution").insert(
      clean.map((l) => ({
        daily_session_id: sessionId,
        promoter_id: l.promoter_id,
        item_id: l.item_id,
        qty_given: l.qty_given,
      })),
    );
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath("/sessions/today");
  return { ok: true, message: "تم حفظ المسودّة." };
}

/**
 * Add more quantity to an existing distribution (or create a new line) AFTER
 * the morning has been submitted but BEFORE the session is closed.
 *
 * Use case: a promoter has finished what they were given and the supervisor
 * wants to hand out more during the day. Stock is validated by the
 * morning_distribution trigger and the stock_movements trigger; we just do an
 * upsert-add at the app layer (sequential by row, but rows are tiny).
 */
export interface ExtraDistributionLine {
  promoter_id: string;
  item_id: string;
  qty_extra: number;
}

export async function addExtraDistribution(
  sessionId: string,
  lines: ExtraDistributionLine[],
): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "جلستك منتهية." };
  if (profile.role !== "admin" && profile.role !== "supervisor") {
    return { ok: false, error: "غير مصرّح" };
  }

  const supabase = createClient();

  const { data: session, error: sErr } = await supabase
    .from("daily_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle<DailySession>();
  if (sErr || !session) return { ok: false, error: "الجلسة غير موجودة." };

  if (session.status === "draft") {
    return {
      ok: false,
      error: "الجلسة لم تُرسَل بعد — استخدم شاشة التوزيع للتعديل.",
    };
  }
  if (session.status === "closed") {
    return { ok: false, error: "الجلسة مغلقة." };
  }
  if (
    profile.role === "supervisor" &&
    session.supervisor_id !== profile.linked_supervisor_id
  ) {
    return { ok: false, error: "غير مصرّح" };
  }

  const clean = lines.filter(
    (l) =>
      Number.isInteger(l.qty_extra) &&
      l.qty_extra > 0 &&
      l.promoter_id &&
      l.item_id,
  );
  if (clean.length === 0) {
    return { ok: false, error: "أدخل كمية إضافية صحيحة." };
  }

  for (const line of clean) {
    const { data: existing, error: exErr } = await supabase
      .from("morning_distribution")
      .select("id, qty_given")
      .eq("daily_session_id", sessionId)
      .eq("promoter_id", line.promoter_id)
      .eq("item_id", line.item_id)
      .maybeSingle<{ id: string; qty_given: number }>();
    if (exErr) return { ok: false, error: exErr.message };

    if (existing) {
      const { error: upErr } = await supabase
        .from("morning_distribution")
        .update({ qty_given: existing.qty_given + line.qty_extra })
        .eq("id", existing.id);
      if (upErr) return { ok: false, error: upErr.message };
    } else {
      const { error: insErr } = await supabase
        .from("morning_distribution")
        .insert({
          daily_session_id: sessionId,
          promoter_id: line.promoter_id,
          item_id: line.item_id,
          qty_given: line.qty_extra,
        });
      if (insErr) return { ok: false, error: insErr.message };
    }
  }

  revalidatePath("/sessions/today");
  revalidatePath("/sessions/closing");
  revalidatePath("/dashboard");
  return { ok: true, message: "تم تسجيل الكمية الإضافية." };
}

/**
 * Submit the matrix: calls the RPC which validates against stock, inserts
 * distribution + stock_movements atomically, and flips status.
 */
export async function submitDistribution(
  sessionId: string,
  lines: DistributionLine[],
): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "جلستك منتهية." };

  const clean = lines.filter(
    (l) =>
      Number.isInteger(l.qty_given) &&
      l.qty_given > 0 &&
      l.promoter_id &&
      l.item_id,
  );

  if (clean.length === 0) {
    return { ok: false, error: "لا توجد أي كميات للتوزيع." };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("submit_morning_distribution", {
    p_session_id: sessionId,
    p_lines: clean,
  });

  if (error) {
    // Translate common codes
    if (error.code === "P0001") {
      return { ok: false, error: error.message };
    }
    if (error.code === "42501") {
      return { ok: false, error: "غير مصرّح" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/sessions/today");
  revalidatePath("/sessions/closing");
  revalidatePath("/dashboard");
  return { ok: true, message: "تم إرسال التوزيع." };
}