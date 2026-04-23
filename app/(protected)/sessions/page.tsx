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
    team_name: teamById.get(session.team_id) ?? "\u2014",
    supervisor_name: supervisorById.get(session.supervisor_id) ?? "\u2014",
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
            {"\u0633\u062c\u0644 \u0627\u0644\u062c\u0644\u0633\u0627\u062a"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {
              "\u0639\u0631\u0636 \u062c\u0644\u0633\u0627\u062a \u0627\u0644\u062a\u0648\u0632\u064a\u0639 \u0648\u0627\u0644\u0625\u063a\u0644\u0627\u0642 \u062d\u0633\u0628 \u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0648\u0627\u0644\u062d\u0627\u0644\u0629."
            }
          </p>
        </div>

        <div className="flex gap-2">
          {profile.role !== "viewer" && (
            <Button asChild>
              <Link href="/sessions/today">
                {"\u062c\u0644\u0633\u0629 \u0627\u0644\u064a\u0648\u0645"}
              </Link>
            </Button>
          )}
          {profile.role !== "viewer" && (
            <Button asChild variant="outline">
              <Link href="/sessions/closing">
                {"\u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u064a\u0648\u0645"}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          title="\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062c\u0644\u0633\u0627\u062a"
          value={summary.all}
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <SummaryCard
          title="\u0642\u064a\u062f \u0627\u0644\u062a\u062d\u0636\u064a\u0631"
          value={summary.draft}
          icon={<Filter className="h-4 w-4" />}
        />
        <SummaryCard
          title="\u062a\u0645 \u0627\u0644\u062a\u0648\u0632\u064a\u0639"
          value={summary.morningSubmitted}
          icon={<CalendarRange className="h-4 w-4" />}
        />
        <SummaryCard
          title="\u0645\u063a\u0644\u0642\u0629"
          value={summary.closed}
          icon={<ClipboardList className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {"\u062a\u0635\u0641\u064a\u0629 \u0627\u0644\u062c\u0644\u0633\u0627\u062a"}
          </CardTitle>
          <CardDescription>
            {"\u064a\u0645\u0643\u0646\u0643 \u062a\u0636\u064a\u064a\u0642 \u0627\u0644\u0646\u062a\u0627\u0626\u062c \u062d\u0633\u0628 \u0627\u0644\u062d\u0627\u0644\u0629 \u0623\u0648 \u0627\u0644\u0641\u0631\u064a\u0642 \u0623\u0648 \u0627\u0644\u0645\u0634\u0631\u0641."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FilterField
              label="\u0645\u0646 \u062a\u0627\u0631\u064a\u062e"
              name="date_from"
              type="date"
              defaultValue={dateFrom}
            />
            <FilterField
              label="\u0625\u0644\u0649 \u062a\u0627\u0631\u064a\u062e"
              name="date_to"
              type="date"
              defaultValue={dateTo}
            />

            <div className="space-y-1">
              <label htmlFor="status" className="text-sm font-medium">
                {"\u0627\u0644\u062d\u0627\u0644\u0629"}
              </label>
              <select
                id="status"
                name="status"
                defaultValue={searchParams.status ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  {"\u2014 \u0627\u0644\u0643\u0644 \u2014"}
                </option>
                <option value="draft">
                  {"\u0642\u064a\u062f \u0627\u0644\u062a\u062d\u0636\u064a\u0631"}
                </option>
                <option value="morning_submitted">
                  {"\u062a\u0645 \u0627\u0644\u062a\u0648\u0632\u064a\u0639"}
                </option>
                <option value="closed">
                  {"\u0645\u063a\u0644\u0642\u0629"}
                </option>
              </select>
            </div>

            {profile.role !== "supervisor" && (
              <div className="space-y-1">
                <label htmlFor="team_id" className="text-sm font-medium">
                  {"\u0627\u0644\u0641\u0631\u064a\u0642"}
                </label>
                <select
                  id="team_id"
                  name="team_id"
                  defaultValue={searchParams.team_id ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">
                    {"\u2014 \u0627\u0644\u0643\u0644 \u2014"}
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
                  {"\u0627\u0644\u0645\u0634\u0631\u0641"}
                </label>
                <select
                  id="supervisor_id"
                  name="supervisor_id"
                  defaultValue={searchParams.supervisor_id ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">
                    {"\u2014 \u0627\u0644\u0643\u0644 \u2014"}
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
                {"\u062a\u0637\u0628\u064a\u0642"}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/sessions">
                  {"\u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646"}
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {"\u0646\u062a\u0627\u0626\u062c \u0627\u0644\u062c\u0644\u0633\u0627\u062a"}
          </CardTitle>
          <CardDescription>
            {sessions.length}{" "}
            {"\u062c\u0644\u0633\u0629"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {"\u0627\u0644\u062a\u0627\u0631\u064a\u062e"}
                </TableHead>
                <TableHead>
                  {"\u0627\u0644\u0641\u0631\u064a\u0642"}
                </TableHead>
                <TableHead>
                  {"\u0627\u0644\u0645\u0634\u0631\u0641"}
                </TableHead>
                <TableHead>
                  {"\u0627\u0644\u062d\u0627\u0644\u0629"}
                </TableHead>
                <TableHead>
                  {"\u0627\u0644\u0625\u0646\u0634\u0627\u0621"}
                </TableHead>
                <TableHead className="text-left">
                  {"\u0625\u062c\u0631\u0627\u0621\u0627\u062a"}
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
                    {"\u0644\u0627 \u062a\u0648\u062c\u062f \u062c\u0644\u0633\u0627\u062a \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u062a\u0635\u0641\u064a\u0629."}
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
                              {"\u0627\u0644\u062a\u0648\u0632\u064a\u0639"}
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
                              {"\u0627\u0644\u0625\u063a\u0644\u0627\u0642"}
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
        {"\u062a\u062d\u062f\u064a\u062b \u0645\u0628\u0627\u0634\u0631 \u062d\u0633\u0628 \u0627\u0644\u062a\u0635\u0641\u064a\u0629"}
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
    return <Badge variant="secondary">{"\u0642\u064a\u062f \u0627\u0644\u062a\u062d\u0636\u064a\u0631"}</Badge>;
  }
  if (status === "morning_submitted") {
    return <Badge variant="warning">{"\u062a\u0645 \u0627\u0644\u062a\u0648\u0632\u064a\u0639"}</Badge>;
  }
  return <Badge variant="success">{"\u0645\u063a\u0644\u0642\u0629"}</Badge>;
}
