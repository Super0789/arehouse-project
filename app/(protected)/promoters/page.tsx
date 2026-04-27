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
            {"غير مصرح"}
          </AlertTitle>
          <AlertDescription>
            {
              "هذه الشاشة متاحة لمدير النظام أو حساب المشاهدة فقط."
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
    team_name: supervisor.teams?.team_name ?? "—",
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
    team_name: promoter.teams?.team_name ?? "—",
    supervisor_name: promoter.supervisors?.full_name ?? "—",
  })) as PromoterRow[];

  const activePromoters = promoters.filter((promoter) => promoter.active).length;
  const activeTeams = new Set(
    promoters.filter((promoter) => promoter.active).map((promoter) => promoter.team_id),
  ).size;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {"المروجون"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {
            "شاشة مخصصة لإدارة بيانات المروجين وربطهم بالفرق والمشرفين."
          }
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"إجمالي المروجين"}
            </CardDescription>
            <CardTitle>{promoters.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {"جميع سجلات المروجين"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"المروجون النشطون"}
            </CardDescription>
            <CardTitle>{activePromoters}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <UsersRound className="h-4 w-4" />
            {"جاهزون للتوزيع اليومي"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {"فرق فعالة"}
            </CardDescription>
            <CardTitle>{activeTeams}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {"فرق لديها مروجون نشطون"}
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
