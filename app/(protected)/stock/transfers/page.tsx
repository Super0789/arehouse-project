import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { TransferForm } from "@/components/stock/transfer-form";
import { formatNumber } from "@/lib/utils";
import type {
  Item,
  StockMovement,
  Supervisor,
  Team,
} from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "تحويلات المخزون | نظام إدارة المخزون الترويجي",
};

export default async function StockTransfersPage() {
  const profile = await getCurrentProfile();

  if (profile.role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertTitle>غير مصرّح</AlertTitle>
          <AlertDescription>
            هذه الشاشة متاحة لمدير النظام فقط.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const supabase = createClient();
  const [supervisorsRes, teamsRes, itemsRes, movementsRes] = await Promise.all([
    supabase.from("supervisors").select("*").eq("active", true).order("full_name"),
    supabase.from("teams").select("*"),
    supabase.from("items").select("*").eq("active", true).order("item_name"),
    supabase
      .from("stock_movements")
      .select("*")
      .in("movement_type", ["opening_stock", "adjustment"])
      .order("movement_date", { ascending: false })
      .limit(50),
  ]);

  const teams = (teamsRes.data ?? []) as Team[];
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const supervisors = ((supervisorsRes.data ?? []) as Supervisor[]).map((s) => ({
    ...s,
    team_name: teamById.get(s.team_id)?.team_name ?? "—",
  }));
  const supervisorById = new Map(supervisors.map((s) => [s.id, s]));

  const items = (itemsRes.data ?? []) as Item[];
  const itemById = new Map(items.map((i) => [i.id, i]));

  const movements = (movementsRes.data ?? []) as StockMovement[];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">تحويلات المخزون</h1>
        <p className="text-sm text-muted-foreground">
          إضافة كميات افتتاحية للمشرفين أو إجراء تعديلات. كل عملية تُسجَّل في
          السجلّ أدناه.
        </p>
      </div>

      <TransferForm supervisors={supervisors} items={items} />

      <Card>
        <CardHeader>
          <CardTitle>سجل التحويلات الأخيرة</CardTitle>
          <CardDescription>
            آخر {movements.length} عملية إضافة أو تعديل للمخزون.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>المشرف</TableHead>
                <TableHead>الصنف</TableHead>
                <TableHead className="text-left">الكمية</TableHead>
                <TableHead>ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    لا توجد تحويلات سابقة.
                  </TableCell>
                </TableRow>
              )}
              {movements.map((m) => {
                const sup = supervisorById.get(m.supervisor_id);
                const item = itemById.get(m.item_id);
                const isOpening = m.movement_type === "opening_stock";
                const date = new Date(m.movement_date);
                return (
                  <TableRow key={m.id}>
                    <TableCell dir="ltr" className="whitespace-nowrap">
                      {date.toLocaleString("ar-EG", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      {isOpening ? (
                        <Badge variant="success">إضافة افتتاحية</Badge>
                      ) : (
                        <Badge variant="warning">تعديل</Badge>
                      )}
                    </TableCell>
                    <TableCell>{sup?.full_name ?? "—"}</TableCell>
                    <TableCell>{item?.item_name ?? "—"}</TableCell>
                    <TableCell
                      className={`text-left tabular-nums font-semibold ${
                        m.qty < 0 ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {m.qty > 0 ? "+" : ""}
                      {formatNumber(m.qty)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
