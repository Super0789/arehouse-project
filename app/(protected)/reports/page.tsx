import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportsFilters } from "@/components/reports/reports-filters";
import { ExportCsvButton } from "@/components/reports/export-csv-button";
import { formatNumber, todayISO } from "@/lib/utils";
import type {
  DailySession,
  Item,
  MorningDistributionRow,
  Promoter,
  PromoterClosingRow,
  Supervisor,
  Team,
} from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "التقارير | نظام إدارة المخزون الترويجي",
};

interface PageProps {
  searchParams: {
    date_from?: string;
    date_to?: string;
    team_id?: string;
    supervisor_id?: string;
    promoter_id?: string;
    item_id?: string;
  };
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  // Default: today only
  const dateFrom = searchParams.date_from || todayISO();
  const dateTo = searchParams.date_to || todayISO();

  // Lookup data for filters & joins
  const [teamsRes, supervisorsRes, promotersRes, itemsRes] = await Promise.all([
    supabase.from("teams").select("*").order("team_name"),
    supabase.from("supervisors").select("*").order("full_name"),
    supabase.from("promoters").select("*").order("full_name"),
    supabase.from("items").select("*").order("item_name"),
  ]);

  const teams = (teamsRes.data ?? []) as Team[];
  const supervisors = (supervisorsRes.data ?? []) as Supervisor[];
  const promoters = (promotersRes.data ?? []) as Promoter[];
  const items = (itemsRes.data ?? []) as Item[];

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const supervisorById = new Map(supervisors.map((s) => [s.id, s]));
  const promoterById = new Map(promoters.map((p) => [p.id, p]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  // Sessions in date range — RLS limits supervisor users automatically
  let sessionsQuery = supabase
    .from("daily_sessions")
    .select("*")
    .gte("session_date", dateFrom)
    .lte("session_date", dateTo);
  if (searchParams.team_id) sessionsQuery = sessionsQuery.eq("team_id", searchParams.team_id);
  if (searchParams.supervisor_id)
    sessionsQuery = sessionsQuery.eq("supervisor_id", searchParams.supervisor_id);

  const { data: sessionsData, error: sessErr } = await sessionsQuery;
  if (sessErr) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل التقرير</AlertTitle>
          <AlertDescription>{sessErr.message}</AlertDescription>
        </Alert>
      </div>
    );
  }
  const sessions = (sessionsData ?? []) as DailySession[];
  const sessionIds = sessions.map((s) => s.id);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  // Distribution + closing for matched sessions
  let distData: MorningDistributionRow[] = [];
  let closeData: PromoterClosingRow[] = [];
  if (sessionIds.length > 0) {
    let distQ = supabase
      .from("morning_distribution")
      .select("*")
      .in("daily_session_id", sessionIds);
    if (searchParams.item_id) distQ = distQ.eq("item_id", searchParams.item_id);
    if (searchParams.promoter_id)
      distQ = distQ.eq("promoter_id", searchParams.promoter_id);
    const dRes = await distQ;
    distData = (dRes.data ?? []) as MorningDistributionRow[];

    let closeQ = supabase
      .from("promoter_closing")
      .select("*")
      .in("daily_session_id", sessionIds);
    if (searchParams.item_id) closeQ = closeQ.eq("item_id", searchParams.item_id);
    if (searchParams.promoter_id)
      closeQ = closeQ.eq("promoter_id", searchParams.promoter_id);
    const cRes = await closeQ;
    closeData = (cRes.data ?? []) as PromoterClosingRow[];
  }

  // Lookup helpers for rendering
  const getSessionMeta = (sessionId: string) => {
    const s = sessionById.get(sessionId);
    if (!s) return { date: "—", team: "—", supervisor: "—" };
    return {
      date: s.session_date,
      team: teamById.get(s.team_id)?.team_name ?? "—",
      supervisor: supervisorById.get(s.supervisor_id)?.full_name ?? "—",
    };
  };

  // ===== Report 1: Morning distribution rows =====
  const morningRows = distData
    .map((d) => {
      const meta = getSessionMeta(d.daily_session_id);
      return {
        ...d,
        ...meta,
        promoter_name: promoterById.get(d.promoter_id)?.full_name ?? "—",
        item_name: itemById.get(d.item_id)?.item_name ?? "—",
      };
    })
    .sort((a, b) =>
      a.date === b.date
        ? a.promoter_name.localeCompare(b.promoter_name, "ar")
        : a.date.localeCompare(b.date),
    );

