"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn, formatNumber } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type {
  DailySession,
  Item,
  MorningDistributionRow,
  Promoter,
  PromoterClosingRow,
} from "@/lib/types/database";
import {
  closeSession,
  saveClosing,
  type ClosingLine,
} from "@/app/(protected)/sessions/closing/actions";

interface Props {
  session: DailySession;
  items: Item[];
  promoters: Promoter[];
  distribution: MorningDistributionRow[];
  initialClosing: PromoterClosingRow[];
  canEdit: boolean;
}

type Grid = Record<string, Record<string, string>>; // itemId -> promoterId -> raw input
type GivenMap = Record<string, Record<string, number>>; // itemId -> promoterId -> qty_given

function buildGiven(rows: MorningDistributionRow[]): GivenMap {
  const g: GivenMap = {};
  for (const r of rows) {
    g[r.item_id] = g[r.item_id] ?? {};
    g[r.item_id][r.promoter_id] = r.qty_given;
  }
  return g;
}

function buildInitialGrid(closing: PromoterClosingRow[]): Grid {
  const g: Grid = {};
  for (const r of closing) {
    g[r.item_id] = g[r.item_id] ?? {};
    g[r.item_id][r.promoter_id] = String(r.qty_remaining);
  }
  return g;
}

function parseQty(raw: string): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function ClosingMatrix({
  session,
  items,
  promoters,
  distribution,
  initialClosing,
  canEdit,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const given = React.useMemo(() => buildGiven(distribution), [distribution]);
  const [grid, setGrid] = React.useState<Grid>(() =>
    buildInitialGrid(initialClosing),
  );
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [closing, setClosing] = React.useState(false);

  // Items that have at least one distribution row > 0
  const activeItems = React.useMemo(
    () => items.filter((it) => Object.keys(given[it.id] ?? {}).length > 0),
    [items, given],
  );

  // Validation: each cell's qty_remaining must be <= qty_given
  const cellOverflow = (itemId: string, promoterId: string) => {
    const g = parseQty(grid[itemId]?.[promoterId] ?? "");
    const giv = given[itemId]?.[promoterId] ?? 0;
    return g > giv;
  };

  const hasAnyOverflow = React.useMemo(() => {
    for (const it of activeItems) {
      for (const p of promoters) {
        if (cellOverflow(it.id, p.id)) return true;
      }
    }
    return false;
  }, [activeItems, promoters, grid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count missing closing entries (cells where given>0 but no closing entered)
  const missingCount = React.useMemo(() => {
    let n = 0;
    for (const it of activeItems) {
      for (const p of promoters) {
        const giv = given[it.id]?.[p.id] ?? 0;
        if (giv > 0 && (grid[it.id]?.[p.id] ?? "") === "") n += 1;
      }
    }
    return n;
  }, [activeItems, promoters, given, grid]);

  // Per-item totals
  const itemTotals = React.useMemo(() => {
    const t: Record<string, { given: number; remaining: number; consumed: number }> = {};
    for (const it of activeItems) {
      let g = 0;
      let r = 0;
      for (const p of promoters) {
        g += given[it.id]?.[p.id] ?? 0;
        r += parseQty(grid[it.id]?.[p.id] ?? "");
      }
      t[it.id] = { given: g, remaining: r, consumed: Math.max(0, g - r) };
    }
    return t;
  }, [activeItems, promoters, given, grid]);

  const grandTotals = React.useMemo(() => {
    let g = 0,
      r = 0,
      c = 0;
    for (const it of activeItems) {
      g += itemTotals[it.id].given;
      r += itemTotals[it.id].remaining;
      c += itemTotals[it.id].consumed;
    }
    return { given: g, remaining: r, consumed: c };
  }, [activeItems, itemTotals]);

  const updateCell = (itemId: string, promoterId: string, raw: string) => {
    const cleaned = raw === "" ? "" : raw.replace(/[^\d]/g, "");
    setGrid((g) => ({
      ...g,
      [itemId]: { ...g[itemId], [promoterId]: cleaned },
    }));
    setDirty(true);
  };

  const buildLines = (): ClosingLine[] => {
    const lines: ClosingLine[] = [];
    for (const it of activeItems) {
      for (const p of promoters) {
        const giv = given[it.id]?.[p.id] ?? 0;
        if (giv <= 0) continue;
        const raw = grid[it.id]?.[p.id] ?? "";
        if (raw === "") continue; // skip blank cells
        lines.push({
          item_id: it.id,
          promoter_id: p.id,
          qty_remaining: parseQty(raw),
        });
      }
    }
    return lines;
  };

  const handleSave = async () => {
    if (!canEdit) return;
    if (hasAnyOverflow) {
      toast({
        variant: "destructive",
        title: "كميات غير صالحة",
        description: "المتبقي لا يمكن أن يتجاوز ما تم توزيعه.",
      });
      return;
    }
    setSaving(true);
    const res = await saveClosing(session.id, buildLines());
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      toast({
        variant: "success",
        title: "تم الحفظ",
        description: "تم حفظ بيانات الإغلاق.",
      });
      router.refresh();
    } else {
      toast({
        variant: "destructive",
        title: "تعذّر الحفظ",
        description: res.error,
      });
    }
  };

  const handleClose = async () => {
    if (!canEdit) return;
    if (hasAnyOverflow) {
      toast({
        variant: "destructive",
        title: "كميات غير صالحة",
        description: "صحّح الكميات قبل الإغلاق.",
      });
      return;
    }
    if (missingCount > 0) {
      toast({
        variant: "destructive",
        title: "بيانات ناقصة",
        description: `يجب إدخال المتبقي لكل ${missingCount} خانة.`,
      });
      return;
    }
    const confirmed = window.confirm(
      "سيتم إغلاق الجلسة وإرجاع الكميات المتبقية إلى المخزون. لا يمكن التراجع. هل تريد المتابعة؟",
    );
    if (!confirmed) return;

    // Save first, then close
    const saveRes = await saveClosing(session.id, buildLines());
    if (!saveRes.ok) {
      toast({
        variant: "destructive",
        title: "تعذّر الحفظ قبل الإغلاق",
        description: saveRes.error,
      });
      return;
    }
    setClosing(true);
    const res = await closeSession(session.id);
    setClosing(false);
    if (res.ok) {
      toast({
        variant: "success",
        title: "تم إغلاق الجلسة",
        description: "تم إرجاع الكميات المتبقية إلى المخزون.",
      });
      router.refresh();
    } else {
      toast({
        variant: "destructive",
        title: "تعذّر الإغلاق",
        description: res.error,
      });
    }
  };

  if (activeItems.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>لا توجد كميات موزّعة</AlertTitle>
        <AlertDescription>
          لم يتم توزيع أي صنف على المروّجين في جلسة اليوم.
        </AlertDescription>
      </Alert>
    );
  }

  const sessionClosed = session.status === "closed";

  return (
    <div className="space-y-4">
      {sessionClosed && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>الجلسة مغلقة</AlertTitle>
          <AlertDescription>
            تم إغلاق هذه الجلسة وإرجاع الكميات المتبقية إلى المخزون.
          </AlertDescription>
        </Alert>
      )}

      {!sessionClosed && hasAnyOverflow && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>المتبقي يتجاوز الموزّع</AlertTitle>
          <AlertDescription>
            بعض الخانات مدخل فيها كمية متبقية أكبر من الكمية الموزّعة. صحّحها
            قبل الإغلاق.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead className="bg-muted/50">
                <tr>
                  <th className="sticky right-0 z-20 min-w-[220px] border-b bg-muted/50 p-3 text-right font-semibold">
                    الصنف
                  </th>
                  {promoters.map((p) => (
                    <th
                      key={p.id}
                      className="min-w-[130px] border-b p-3 text-center font-semibold"
                    >
                      <div className="truncate">{p.full_name}</div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        موزّع / متبقي
                      </div>
                    </th>
                  ))}
                  <th className="border-b bg-muted p-3 text-center font-semibold">
                    موزّع
                  </th>
                  <th className="border-b bg-muted p-3 text-center font-semibold">
                    متبقي
                  </th>
                  <th className="border-b bg-muted p-3 text-center font-semibold">
                    استهلاك
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((it) => {
                  const totals = itemTotals[it.id];
                  return (
                    <tr key={it.id} className="border-b transition-colors">
                      <td className="sticky right-0 z-10 border-e bg-inherit p-3 text-right">
                        <div className="font-medium">{it.item_name}</div>
                        {it.item_code && (
                          <div className="text-xs text-muted-foreground">
                            {it.item_code}
                          </div>
                        )}
                      </td>
                      {promoters.map((p) => {
                        const giv = given[it.id]?.[p.id] ?? 0;
                        const overflow = cellOverflow(it.id, p.id);
                        if (giv <= 0) {
                          return (
                            <td
                              key={p.id}
                              className="border-e bg-muted/20 p-2 text-center text-xs text-muted-foreground"
                            >
                              —
                            </td>
                          );
                        }
                        const val = grid[it.id]?.[p.id] ?? "";
                        return (
                          <td
                            key={p.id}
                            className={cn(
                              "border-e p-2 text-center",
                              overflow && "bg-rose-50",
                            )}
                          >
                            <div className="text-[11px] text-muted-foreground">
                              {formatNumber(giv)}
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              value={val}
                              onChange={(e) =>
                                updateCell(it.id, p.id, e.target.value)
                              }
                              onFocus={(e) => e.currentTarget.select()}
                              disabled={!canEdit || sessionClosed}
                              placeholder="0"
                              className={cn(
                                "mt-1 h-9 w-20 rounded-md border bg-background px-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring",
                                "disabled:bg-muted disabled:opacity-70",
                                overflow && "border-rose-400",
                              )}
                            />
                          </td>
                        );
                      })}
                      <td className="bg-muted/40 p-3 text-center font-semibold">
                        {formatNumber(totals.given)}
                      </td>
                      <td className="p-3 text-center font-semibold">
                        {formatNumber(totals.remaining)}
                      </td>
                      <td className="p-3 text-center font-semibold text-emerald-700">
                        {formatNumber(totals.consumed)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted font-semibold">
                  <td
                    className="sticky right-0 z-10 bg-muted p-3 text-right"
                    colSpan={1}
                  >
                    الإجمالي
                  </td>
                  <td colSpan={promoters.length} />
                  <td className="p-3 text-center text-base">
                    {formatNumber(grandTotals.given)}
                  </td>
                  <td className="p-3 text-center text-base">
                    {formatNumber(grandTotals.remaining)}
                  </td>
                  <td className="p-3 text-center text-base text-emerald-700">
                    {formatNumber(grandTotals.consumed)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {!sessionClosed && canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {dirty
              ? "تغييرات غير محفوظة"
              : missingCount > 0
                ? `متبقي ${missingCount} خانة بدون إدخال`
                : "كل الخانات مكتملة"}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={handleSave}
              disabled={saving || closing}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              حفظ
            </Button>
            <Button
              onClick={handleClose}
              disabled={saving || closing || hasAnyOverflow}
            >
              {closing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              إغلاق الجلسة
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
