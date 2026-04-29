import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Info,
  PlayCircle,
  Warehouse,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionMatrixData } from "@/lib/queries/session";
import { formatDateArabic } from "@/lib/utils";
import type { Supervisor, UserProfile } from "@/lib/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DistributionMatrix } from "@/components/sessions/distribution-matrix";
import { ExtraDistribution } from "@/components/sessions/extra-distribution";
import { SupervisorSwitcher } from "@/components/sessions/supervisor-switcher";
import { CreateSessionButton } from "./create-session-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "توزيع الصباح | نظام إدارة المخزون الترويجي",
};

interface PageProps {
  searchParams: { supervisorId?: string };
}

export default async function TodaySessionPage({ searchParams }: PageProps) {
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

  if (profile.role === "viewer") {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertTitle>غير مصرّح</AlertTitle>
          <AlertDescription>
            حساب المشاهدة لا يستطيع فتح شاشات إدخال البيانات.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Admin supervisor switcher
  let supervisorList: (Supervisor & { team_name: string })[] = [];
  if (profile.role === "admin") {
    const { data: sups } = await supabase
      .from("supervisors")
      .select("*, teams(team_name)")
      .eq("active", true)
      .order("full_name");
    type SupervisorWithTeam = Supervisor & { teams: { team_name: string } | null };
    supervisorList = ((sups ?? []) as SupervisorWithTeam[]).map((s) => ({
      ...s,
      team_name: s.teams?.team_name ?? "—",
    }));
  }

  const data = await getSessionMatrixData(profile, {
    supervisorId: searchParams.supervisorId ?? null,
  });

  // --- Guard: supervisor role without link ---
  if (data.missingSupervisorLink) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertTitle>حسابك غير مرتبط بمشرف</AlertTitle>
          <AlertDescription>
            لم يتم ربط حسابك بسجلّ مشرف. تواصل مع مسؤول النظام لإكمال الإعداد.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // --- Admin without a chosen supervisor ---
  if (profile.role === "admin" && !data.supervisor) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <PageHeader today />
        <SupervisorSwitcher supervisors={supervisorList} currentId={null} />
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>اختر مشرفاً للبدء</AlertTitle>
          <AlertDescription>
            يمكنك كمدير عرض وتعديل جلسة أي مشرف من القائمة أعلاه.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { supervisor, team, session, promoters, items, stock, distribution } =
    data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader today />

      {profile.role === "admin" && (
        <SupervisorSwitcher
          supervisors={supervisorList}
          currentId={supervisor?.id ?? null}
        />
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">المشرف:</span>
              <span className="font-semibold">
                {supervisor?.full_name ?? "—"}
              </span>
            </div>
            <span className="text-muted-foreground">•</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">الفريق:</span>
              <span className="font-semibold">{team?.team_name ?? "—"}</span>
            </div>
            <span className="text-muted-foreground">•</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">المروّجون:</span>
              <Badge variant="secondary">{promoters.length}</Badge>
            </div>
          </div>

          <SessionStatusBadge status={session?.status ?? null} />
        </CardContent>
      </Card>

      {!session && supervisor && (
        <Alert>
          <PlayCircle className="h-4 w-4" />
          <AlertTitle>لم يتم بدء جلسة اليوم</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              ابدأ جلسة جديدة لتتمكن من إدخال توزيع الصباح على المروّجين.
            </span>
            <CreateSessionButton supervisorId={supervisor.id} />
          </AlertDescription>
        </Alert>
      )}

      {session && session.status === "closed" && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>الجلسة مغلقة</AlertTitle>
          <AlertDescription>
            تم إغلاق جلسة اليوم. لعرض الاستهلاك توجّه إلى صفحة التقارير.
          </AlertDescription>
        </Alert>
      )}

      {session && session.status === "morning_submitted" && (
        <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>تم إرسال التوزيع</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                الخطوة التالية: إدخال الكميات المتبقية مع كل مروّج في نهاية
                اليوم.
              </span>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={
                    profile.role === "admin" && supervisor
                      ? `/sessions/closing?supervisorId=${supervisor.id}`
                      : "/sessions/closing"
                  }
                >
                  الانتقال إلى شاشة الإغلاق
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

      {session && session.status === "morning_submitted" && (
        <ExtraDistribution
          session={session}
          promoters={promoters}
          items={items}
          stock={stock}
          distribution={distribution}
        />
      )}

      {session && (
        <DistributionMatrix
          session={session}
          items={items}
          promoters={promoters}
          stock={stock}
          initialDistribution={distribution}
        />
      )}
    </div>
  );
}

function PageHeader({ today }: { today: boolean }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">توزيع الصباح</h1>
        <p className="text-sm text-muted-foreground">
          إدخال الكميات التي سيستلمها كل مروّج لهذا اليوم
        </p>
      </div>
      {today && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {formatDateArabic(new Date())}
        </div>
      )}
    </div>
  );
}

function SessionStatusBadge({
  status,
}: {
  status: "draft" | "morning_submitted" | "closed" | null;
}) {
  if (!status) return <Badge variant="outline">لم تُفتح</Badge>;
  if (status === "draft") return <Badge variant="secondary">قيد التحضير</Badge>;
  if (status === "morning_submitted")
    return <Badge variant="warning">تم التوزيع</Badge>;
  return <Badge variant="success">مغلقة</Badge>;
}