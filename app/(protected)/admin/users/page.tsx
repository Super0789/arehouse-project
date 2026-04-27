import { ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsersSection } from "@/components/admin/users-section";
import type { Supervisor, Team, UserProfile } from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SupervisorWithTeam = Supervisor & {
  team_name: string;
};

type UserRow = UserProfile & {
  team_name: string;
  supervisor_name: string;
};

export default async function AdminUsersPage() {
  const profile = await getCurrentProfile();

  if (profile.role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertTitle>
            {"غير مصرح"}
          </AlertTitle>
          <AlertDescription>
            {
              "هذه الشاشة متاحة لمدير النظام فقط."
            }
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const supabase = createClient();
  const [usersRes, teamsRes, supervisorsRes] = await Promise.all([
    supabase.from("user_profiles").select("*").order("created_at"),
    supabase.from("teams").select("*").order("team_name"),
    supabase
      .from("supervisors")
      .select("*, teams(team_name)")
      .order("full_name"),
  ]);

  const teams = (teamsRes.data ?? []) as Team[];
  const teamsById = new Map(teams.map((team) => [team.id, team]));

  const supervisors = ((supervisorsRes.data ?? []) as (Supervisor & {
    teams: { team_name: string } | null;
  })[]).map((supervisor) => ({
    ...supervisor,
    team_name: supervisor.teams?.team_name ?? "—",
  })) as SupervisorWithTeam[];

  const supervisorsById = new Map(
    supervisors.map((supervisor) => [supervisor.id, supervisor]),
  );

  const users = ((usersRes.data ?? []) as UserProfile[]).map((user) => ({
    ...user,
    team_name: user.linked_team_id
      ? teamsById.get(user.linked_team_id)?.team_name ?? "—"
      : "—",
    supervisor_name: user.linked_supervisor_id
      ? supervisorsById.get(user.linked_supervisor_id)?.full_name ?? "—"
      : "—",
  })) as UserRow[];

  const activeUsers = users.filter((user) => user.active).length;
  const supervisorUsers = users.filter((user) => user.role === "supervisor").length;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {"إدارة المستخدمين"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {
            "تعديل الأدوار وتفعيل الحسابات وربط المشرفين بحساباتهم."
          }
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"إجمالي الحسابات"}
            </CardDescription>
            <CardTitle>{users.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UsersRound className="h-4 w-4" />
              {"جميع الحسابات المسجلة"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"الحسابات النشطة"}
            </CardDescription>
            <CardTitle>{activeUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              {"جاهزة لاستخدام النظام"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"حسابات المشرفين"}
            </CardDescription>
            <CardTitle>{supervisorUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCog className="h-4 w-4" />
              {"بحاجة إلى ربط صحيح"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <AlertTitle>
          {"ملاحظة"}
        </AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          <span>
            {
              "أي حساب جديد يظهر هنا بعد التسجيل، ويمكنك تحديد دوره وربطه بفريق أو مشرف."
            }
          </span>
          <Badge variant="outline">
            {"user_profiles"}
          </Badge>
        </AlertDescription>
      </Alert>

      <UsersSection
        users={users}
        teams={teams.map((team) => ({
          id: team.id,
          team_name: team.team_name,
          active: team.active,
        }))}
        supervisors={supervisors.map((supervisor) => ({
          id: supervisor.id,
          full_name: supervisor.full_name,
          team_id: supervisor.team_id,
          team_name: supervisor.team_name,
          active: supervisor.active,
        }))}
      />
    </div>
  );
}
