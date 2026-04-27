import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";
import type {
  DailySession,
  Item,
  MorningDistributionRow,
  PromoterClosingRow,
  Supervisor,
  SupervisorStock,
  Team,
  UserProfile,
} from "@/lib/types/database";

export type SessionStatus = "draft" | "morning_submitted" | "closed";

export interface DashboardKpis {
  totalDistributed: number;
  totalRemaining: number;
  totalConsumption: number;
  activeTeams: number;
  lowStockAlerts: number;
}

export interface SessionsStatus {
  draft: number;
  morningSubmitted: number;
  closed: number;
  totalTeams: number;
  teamsWithoutSession: { team_id: string; team_name: string }[];
}

export interface SupervisorSummaryRow {
  supervisor_id: string;
  supervisor_name: string;
  team_name: string;
  session_status: SessionStatus | "no_session";
  distributed: number;
  remaining: number;
  consumption: number;
}

export interface TopItemRow {
  item_id: string;
  item_name: string;
  distributed: number;
  consumption: number;
}

export interface TeamConsumptionRow {
  team_id: string;
  team_name: string;
  consumption: number;
  distributed: number;
}

export interface DashboardData {
  profile: UserProfile;
  today: string;
  kpis: DashboardKpis;
  sessions: SessionsStatus;
  supervisors: SupervisorSummaryRow[];
  topItems: TopItemRow[];
  byTeam: TeamConsumptionRow[];
}

