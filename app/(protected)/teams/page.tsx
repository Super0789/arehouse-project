import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TeamsSection } from "@/components/teams/teams-section";
import { SupervisorsSection } from "@/components/teams/supervisors-section";
import { PromotersSection } from "@/components/teams/promoters-section";
import type { Promoter, Supervisor, Team } from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "الفرق والمروّجون | نظام إدارة المخزون الترويجي",
};

export default async function TeamsPage() {
  const profile = await getCurrentProfile();

  if (profile.role === "supervisor") {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertTitle>غير مصرّح</AlertTitle>
          <AlertDescription>
            هذه الشاشة متاحة لمدير النظام أو حساب المشاهدة فقط.
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

  type SVRow = Supervisor & { teams: { team_name: string } | null };
  const supervisors = ((supervisorsRes.data ?? []) as SVRow[]).map((s) => ({
    ...s,
    team_name: s.teams?.team_name ?? "—",
  }));

  type PRow = Promoter & {
    teams: { team_name: string } | null;
    supervisors: { full_name: string } | null;
  };
  const promoters = ((promotersRes.data ?? []) as PRow[]).map((p) => ({
    ...p,
    team_name: p.teams?.team_name ?? "—",
    supervisor_name: p.supervisors?.full_name ?? "—",
  }));

  // Strip joined fields before passing to client (they have non-Supervisor shape)
  const supervisorsBase: Supervisor[] = supervisors.map((s) => {
    const { teams: _teams, team_name: _team_name, ...rest } = s;
    void _teams;
    void _team_name;
    return rest;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          الفرق والمشرفون والمروّجون
        </h1>
        <p className="text-sm text-muted-foreground">
          إدارة فرق الترويج والمشرفين والمروّجين التابعين لكل فريق.
        </p>
      </div>

      <TeamsSection teams={teams} canEdit={canEdit} />
      <SupervisorsSection
        supervisors={supervisors}
        teams={teams}
        canEdit={canEdit}
      />
      <PromotersSection
        promoters={promoters}
        teams={teams}
        supervisors={supervisorsBase}
        canEdit={canEdit}
      />
    </div>
  );
}