  const morningTotal = morningRows.reduce((s, r) => s + r.qty_given, 0);

  // ===== Report 2: End of day rows (only sessions with closing data) =====
  // Build map (session, promoter, item) -> { given, remaining }
  type Key = string;
  const key = (sId: string, pId: string, iId: string) => `${sId}|${pId}|${iId}`;
  const eod = new Map<Key, { given: number; remaining: number }>();
  for (const d of distData) {
    eod.set(key(d.daily_session_id, d.promoter_id, d.item_id), {
      given: d.qty_given,
      remaining: 0,
    });
  }
  for (const c of closeData) {
    const k = key(c.daily_session_id, c.promoter_id, c.item_id);
    const e = eod.get(k) ?? { given: 0, remaining: 0 };
    e.remaining = c.qty_remaining;
    eod.set(k, e);
  }
  const eodRows = Array.from(eod.entries())
    .map(([k, v]) => {
      const [sId, pId, iId] = k.split("|");
      const meta = getSessionMeta(sId);
      return {
        ...meta,
        promoter_name: promoterById.get(pId)?.full_name ?? "—",
        item_name: itemById.get(iId)?.item_name ?? "—",
        given: v.given,
        remaining: v.remaining,
        consumed: Math.max(0, v.given - v.remaining),
      };
    })
    .sort((a, b) =>
      a.date === b.date
        ? a.promoter_name.localeCompare(b.promoter_name, "ar")
        : a.date.localeCompare(b.date),
    );
  const eodTotals = eodRows.reduce(
    (acc, r) => ({
      given: acc.given + r.given,
      remaining: acc.remaining + r.remaining,
      consumed: acc.consumed + r.consumed,
    }),
    { given: 0, remaining: 0, consumed: 0 },
  );

  // ===== Report 3: Consumption per promoter (aggregate across date range) =====
  const perPromoter = new Map<string, { given: number; remaining: number }>();
  for (const d of distData) {
    const e = perPromoter.get(d.promoter_id) ?? { given: 0, remaining: 0 };
    e.given += d.qty_given;
    perPromoter.set(d.promoter_id, e);
  }
  for (const c of closeData) {
    const e = perPromoter.get(c.promoter_id) ?? { given: 0, remaining: 0 };
    e.remaining += c.qty_remaining;
    perPromoter.set(c.promoter_id, e);
  }
  const promoterRows = Array.from(perPromoter.entries())
    .map(([pId, v]) => {
      const p = promoterById.get(pId);
      const team = p ? teamById.get(p.team_id) : null;
      const sup = p ? supervisorById.get(p.supervisor_id) : null;
      return {
        promoter_name: p?.full_name ?? "—",
        team_name: team?.team_name ?? "—",
        supervisor_name: sup?.full_name ?? "—",
        given: v.given,
        remaining: v.remaining,
        consumed: Math.max(0, v.given - v.remaining),
      };
    })
    .sort((a, b) => b.consumed - a.consumed);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">التقارير</h1>
        <p className="text-sm text-muted-foreground">
          تقارير قابلة للتصفية لعمليات التوزيع والإغلاق والاستهلاك.
        </p>
      </div>

      <ReportsFilters
        teams={teams}
        supervisors={supervisors}
        promoters={promoters}
        items={items}
        showTeamFilter={profile.role !== "supervisor"}
        showSupervisorFilter={profile.role !== "supervisor"}
        initial={{
          date_from: dateFrom,
          date_to: dateTo,
          team_id: searchParams.team_id ?? "",
          supervisor_id: searchParams.supervisor_id ?? "",
          promoter_id: searchParams.promoter_id ?? "",
          item_id: searchParams.item_id ?? "",
        }}
      />