export async function getDashboardData(
  profile: UserProfile,
): Promise<DashboardData> {
  const supabase = createClient();
  const today = todayISO();
  const LOW_STOCK_THRESHOLD = 10;

  const [
    teamsRes,
    supervisorsRes,
    promotersRes,
    itemsRes,
    sessionsRes,
    distRes,
    closingRes,
    stockRes,
  ] = await Promise.all([
    supabase.from("teams").select("*").eq("active", true),
    supabase.from("supervisors").select("*").eq("active", true),
    supabase.from("promoters").select("*").eq("active", true),
    supabase.from("items").select("*").eq("active", true),
    supabase.from("daily_sessions").select("*").eq("session_date", today),
    supabase
      .from("morning_distribution")
      .select("id, daily_session_id, promoter_id, item_id, qty_given, created_at, created_by"),
    supabase
      .from("promoter_closing")
      .select("id, daily_session_id, promoter_id, item_id, qty_remaining, created_at, created_by"),
    supabase.from("supervisor_stock").select("*"),
  ]);

  if (teamsRes.error) throw teamsRes.error;
  if (supervisorsRes.error) throw supervisorsRes.error;
  if (promotersRes.error) throw promotersRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (sessionsRes.error) throw sessionsRes.error;
  if (distRes.error) throw distRes.error;
  if (closingRes.error) throw closingRes.error;
  if (stockRes.error) throw stockRes.error;

  const teams = (teamsRes.data ?? []) as Team[];
  const supervisors = (supervisorsRes.data ?? []) as Supervisor[];
  const items = (itemsRes.data ?? []) as Item[];
  const sessionsToday = (sessionsRes.data ?? []) as DailySession[];
  const allDist = (distRes.data ?? []) as MorningDistributionRow[];
  const allClosing = (closingRes.data ?? []) as PromoterClosingRow[];
  const stock = (stockRes.data ?? []) as SupervisorStock[];

  const todaySessionIds = new Set(sessionsToday.map((s) => s.id));
  const todayDist = allDist.filter((d) => todaySessionIds.has(d.daily_session_id));
  const todayClosing = allClosing.filter((c) => todaySessionIds.has(c.daily_session_id));

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const supervisorById = new Map(supervisors.map((s) => [s.id, s]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  const totalDistributed = todayDist.reduce((s, r) => s + r.qty_given, 0);
  const totalRemaining = todayClosing.reduce((s, r) => s + r.qty_remaining, 0);

  const sessionHasClosing = new Set(todayClosing.map((c) => c.daily_session_id));
  const distInClosedSessions = todayDist
    .filter((d) => sessionHasClosing.has(d.daily_session_id))
    .reduce((s, r) => s + r.qty_given, 0);
  const totalConsumption = Math.max(0, distInClosedSessions - totalRemaining);

  const activeTeams = new Set(sessionsToday.map((s) => s.team_id)).size;
  const lowStockAlerts = stock.filter((r) => r.quantity_on_hand <= LOW_STOCK_THRESHOLD).length;

  const kpis: DashboardKpis = {
    totalDistributed,
    totalRemaining,
    totalConsumption,
    activeTeams,
    lowStockAlerts,
  };

  // ===== Sessions status =====
  const statusCounts: Record<SessionStatus, number> = {
    draft: 0,
    morning_submitted: 0,
    closed: 0,
  };
  sessionsToday.forEach((s) => {
    statusCounts[s.status as SessionStatus] += 1;
  });

  const teamsWithSession = new Set(sessionsToday.map((s) => s.team_id));
  const teamsWithoutSession = teams
    .filter((t) => !teamsWithSession.has(t.id))
    .map((t) => ({ team_id: t.id, team_name: t.team_name }));

  const sessions: SessionsStatus = {
    draft: statusCounts.draft,
    morningSubmitted: statusCounts.morning_submitted,
    closed: statusCounts.closed,
    totalTeams: teams.length,
    teamsWithoutSession,
  };

  // ===== Per-supervisor summary =====
  const perSession = new Map<string, { distributed: number; remaining: number }>();

  for (const d of todayDist) {
    const e = perSession.get(d.daily_session_id) ?? { distributed: 0, remaining: 0 };
    e.distributed += d.qty_given;
    perSession.set(d.daily_session_id, e);
  }
  for (const c of todayClosing) {
    const e = perSession.get(c.daily_session_id) ?? { distributed: 0, remaining: 0 };
    e.remaining += c.qty_remaining;
    perSession.set(c.daily_session_id, e);
  }

  const visibleSupervisors =
    profile.role === "supervisor"
      ? supervisors.filter((sv) => sv.id === profile.linked_supervisor_id)
      : supervisors;

  const supervisorRows: SupervisorSummaryRow[] = visibleSupervisors.map((sv) => {
    const session = sessionsToday.find((s) => s.supervisor_id === sv.id);
    const agg = session ? perSession.get(session.id) : undefined;
    const team = teamById.get(sv.team_id);
    const distributed = agg?.distributed ?? 0;
    const remaining = agg?.remaining ?? 0;
    const hasClosing = session ? sessionHasClosing.has(session.id) : false;
    const consumption = hasClosing ? Math.max(0, distributed - remaining) : 0;

    return {
      supervisor_id: sv.id,
      supervisor_name: sv.full_name,
      team_name: team?.team_name ?? "—",
      session_status: (session?.status ?? "no_session") as SessionStatus | "no_session",
      distributed,
      remaining,
      consumption,
    };
  });

  // ===== Top items =====
  const itemDist = new Map<string, { distributed: number; remaining: number }>();
  for (const d of todayDist) {
    const e = itemDist.get(d.item_id) ?? { distributed: 0, remaining: 0 };
    e.distributed += d.qty_given;
    itemDist.set(d.item_id, e);
  }
  for (const c of todayClosing) {
    const e = itemDist.get(c.item_id) ?? { distributed: 0, remaining: 0 };
    e.remaining += c.qty_remaining;
    itemDist.set(c.item_id, e);
  }

  const topItems: TopItemRow[] = Array.from(itemDist.entries())
    .map(([item_id, v]) => ({
      item_id,
      item_name: itemById.get(item_id)?.item_name ?? "—",
      distributed: v.distributed,
      consumption: Math.max(0, v.distributed - v.remaining),
    }))
    .sort((a, b) => b.distributed - a.distributed)
    .slice(0, 7);

  // ===== By team =====
  const teamAgg = new Map<string, { distributed: number; consumption: number }>();
  for (const row of supervisorRows) {
    const sv = supervisorById.get(row.supervisor_id);
    if (!sv) continue;
    const t = teamById.get(sv.team_id);
    if (!t) continue;
    const e = teamAgg.get(t.id) ?? { distributed: 0, consumption: 0 };
    e.distributed += row.distributed;
    e.consumption += row.consumption;
    teamAgg.set(t.id, e);
  }

  const byTeam: TeamConsumptionRow[] = Array.from(teamAgg.entries())
    .map(([team_id, v]) => ({
      team_id,
      team_name: teamById.get(team_id)?.team_name ?? "—",
      distributed: v.distributed,
      consumption: v.consumption,
    }))
    .sort((a, b) => b.distributed - a.distributed);

  return { profile, today, kpis, sessions, supervisors: supervisorRows, topItems, byTeam };
}