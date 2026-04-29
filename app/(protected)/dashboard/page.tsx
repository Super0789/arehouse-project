import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/queries/dashboard";
import type { UserProfile } from "@/lib/types/database";

import { KpiCards } from "@/components/dashboard/kpi-cards";
import { SessionsStatus } from "@/components/dashboard/sessions-status";
import { SupervisorSummary } from "@/components/dashboard/supervisor-summary";
import { TopItemsChart } from "@/components/dashboard/top-items-chart";
import { ConsumptionByTeamChart } from "@/components/dashboard/consumption-by-team-chart";
import { formatDateArabic } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<UserProfile>();

  if (!profile) redirect("/login");

  const data = await getDashboardData(profile);

  const roleGreeting =
    profile.role === "admin"
      ? "نظرة عامة على كامل النظام"
      : profile.role === "supervisor"
        ? "نظرة عامة على فريقك"
        : "عرض مختصر للحركة اليومية";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            أهلاً، {profile.full_name}
          </h1>
          <p className="text-sm text-muted-foreground">{roleGreeting}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDateArabic(new Date())}
        </p>
      </div>

      <KpiCards kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SessionsStatus
            data={data.sessions}
            isAdmin={profile.role === "admin"}
          />
        </div>
        <div className="lg:col-span-2">
          <SupervisorSummary
            rows={data.supervisors}
            selfView={profile.role === "supervisor"}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopItemsChart data={data.topItems} />
        <ConsumptionByTeamChart data={data.byTeam} />
      </div>
    </div>
  );
}