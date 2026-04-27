import Link from "next/link";
import { CalendarRange, ClipboardList, Filter } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { DailySession, Supervisor, Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  searchParams: {
    date_from?: string;
    date_to?: string;
    status?: string;
    team_id?: string;
    supervisor_id?: string;
  };
}

type SessionRow = DailySession & {
  team_name: string;
  supervisor_name: string;
};

export default async function SessionsPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  const dateFrom = searchParams.date_from || todayISO();
  const dateTo = searchParams.date_to || todayISO();

  const [teamsRes, supervisorsRes] = await Promise.all([
    supabase.from("teams").select("*").order("team_name"),
    supabase.from("supervisors").select("*").order("full_name"),
  ]);

  const teams = (teamsRes.data ?? []) as Team[];
  const supervisors = (supervisorsRes.data ?? []) as Supervisor[];
  const teamById = new Map(teams.map((team) => [team.id, team.team_name]));
  const supervisorById = new Map(
    supervisors.map((supervisor) => [supervisor.id, supervisor.full_name]),
  );

  let sessionsQuery = supabase
    .from("daily_sessions")
    .select("*")
    .gte("session_date", dateFrom)
    .lte("session_date", dateTo)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (searchParams.status) {
    sessionsQuery = sessionsQuery.eq("status", searchParams.status);
  }
  if (searchParams.team_id) {
    sessionsQuery = sessionsQuery.eq("team_id", searchParams.team_id);
  }
  if (searchParams.supervisor_id) {
    sessionsQuery = sessionsQuery.eq("supervisor_id", searchParams.supervisor_id);
  }

  const { data } = await sessionsQuery;

  const sessions = ((data ?? []) as DailySession[]).map((session) => ({
    ...session,
    team_name: teamById.get(session.team_id) ?? "—",
    supervisor_name: supervisorById.get(session.supervisor_id) ?? "—",
  })) as SessionRow[];

  const summary = {
    all: sessions.length,
    draft: sessions.filter((session) => session.status === "draft").length,
    morningSubmitted: sessions.filter(
      (session) => session.status === "morning_submitted",
    ).length,
    closed: sessions.filter((session) => session.status === "closed").length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {"سجل الجلسات"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {
              "عرض جلسات التوزيع والإغلاق حسب التاريخ والحالة."
            }
          </p>
        </div>

        <div className="flex gap-2">
          {profile.role !== "viewer" && (
            <Button asChild>
              <Link href="/sessions/today">
                {"جلسة اليوم"}
              </Link>
            </Button>
          )}
          {profile.role !== "viewer" && (
            <Button asChild variant="outline">
              <Link href="/sessions/closing">
                {"إغلاق اليوم"}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          title="إجمالي الجلسات"
          value={summary.all}
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <SummaryCard
          title="قيد التحضير"
          value={summary.draft}
          icon={<Filter className="h-4 w-4" />}
        />
        <SummaryCard
          title="تم التوزيع"
          value={summary.morningSubmitted}
          icon={<CalendarRange className="h-4 w-4" />}
        />
        <SummaryCard
          title="مغلقة"
          value={summary.closed}
          icon={<ClipboardList className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {"تصفية الجلسات"}
          </CardTitle>
          <CardDescription>
            {"يمكنك تضييق النتائج حسب الحالة أو الفريق أو المشرف."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FilterField
              label="من تاريخ"
              name="date_from"
              type="date"
              defaultValue={dateFrom}
            />
            <FilterField
              label="إلى تاريخ"
              name="date_to"
              type="date"
              defaultValue={dateTo}
            />

            <div className="space-y-1">
              <label htmlFor="status" className="text-sm font-medium">
                {"الحالة"}
              </label>
              <select
                id="status"
                name="status"
                defaultValue={searchParams.status ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  {"— الكل —"}
                </option>
                <option value="draft">
                  {"قيد التحضير"}
                </option>
                <option value="morning_submitted">
                  {"تم التوزيع"}
                </option>
                <option value="closed">
                  {"مغلقة"}
                </option>
              </select>
            </div>

            {profile.role !== "supervisor" && (
              <div className="space-y-1">
                <label htmlFor="team_id" className="text-sm font-medium">
                  {"الفريق"}
                </label>
                <select
                  id="team_id"
                  name="team_id"
                  defaultValue={searchParams.team_id ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">
                    {"— الكل —"}
                  </option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {profile.role !== "supervisor" && (
              <div className="space-y-1">
                <label htmlFor="supervisor_id" className="text-sm font-medium">
                  {"المشرف"}
                </label>
                <select
                  id="supervisor_id"
                  name="supervisor_id"
                  defaultValue={searchParams.supervisor_id ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">
                    {"— الكل —"}
                  </option>
                  {supervisors.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
              <Button type="submit">
                {"تطبيق"}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/sessions">
                  {"إعادة تعيين"}
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {"نتائج الجلسات"}
          </CardTitle>
          <CardDescription>
            {sessions.length}{" "}
            {"جلسة"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {"التاريخ"}
                </TableHead>
                <TableHead>
                  {"الفريق"}
                </TableHead>
                <TableHead>
                  {"المشرف"}
                </TableHead>
                <TableHead>
                  {"الحالة"}
                </TableHead>
                <TableHead>
                  {"الإنشاء"}
                </TableHead>
                <TableHead className="text-left">
                  {"إجراءات"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    {"لا توجد جلسات مطابقة للتصفية."}
                  </TableCell>
                </TableRow>
              )}
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell dir="ltr">{session.session_date}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {session.team_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {session.supervisor_name}
                  </TableCell>
                  <TableCell>{statusBadge(session.status)}</TableCell>
                  <TableCell dir="ltr" className="text-muted-foreground">
                    {new Date(session.created_at).toLocaleDateString("en-CA")}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex justify-end gap-2">
                      {session.session_date === todayISO() && profile.role !== "viewer" && (
                        <>
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={
                                profile.role === "admin"
                                  ? `/sessions/today?supervisorId=${session.supervisor_id}`
                                  : "/sessions/today"
                              }
                            >
                              {"التوزيع"}
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link
                              href={
                                profile.role === "admin"
                                  ? `/sessions/closing?supervisorId=${session.supervisor_id}`
                                  : "/sessions/closing"
                              }
                            >
                              {"الإغلاق"}
                            </Link>
                          </Button>
                        </>
                      )}
                    </div>
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

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {"تحديث مباشر حسب التصفية"}
      </CardContent>
    </Card>
  );
}

function FilterField({
  label,
  name,
  type,
  defaultValue,
}: {
  label: string;
  name: string;
  type: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        dir="ltr"
        defaultValue={defaultValue}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function statusBadge(status: DailySession["status"]) {
  if (status === "draft") {
    return <Badge variant="secondary">{"قيد التحضير"}</Badge>;
  }
  if (status === "morning_submitted") {
    return <Badge variant="warning">{"تم التوزيع"}</Badge>;
  }
  return <Badge variant="success">{"مغلقة"}</Badge>;
}