      {/* Morning distribution */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>تقرير توزيع الصباح</CardTitle>
            <CardDescription>
              عدد العمليات: {morningRows.length} — الإجمالي:{" "}
              {formatNumber(morningTotal)}
            </CardDescription>
          </div>
          {profile.role === "admin" && (
            <ExportCsvButton
              filename={`morning_distribution_${dateFrom}_to_${dateTo}`}
              rows={morningRows}
              columns={[
                { key: "date", header: "التاريخ" },
                { key: "team", header: "الفريق" },
                { key: "supervisor", header: "المشرف" },
                { key: "promoter_name", header: "المروّج" },
                { key: "item_name", header: "الصنف" },
                { key: "qty_given", header: "الكمية" },
              ]}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الفريق</TableHead>
                <TableHead>المشرف</TableHead>
                <TableHead>المروّج</TableHead>
                <TableHead>الصنف</TableHead>
                <TableHead className="text-left">الكمية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {morningRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    لا توجد بيانات.
                  </TableCell>
                </TableRow>
              )}
              {morningRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell dir="ltr">{r.date}</TableCell>
                  <TableCell className="text-muted-foreground">{r.team}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.supervisor}
                  </TableCell>
                  <TableCell>{r.promoter_name}</TableCell>
                  <TableCell>{r.item_name}</TableCell>
                  <TableCell className="text-left tabular-nums">
                    {formatNumber(r.qty_given)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* End of day */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>تقرير نهاية اليوم</CardTitle>
            <CardDescription>
              موزّع: {formatNumber(eodTotals.given)} — متبقي:{" "}
              {formatNumber(eodTotals.remaining)} — استهلاك:{" "}
              {formatNumber(eodTotals.consumed)}
            </CardDescription>
          </div>
          {profile.role === "admin" && (
            <ExportCsvButton
              filename={`end_of_day_${dateFrom}_to_${dateTo}`}
              rows={eodRows}
              columns={[
                { key: "date", header: "التاريخ" },
                { key: "team", header: "الفريق" },
                { key: "supervisor", header: "المشرف" },
                { key: "promoter_name", header: "المروّج" },
                { key: "item_name", header: "الصنف" },
                { key: "given", header: "موزّع" },
                { key: "remaining", header: "متبقي" },
                { key: "consumed", header: "استهلاك" },
              ]}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الفريق</TableHead>
                <TableHead>المشرف</TableHead>
                <TableHead>المروّج</TableHead>
                <TableHead>الصنف</TableHead>
                <TableHead className="text-left">موزّع</TableHead>
                <TableHead className="text-left">متبقي</TableHead>
                <TableHead className="text-left">استهلاك</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eodRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    لا توجد بيانات.
                  </TableCell>
                </TableRow>
              )}
              {eodRows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell dir="ltr">{r.date}</TableCell>
                  <TableCell className="text-muted-foreground">{r.team}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.supervisor}
                  </TableCell>
                  <TableCell>{r.promoter_name}</TableCell>
                  <TableCell>{r.item_name}</TableCell>
                  <TableCell className="text-left tabular-nums">
                    {formatNumber(r.given)}
                  </TableCell>
                  <TableCell className="text-left tabular-nums">
                    {formatNumber(r.remaining)}
                  </TableCell>
                  <TableCell className="text-left font-semibold tabular-nums text-emerald-700">
                    {formatNumber(r.consumed)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Per-promoter consumption */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>الاستهلاك لكل مروّج</CardTitle>
            <CardDescription>
              تجميع للفترة المختارة — مرتّب حسب الاستهلاك الأعلى
            </CardDescription>
          </div>
          {profile.role === "admin" && (
            <ExportCsvButton
              filename={`per_promoter_${dateFrom}_to_${dateTo}`}
              rows={promoterRows}
              columns={[
                { key: "promoter_name", header: "المروّج" },
                { key: "team_name", header: "الفريق" },
                { key: "supervisor_name", header: "المشرف" },
                { key: "given", header: "موزّع" },
                { key: "remaining", header: "متبقي" },
                { key: "consumed", header: "استهلاك" },
              ]}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المروّج</TableHead>
                <TableHead>الفريق</TableHead>
                <TableHead>المشرف</TableHead>
                <TableHead className="text-left">موزّع</TableHead>
                <TableHead className="text-left">متبقي</TableHead>
                <TableHead className="text-left">استهلاك</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promoterRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    لا توجد بيانات.
                  </TableCell>
                </TableRow>
              )}
              {promoterRows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">
                    {r.promoter_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.team_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.supervisor_name}
                  </TableCell>
                  <TableCell className="text-left tabular-nums">
                    {formatNumber(r.given)}
                  </TableCell>
                  <TableCell className="text-left tabular-nums">
                    {formatNumber(r.remaining)}
                  </TableCell>
                  <TableCell className="text-left font-semibold tabular-nums text-emerald-700">
                    {formatNumber(r.consumed)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
