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
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import type { SupervisorSummaryRow } from "@/lib/queries/dashboard";

const STATUS_AR = {
  no_session: "لا توجد جلسة",
  draft: "قيد التحضير",
  morning_submitted: "تم التوزيع",
  closed: "مغلقة",
} as const;

const STATUS_VARIANT = {
  no_session: "outline",
  draft: "secondary",
  morning_submitted: "warning",
  closed: "success",
} as const;

export function SupervisorSummary({
  rows,
}: {
  rows: SupervisorSummaryRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ملخّص المشرفين اليوم</CardTitle>
        <CardDescription>
          الموزّع والمتبقي والاستهلاك لكل مشرف
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المشرف</TableHead>
              <TableHead>الفريق</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-left">الموزّع</TableHead>
              <TableHead className="text-left">المتبقي</TableHead>
              <TableHead className="text-left">الاستهلاك</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  لا توجد بيانات لعرضها.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.supervisor_id}>
                <TableCell className="font-medium">{r.supervisor_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.team_name}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.session_status]}>
                    {STATUS_AR[r.session_status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-left tabular-nums">
                  {formatNumber(r.distributed)}
                </TableCell>
                <TableCell className="text-left tabular-nums">
                  {formatNumber(r.remaining)}
                </TableCell>
                <TableCell className="text-left font-semibold tabular-nums">
                  {formatNumber(r.consumption)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}