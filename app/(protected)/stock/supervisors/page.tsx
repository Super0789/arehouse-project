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
import { AdjustStockButton } from "@/components/stock/adjust-stock-dialog";
import { formatNumber } from "@/lib/utils";
import type {
  Item,
  Supervisor,
  SupervisorStock,
  Team,
} from "@/lib/types/database";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "مخزون المشرفين | نظام إدارة المخزون الترويجي",
};

interface PageProps {
  searchParams: { supervisorId?: string };
}

export default async function SupervisorStockPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  const supabase = createClient();

  // Determine which supervisors are visible
  const [supervisorsRes, teamsRes, itemsRes, stockRes] = await Promise.all([
    supabase.from("supervisors").select("*").order("full_name"),
    supabase.from("teams").select("*"),
    supabase.from("items").select("*").order("item_name"),
    supabase.from("supervisor_stock").select("*"),
  ]);

  const supervisors = (supervisorsRes.data ?? []) as Supervisor[];
  const teams = (teamsRes.data ?? []) as Team[];
  const items = (itemsRes.data ?? []) as Item[];
  const stockRows = (stockRes.data ?? []) as SupervisorStock[];

  const teamById = new Map(teams.map((t) => [t.id, t]));

  // Filter to visible supervisors
  let visible: Supervisor[];
  if (profile.role === "supervisor") {
    visible = supervisors.filter((s) => s.id === profile.linked_supervisor_id);
    if (visible.length === 0) {
      return (
        <div className="mx-auto max-w-2xl">
          <Alert variant="destructive">
            <AlertTitle>حسابك غير مرتبط بمشرف</AlertTitle>
            <AlertDescription>
              لا يمكن عرض المخزون. تواصل مع مسؤول النظام.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
  } else {
    visible = supervisors;
  }

  // For admin: optional filter by single supervisor
  const filterId = searchParams.supervisorId;
  const filtered =
    profile.role === "admin" && filterId
      ? visible.filter((s) => s.id === filterId)
      : visible;

  const canEdit = profile.role === "admin";
  const LOW = 10;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">مخزون المشرفين</h1>
          <p className="text-sm text-muted-foreground">
            رصيد كل مشرف من كل صنف. التعديل متاح لمدير النظام فقط.
          </p>
        </div>
        {canEdit && (
          <Link
            href="/stock/transfers"
            className="text-sm font-medium text-primary hover:underline"
          >
            + إضافة مخزون افتتاحي →
          </Link>
        )}
      </div>

      {profile.role === "admin" && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <span className="text-muted-foreground">تصفية حسب المشرف:</span>
            <Link
              href="/stock/supervisors"
              className={
                !filterId ? "font-semibold text-primary" : "text-muted-foreground hover:underline"
              }
            >
              الكل
            </Link>
            {visible
              .filter((s) => s.active)
              .map((s) => (
                <Link
                  key={s.id}
                  href={`/stock/supervisors?supervisorId=${s.id}`}
                  className={
                    filterId === s.id
                      ? "font-semibold text-primary"
                      : "text-muted-foreground hover:underline"
                  }
                >
                  {s.full_name}
                </Link>
              ))}
          </CardContent>
        </Card>
      )}

      {filtered.map((sv) => {
        const team = teamById.get(sv.team_id);
        const svStock = new Map(
          stockRows.filter((r) => r.supervisor_id === sv.id).map((r) => [r.item_id, r]),
        );
        return (
          <Card key={sv.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{sv.full_name}</CardTitle>
                  <CardDescription>
                    الفريق: {team?.team_name ?? "—"}
                  </CardDescription>
                </div>
                {!sv.active && <Badge variant="secondary">معطّل</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الصنف</TableHead>
                    <TableHead>الرمز</TableHead>
                    <TableHead className="text-left">المتوفر</TableHead>
                    {canEdit && <TableHead className="text-left">إجراء</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const row = svStock.get(it.id);
                    const qty = row?.quantity_on_hand ?? 0;
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">
                          {it.item_name}
                        </TableCell>
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
                        {canEdit && (
                          <TableCell className="text-left">
                            <AdjustStockButton
                              supervisorId={sv.id}
                              supervisorName={sv.full_name}
                              itemId={it.id}
                              itemName={it.item_name}
                              currentQty={qty}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={canEdit ? 4 : 3}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        لا توجد أصناف.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {filtered.length === 0 && (
        <Alert>
          <AlertTitle>لا توجد بيانات</AlertTitle>
          <AlertDescription>لا يوجد مشرفون مطابقون للتصفية.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
