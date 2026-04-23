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
            {"\u063a\u064a\u0631 \u0645\u0635\u0631\u062d"}
          </AlertTitle>
          <AlertDescription>
            {
              "\u0647\u0630\u0647 \u0627\u0644\u0634\u0627\u0634\u0629 \u0645\u062a\u0627\u062d\u0629 \u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u0641\u0642\u0637."
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
    team_name: supervisor.teams?.team_name ?? "\u2014",
  })) as SupervisorWithTeam[];

  const supervisorsById = new Map(
    supervisors.map((supervisor) => [supervisor.id, supervisor]),
  );

  const users = ((usersRes.data ?? []) as UserProfile[]).map((user) => ({
    ...user,
    team_name: user.linked_team_id
      ? teamsById.get(user.linked_team_id)?.team_name ?? "\u2014"
      : "\u2014",
    supervisor_name: user.linked_supervisor_id
      ? supervisorsById.get(user.linked_supervisor_id)?.full_name ?? "\u2014"
      : "\u2014",
  })) as UserRow[];

  const activeUsers = users.filter((user) => user.active).length;
  const supervisorUsers = users.filter((user) => user.role === "supervisor").length;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {"\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {
            "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0623\u062f\u0648\u0627\u0631 \u0648\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a \u0648\u0631\u0628\u0637 \u0627\u0644\u0645\u0634\u0631\u0641\u064a\u0646 \u0628\u062d\u0633\u0627\u0628\u0627\u062a\u0647\u0645."
          }
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a"}
            </CardDescription>
            <CardTitle>{users.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UsersRound className="h-4 w-4" />
              {"\u062c\u0645\u064a\u0639 \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0645\u0633\u062c\u0644\u0629"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"\u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0646\u0634\u0637\u0629"}
            </CardDescription>
            <CardTitle>{activeUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              {"\u062c\u0627\u0647\u0632\u0629 \u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0646\u0638\u0627\u0645"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"\u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u0645\u0634\u0631\u0641\u064a\u0646"}
            </CardDescription>
            <CardTitle>{supervisorUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCog className="h-4 w-4" />
              {"\u0628\u062d\u0627\u062c\u0629 \u0625\u0644\u0649 \u0631\u0628\u0637 \u0635\u062d\u064a\u062d"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <AlertTitle>
          {"\u0645\u0644\u0627\u062d\u0638\u0629"}
        </AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          <span>
            {
              "\u0623\u064a \u062d\u0633\u0627\u0628 \u062c\u062f\u064a\u062f \u064a\u0638\u0647\u0631 \u0647\u0646\u0627 \u0628\u0639\u062f \u0627\u0644\u062a\u0633\u062c\u064a\u0644\u060c \u0648\u064a\u0645\u0643\u0646\u0643 \u062a\u062d\u062f\u064a\u062f \u062f\u0648\u0631\u0647 \u0648\u0631\u0628\u0637\u0647 \u0628\u0641\u0631\u064a\u0642 \u0623\u0648 \u0645\u0634\u0631\u0641."
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
