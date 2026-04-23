import { Users, UsersRound } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PromotersSection } from "@/components/teams/promoters-section";
import type { Promoter, Supervisor, Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PromoterRow = Promoter & {
  team_name: string;
  supervisor_name: string;
};

export default async function PromotersPage() {
  const profile = await getCurrentProfile();

  if (profile.role === "supervisor") {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertTitle>
            {"\u063a\u064a\u0631 \u0645\u0635\u0631\u062d"}
          </AlertTitle>
          <AlertDescription>
            {
              "\u0647\u0630\u0647 \u0627\u0644\u0634\u0627\u0634\u0629 \u0645\u062a\u0627\u062d\u0629 \u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u0623\u0648 \u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0634\u0627\u0647\u062f\u0629 \u0641\u0642\u0637."
            }
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const canEdit = profile.role === "admin";
  const supabase = createClient();

  const [teamsRes, supervisorsRes, promotersRes] = await Promise.all([
    supabase.from("teams").select("*").order("team_name"),
    supabase
      .from("supervisors")
      .select("*, teams(team_name)")
      .order("full_name"),
    supabase
      .from("promoters")
      .select("*, teams(team_name), supervisors(full_name)")
      .order("full_name"),
  ]);

  const teams = (teamsRes.data ?? []) as Team[];
  const supervisors = ((supervisorsRes.data ?? []) as (Supervisor & {
    teams: { team_name: string } | null;
  })[]).map((supervisor) => ({
    ...supervisor,
    team_name: supervisor.teams?.team_name ?? "\u2014",
  }));

  const supervisorsBase: Supervisor[] = supervisors.map((supervisor) => {
    const { teams: _teams, team_name: _teamName, ...rest } = supervisor;
    void _teams;
    void _teamName;
    return rest;
  });

  const promoters = ((promotersRes.data ?? []) as (Promoter & {
    teams: { team_name: string } | null;
    supervisors: { full_name: string } | null;
  })[]).map((promoter) => ({
    ...promoter,
    team_name: promoter.teams?.team_name ?? "\u2014",
    supervisor_name: promoter.supervisors?.full_name ?? "\u2014",
  })) as PromoterRow[];

  const activePromoters = promoters.filter((promoter) => promoter.active).length;
  const activeTeams = new Set(
    promoters.filter((promoter) => promoter.active).map((promoter) => promoter.team_id),
  ).size;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {"\u0627\u0644\u0645\u0631\u0648\u062c\u0648\u0646"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {
            "\u0634\u0627\u0634\u0629 \u0645\u062e\u0635\u0635\u0629 \u0644\u0625\u062f\u0627\u0631\u0629 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0631\u0648\u062c\u064a\u0646 \u0648\u0631\u0628\u0637\u0647\u0645 \u0628\u0627\u0644\u0641\u0631\u0642 \u0648\u0627\u0644\u0645\u0634\u0631\u0641\u064a\u0646."
          }
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0631\u0648\u062c\u064a\u0646"}
            </CardDescription>
            <CardTitle>{promoters.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {"\u062c\u0645\u064a\u0639 \u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u0631\u0648\u062c\u064a\u0646"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"\u0627\u0644\u0645\u0631\u0648\u062c\u0648\u0646 \u0627\u0644\u0646\u0634\u0637\u0648\u0646"}
            </CardDescription>
            <CardTitle>{activePromoters}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <UsersRound className="h-4 w-4" />
            {"\u062c\u0627\u0647\u0632\u0648\u0646 \u0644\u0644\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u064a\u0648\u0645\u064a"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"\u0641\u0631\u0642 \u0641\u0639\u0627\u0644\u0629"}
            </CardDescription>
            <CardTitle>{activeTeams}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {"\u0641\u0631\u0642 \u0644\u062f\u064a\u0647\u0627 \u0645\u0631\u0648\u062c\u0648\u0646 \u0646\u0634\u0637\u0648\u0646"}
          </CardContent>
        </Card>
      </div>

      <PromotersSection
        promoters={promoters}
        teams={teams}
        supervisors={supervisorsBase}
        canEdit={canEdit}
      />
    </div>
  );
}
