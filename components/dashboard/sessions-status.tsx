import { AlertCircle, CheckCircle2, CircleDot, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { SessionsStatus as SessionsStatusType } from "@/lib/queries/dashboard";

export function SessionsStatus({ data }: { data: SessionsStatusType }) {
  const open = data.draft + data.morningSubmitted;
  const totalWithSession = data.totalTeams - data.teamsWithoutSession.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>حالة جلسات اليوم</CardTitle>
        <CardDescription>
          {totalWithSession} من {data.totalTeams} فرق بدأت جلسة اليوم
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <StatBox
            label="قيد التحضير"
            value={data.draft}
            icon={CircleDot}
            tone="text-slate-600 bg-slate-100"
          />
          <StatBox
            label="تم التوزيع"
            value={data.morningSubmitted}
            icon={Clock}
            tone="text-amber-600 bg-amber-50"
          />
          <StatBox
            label="مغلقة"
            value={data.closed}
            icon={CheckCircle2}
            tone="text-emerald-600 bg-emerald-50"
          />
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">الجلسات المفتوحة</span>
            <Badge variant="secondary">{open}</Badge>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">المغلقة</span>
            <Badge variant="default">{data.closed}</Badge>
          </div>
        </div>

        {data.teamsWithoutSession.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>فرق لم تبدأ جلسة اليوم</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 flex flex-wrap gap-2">
                {data.teamsWithoutSession.map((t) => (
                  <li key={t.team_id}>
                    <Badge variant="outline">{t.team_name}</Badge>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {data.teamsWithoutSession.length === 0 && data.totalTeams > 0 && (
          <Alert variant="default">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              جميع الفرق لديها جلسة لهذا اليوم.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div
        className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md ${tone}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}