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
import { WarehouseReceiveForm } from "@/components/stock/warehouse-receive-form";
import { formatNumber } from "@/lib/utils";
import type {
  Item,
  Supervisor,
  WarehouseMovement,
  WarehouseStock,
} from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "المخزن الرئيسي | نظام إدارة المخزون الترويجي",
};

const TYPE_LABEL = {
  received: "استلام شحنة",
  transfer_out: "تحويل لمشرف",
  adjustment: "تعديل",
} as const;

const TYPE_VARIANT = {
  received: "success",
  transfer_out: "secondary",
  adjustment: "warning",
} as const;

export default async function WarehousePage() {
  const profile = await getCurrentProfile();

  if (profile.role !== "admin" && profile.role !== "viewer") {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertTitle>غير مصرّح</AlertTitle>
          <AlertDescription>
            هذه الشاشة متاحة لمدير النظام والمراقب فقط.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const supabase = createClient();
  const [itemsRes, stockRes, movementsRes, supervisorsRes] = await Promise.all([
    supabase.from("items").select("*").eq("active", true).order("item_name"),
    supabase.from("warehouse_stock").select("*"),
    supabase
      .from("warehouse_movements")
      .select("*")
      .order("movement_date", { ascending: false })
      .limit(50),
    supabase.from("supervisors").select("*"),
  ]);

  const items = (itemsRes.data ?? []) as Item[];
  const stockRows = (stockRes.data ?? []) as WarehouseStock[];
  const movements = (movementsRes.data ?? []) as WarehouseMovement[];
  const supervisors = (supervisorsRes.data ?? []) as Supervisor[];

  const stockByItem = new Map(stockRows.map((r) => [r.item_id, r]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const supervisorById = new Map(supervisors.map((s) => [s.id, s]));

  const LOW = 20;
  const isAdmin = profile.role === "admin";

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">المخزن الرئيسي</h1>
        <p className="text-sm text-muted-foreground">
          الرصيد العام لكل صنف. تُخصم الكميات تلقائياً عند تحويلها إلى المشرفين.
        </p>
      </div>

      {isAdmin && <WarehouseReceiveForm items={items} />}

      <Card>
        <CardHeader>
          <CardTitle>الرصيد الحالي</CardTitle>
          <CardDescription>
            رصيد كل صنف في المخزن الرئيسي قبل التوزيع.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الصنف</TableHead>
                <TableHead>الرمز</TableHead>
                <TableHead className="text-left">الرصيد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    لا توجد أصناف.
                  </TableCell>
                </TableRow>
              )}
              {items.map((it) => {
                const qty = stockByItem.get(it.id)?.quantity_on_hand ?? 0;
                return (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.item_name}</TableCell>
                    <TableCell dir="ltr" className="text-muted-foreground">
                      {it.item_code ?? "—"}
                    </TableCell>
                    <TableCell className="text-left">
                      <Badge
                        variant={
                          qty === 0
                            ? "destructive"
                            : qty <= LOW
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {formatNumber(qty)} {it.unit}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل حركات المخزن الرئيسي</CardTitle>
          <CardDescription>
            آخر {movements.length} حركة على المخزن الرئيسي.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الصنف</TableHead>
                <TableHead>المشرف</TableHead>
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
                    لا توجد حركات بعد.
                  </TableCell>
                </TableRow>
              )}
              {movements.map((m) => {
                const item = itemById.get(m.item_id);
                const sup = m.supervisor_id
                  ? supervisorById.get(m.supervisor_id)
                  : null;
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
                      <Badge variant={TYPE_VARIANT[m.movement_type]}>
                        {TYPE_LABEL[m.movement_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{item?.item_name ?? "—"}</TableCell>
                    <TableCell>{sup?.full_name ?? "—"}</TableCell>
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
