"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  Send,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type {
  DailySession,
  Item,
  MorningDistributionRow,
  Promoter,
} from "@/lib/types/database";
import {
  saveDraftDistribution,
  submitDistribution,
  type DistributionLine,
} from "@/app/(protected)/sessions/today/actions";

interface Props {
  session: DailySession;
  items: Item[];
  promoters: Promoter[];
  stock: Record<string, number>;
  initialDistribution: MorningDistributionRow[];
  readOnly?: boolean;
}

type Grid = Record<string, Record<string, string>>; // itemId -> promoterId -> raw input

function buildInitialGrid(
  items: Item[],
  promoters: Promoter[],
  rows: MorningDistributionRow[],
): Grid {
  const g: Grid = {};
  for (const it of items) {
    g[it.id] = {};
    for (const p of promoters) g[it.id][p.id] = "";
  }
  for (const r of rows) {
    if (g[r.item_id] && g[r.item_id][r.promoter_id] !== undefined) {
      g[r.item_id][r.promoter_id] = String(r.qty_given);
    }
  }
  return g;
}

function parseQty(raw: string): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function DistributionMatrix({
  session,
  items,
  promoters,
  stock,
  initialDistribution,
  readOnly: forcedReadOnly,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const readOnly =
    forcedReadOnly ||
    session.status === "morning_submitted" ||
    session.status === "closed";

  const [grid, setGrid] = React.useState<Grid>(() =>
    buildInitialGrid(items, promoters, initialDistribution),
  );
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Refs for keyboard nav. Shape: refs.current[itemIdx][promoterIdx]
  const refs = React.useRef<Array<Array<HTMLInputElement | null>>>([]);
  refs.current = items.map(
    (_, i) => refs.current[i] ?? Array(promoters.length).fill(null),
  );

  // --- derived totals ---
  const itemTotals: Record<string, number> = React.useMemo(() => {
    const t: Record<string, number> = {};
    for (const it of items) {
      let sum = 0;
      for (const p of promoters) sum += parseQty(grid[it.id]?.[p.id] ?? "");
      t[it.id] = sum;
    }
    return t;
  }, [grid, items, promoters]);

  const promoterTotals: Record<string, number> = React.useMemo(() => {
    const t: Record<string, number> = {};
    for (const p of promoters) {
      let sum = 0;
      for (const it of items) sum += parseQty(grid[it.id]?.[p.id] ?? "");
      t[p.id] = sum;
    }
    return t;
  }, [grid, items, promoters]);

  const itemOverflow: Record<string, boolean> = React.useMemo(() => {
    const r: Record<string, boolean> = {};
    for (const it of items) {
      r[it.id] = itemTotals[it.id] > (stock[it.id] ?? 0);
    }
    return r;
  }, [itemTotals, items, stock]);

  const hasAnyOverflow = Object.values(itemOverflow).some(Boolean);
  const totalDistributed = Object.values(itemTotals).reduce((a, b) => a + b, 0);

  // --- handlers ---
  const updateCell = (itemId: string, promoterId: string, raw: string) => {
    // Allow empty, otherwise strip non-digits
    const cleaned = raw === "" ? "" : raw.replace(/[^\d]/g, "");
    setGrid((g) => ({
      ...g,
      [itemId]: { ...g[itemId], [promoterId]: cleaned },
    }));
    setDirty(true);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    itemIdx: number,
    promoterIdx: number,
  ) => {
    const move = (di: number, dp: number) => {
      const ni = itemIdx + di;
      const np = promoterIdx + dp;
      const target = refs.current[ni]?.[np];
      if (target) {
        e.preventDefault();
        target.focus();
        target.select();
      }
    };
    // RTL note: visually "left" == promoterIdx+1 because the column header
    // for promoter #0 is rendered on the right side. Since Tab naturally
    // moves through DOM order and our DOM order is promoter[0]..promoter[n-1],
    // we rely on that for Tab. Arrow keys we map logically.
    switch (e.key) {
      case "ArrowDown":
      case "Enter":
        move(1, 0);
        break;
      case "ArrowUp":
        move(-1, 0);
        break;
      case "ArrowLeft":
        // In RTL, ArrowLeft -> next DOM sibling
        move(0, 1);
        break;
      case "ArrowRight":
        move(0, -1);
        break;
    }
  };

  const buildLines = (): DistributionLine[] => {
    const lines: DistributionLine[] = [];
    for (const it of items) {
      for (const p of promoters) {
        const q = parseQty(grid[it.id]?.[p.id] ?? "");
        if (q > 0) lines.push({ item_id: it.id, promoter_id: p.id, qty_given: q });
      }
    }
    return lines;
  };

  const handleSaveDraft = async () => {
    if (readOnly) return;
    setSaving(true);
    const res = await saveDraftDistribution(session.id, buildLines());
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      toast({
        variant: "success",
        title: "تم الحفظ",
        description: "تم حفظ المسودّة. يمكنك الإرسال لاحقاً.",
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

  const handleSubmit = async () => {
    if (readOnly) return;
    if (hasAnyOverflow) {
      toast({
        variant: "destructive",
        title: "الكميات تتجاوز المخزون",
        description: "راجع الصفوف المظلّلة بالأحمر قبل الإرسال.",
      });
      return;
    }
    const lines = buildLines();
    if (lines.length === 0) {
      toast({
        variant: "destructive",
        title: "لا يوجد ما يُرسل",
        description: "أدخل كمية واحدة على الأقل قبل الإرسال.",
      });
      return;
    }

    const confirmed = window.confirm(
      `سيتم إرسال ${lines.length} سطر توزيع بإجمالي ${formatNumber(totalDistributed)} قطعة. لن يمكن تعديل التوزيع بعد الإرسال. المتابعة؟`,
    );
    if (!confirmed) return;

    setSubmitting(true);
    const res = await submitDistribution(session.id, lines);
    setSubmitting(false);
    if (res.ok) {
      toast({
        variant: "success",
        title: "تم الإرسال",
        description: "تم تحديث المخزون وتحويل الجلسة إلى مرحلة الإغلاق.",
      });
      router.refresh();
    } else {
      toast({
        variant: "destructive",
        title: "تعذّر الإرسال",
        description: res.error,
      });
    }
  };

  const handleReset = () => {
    if (readOnly) return;
    setGrid(buildInitialGrid(items, promoters, initialDistribution));
    setDirty(false);
  };

  // --- render ---
  if (items.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>لا توجد أصناف مفعّلة</AlertTitle>
        <AlertDescription>
          تواصل مع مسؤول النظام لإضافة أو تفعيل الأصناف قبل بدء التوزيع.
        </AlertDescription>
      </Alert>
    );
  }

  if (promoters.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>لا يوجد مروّجون في فريقك</AlertTitle>
        <AlertDescription>
          يجب إضافة مروّجين إلى الفريق قبل بدء التوزيع.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {readOnly && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>التوزيع مُرسَل</AlertTitle>
          <AlertDescription>
            تم إرسال التوزيع ولا يمكن تعديله. توجّه إلى شاشة الإغلاق لإدخال
            الكميات المتبقية في نهاية اليوم.
          </AlertDescription>
        </Alert>
      )}

      {!readOnly && hasAnyOverflow && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>الكميات تتجاوز المخزون المتوفر</AlertTitle>
          <AlertDescription>
            الصفوف المظلّلة بالأحمر يتجاوز مجموعها ما هو متوفر لديك في المخزون.
            قلّل الكميات قبل الإرسال.
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
                  <th className="border-b p-3 text-center font-semibold">
                    المتوفر
                  </th>
                  {promoters.map((p) => (
                    <th
                      key={p.id}
                      className="min-w-[110px] border-b p-3 text-center font-semibold"
                    >
                      <div className="truncate">{p.full_name}</div>
                    </th>
                  ))}
                  <th className="border-b bg-muted p-3 text-center font-semibold">
                    الإجمالي
                  </th>
                  <th className="border-b bg-muted p-3 text-center font-semibold">
                    المتبقي بعد التوزيع
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, itemIdx) => {
                  const total = itemTotals[it.id];
                  const available = stock[it.id] ?? 0;
                  const remaining = available - total;
                  const overflow = itemOverflow[it.id];
                  return (
                    <tr
                      key={it.id}
                      className={cn(
                        "border-b transition-colors",
                        overflow && "bg-rose-50",
                      )}
                    >
                      <td className="sticky right-0 z-10 border-e bg-inherit p-3 text-right">
                        <div className="font-medium">{it.item_name}</div>
                        {it.item_code && (
                          <div className="text-xs text-muted-foreground">
                            {it.item_code}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={
                            available === 0
                              ? "destructive"
                              : available <= 10
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {formatNumber(available)}
                        </Badge>
                      </td>
                      {promoters.map((p, promoterIdx) => {
                        const val = grid[it.id]?.[p.id] ?? "";
                        return (
                          <td
                            key={p.id}
                            className="border-e p-2 text-center"
                          >
                            <input
                              ref={(el) => {
                                refs.current[itemIdx][promoterIdx] = el;
                              }}
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              value={val}
                              onChange={(e) =>
                                updateCell(it.id, p.id, e.target.value)
                              }
                              onFocus={(e) => e.currentTarget.select()}
                              onKeyDown={(e) =>
                                handleKeyDown(e, itemIdx, promoterIdx)
                              }
                              disabled={readOnly}
                              placeholder="0"
                              className={cn(
                                "h-9 w-20 rounded-md border bg-background px-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-ring",
                                "disabled:bg-muted disabled:opacity-70",
                                overflow && "border-rose-400",
                              )}
                            />
                          </td>
                        );
                      })}
                      <td
                        className={cn(
                          "bg-muted/40 p-3 text-center font-semibold",
                          overflow && "text-rose-700",
                        )}
                      >
                        {formatNumber(total)}
                      </td>
                      <td
                        className={cn(
                          "p-3 text-center font-semibold",
                          remaining < 0
                            ? "text-rose-700"
                            : remaining === 0
                              ? "text-muted-foreground"
                              : "text-emerald-700",
                        )}
                      >
                        {formatNumber(remaining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted font-semibold">
                  <td className="sticky right-0 z-10 bg-muted p-3 text-right">
                    إجمالي المروّج
                  </td>
                  <td />
                  {promoters.map((p) => (
                    <td key={p.id} className="p-3 text-center">
                      {formatNumber(promoterTotals[p.id])}
                    </td>
                  ))}
                  <td className="p-3 text-center text-base">
                    {formatNumber(totalDistributed)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {dirty
              ? "تغييرات غير محفوظة"
              : "لا توجد تغييرات غير محفوظة"}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!dirty || saving || submitting}
            >
              <RotateCcw className="h-4 w-4" />
              تراجع
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={saving || submitting}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              حفظ كمسودّة
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || submitting || hasAnyOverflow}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              إرسال التوزيع
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}