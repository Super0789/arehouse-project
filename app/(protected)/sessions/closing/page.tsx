import {
  AlertCircle,
  CalendarDays,
  Info,
  Warehouse,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getSessionMatrixData } from "@/lib/queries/session";
import { formatDateArabic } from "@/lib/utils";
import type { Supervisor } from "@/lib/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ClosingMatrix } from "@/components/sessions/closing-matrix";
import { SupervisorSwitcher } from "@/components/sessions/supervisor-switcher";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "إغلاق اليوم | نظام إدارة المخزون الترويجي",
};

interface PageProps {
  searchParams: { supervisorId?: string };
}

export default async function ClosingPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();

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

  const supabase = createClient();
  let supervisorList: (Supervisor & { team_name: string })[] = [];
  if (profile.role === "admin") {
    const { data: sups } = await supabase
      .from("supervisors")
      .select("*, teams(team_name)")
      .eq("active", true)
      .order("full_name");
    type SV = Supervisor & { teams: { team_name: string } | null };
    supervisorList = ((sups ?? []) as SV[]).map((s) => ({
      ...s,
      team_name: s.teams?.team_name ?? "—",
    }));
  }

  const data = await getSessionMatrixData(profile, {
    supervisorId: searchParams.supervisorId ?? null,
  });

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

  if (profile.role === "admin" && !data.supervisor) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <PageHeader />
        <SupervisorSwitcher supervisors={supervisorList} currentId={null} />
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>اختر مشرفاً للبدء</AlertTitle>
          <AlertDescription>
            يمكنك كمدير عرض وإغلاق جلسة أي مشرف من القائمة أعلاه.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { supervisor, team, session, promoters, items, distribution, closing } =
    data;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader />

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

      {!session && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>لا توجد جلسة لهذا اليوم</AlertTitle>
          <AlertDescription>
            ابدأ جلسة من شاشة توزيع الصباح أولاً.
          </AlertDescription>
        </Alert>
      )}

      {session && session.status === "draft" && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>لم يُرسَل التوزيع بعد</AlertTitle>
          <AlertDescription>
            يجب إرسال توزيع الصباح قبل إدخال بيانات الإغلاق.
          </AlertDescription>
        </Alert>
      )}

      {session && session.status !== "draft" && (
        <ClosingMatrix
          session={session}
          items={items}
          promoters={promoters}
          distribution={distribution}
          initialClosing={closing}
          canEdit={
            profile.role === "admin" ||
            (profile.role === "supervisor" &&
              supervisor?.id === profile.linked_supervisor_id)
          }
        />
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">إغلاق اليوم</h1>
        <p className="text-sm text-muted-foreground">
          إدخال الكميات المتبقية مع كل مروّج وإغلاق جلسة اليوم
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        {formatDateArabic(new Date())}
      </div>
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
