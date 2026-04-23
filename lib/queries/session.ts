import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";
import type {
  DailySession,
  Item,
  MorningDistributionRow,
  Promoter,
  PromoterClosingRow,
  Supervisor,
  SupervisorStock,
  Team,
  UserProfile,
} from "@/lib/types/database";

export interface SessionMatrixData {
  profile: UserProfile;
  supervisor: Supervisor | null;
  team: Team | null;
  session: DailySession | null;
  promoters: Promoter[];
  items: Item[];
  stock: Record<string, number>; // itemId -> quantity_on_hand
  distribution: MorningDistributionRow[];
  closing: PromoterClosingRow[];
  /** True when the caller is a supervisor user but not linked to any supervisor row */
  missingSupervisorLink: boolean;
}

/**
 * Loads everything needed for the morning-distribution / closing screens.
 *
 * For supervisor users: scoped to their linked supervisor.
 * For admin users: we expect ?supervisorId=... (handled by caller).
 *
 * Returns session=null if no session exists yet for today — caller decides
 * whether to create one.
 */
export async function getSessionMatrixData(
  profile: UserProfile,
  opts: { supervisorId?: string | null } = {},
): Promise<SessionMatrixData> {
  const supabase = createClient();
  const today = todayISO();

  let supervisorId = profile.linked_supervisor_id ?? null;
  if (profile.role === "admin" && opts.supervisorId) {
    supervisorId = opts.supervisorId;
  }

  if (!supervisorId) {
    return {
      profile,
      supervisor: null,
      team: null,
      session: null,
      promoters: [],
      items: [],
      stock: {},
      distribution: [],
      closing: [],
      missingSupervisorLink: profile.role === "supervisor",
    };
  }

  const { data: supervisor } = await supabase
    .from("supervisors")
    .select("*")
    .eq("id", supervisorId)
    .maybeSingle<Supervisor>();

  if (!supervisor) {
    return {
      profile,
      supervisor: null,
      team: null,
      session: null,
      promoters: [],
      items: [],
      stock: {},
      distribution: [],
      closing: [],
      missingSupervisorLink: false,
    };
  }

  const [teamRes, promotersRes, itemsRes, stockRes, sessionRes] =
    await Promise.all([
      supabase
        .from("teams")
        .select("*")
        .eq("id", supervisor.team_id)
        .maybeSingle<Team>(),
      supabase
        .from("promoters")
        .select("*")
        .eq("supervisor_id", supervisor.id)
        .eq("active", true)
        .order("full_name"),
      supabase
        .from("items")
        .select("*")
        .eq("active", true)
        .order("item_name"),
      supabase
        .from("supervisor_stock")
        .select("*")
        .eq("supervisor_id", supervisor.id),
      supabase
        .from("daily_sessions")
        .select("*")
        .eq("supervisor_id", supervisor.id)
        .eq("session_date", today)
        .maybeSingle<DailySession>(),
    ]);

  const promoters = (promotersRes.data ?? []) as Promoter[];
  const items = (itemsRes.data ?? []) as Item[];
  const stockRows = (stockRes.data ?? []) as SupervisorStock[];
  const session = (sessionRes.data ?? null) as DailySession | null;

  const stock: Record<string, number> = {};
  for (const r of stockRows) stock[r.item_id] = r.quantity_on_hand;

  let distribution: MorningDistributionRow[] = [];
  let closing: PromoterClosingRow[] = [];

  if (session) {
    const [distRes, closeRes] = await Promise.all([
      supabase
        .from("morning_distribution")
        .select("*")
        .eq("daily_session_id", session.id),
      supabase
        .from("promoter_closing")
        .select("*")
        .eq("daily_session_id", session.id),
    ]);
    distribution = (distRes.data ?? []) as MorningDistributionRow[];
    closing = (closeRes.data ?? []) as PromoterClosingRow[];
  }

  return {
    profile,
    supervisor,
    team: (teamRes.data ?? null) as Team | null,
    session,
    promoters,
    items,
    stock,
    distribution,
    closing,
    missingSupervisorLink: false,
  };
}