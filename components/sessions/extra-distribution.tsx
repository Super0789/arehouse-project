"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackagePlus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { cn, formatNumber } from "@/lib/utils";
import type {
  DailySession,
  Item,
  MorningDistributionRow,
  Promoter,
} from "@/lib/types/database";
import { addExtraDistribution } from "@/app/(protected)/sessions/today/actions";

interface Props {
  session: DailySession;
  promoters: Promoter[];
  items: Item[];
  stock: Record<string, number>;
  distribution: MorningDistributionRow[];
}

export function ExtraDistribution({
  session,
  promoters,
  items,
  stock,
  distribution,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [promoterId, setPromoterId] = React.useState<string>("");
  const [itemId, setItemId] = React.useState<string>("");
  const [qty, setQty] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  const reset = () => {
    setPromoterId("");
    setItemId("");
    setQty("");
  };

  const close = () => {
    reset();
    setOpen(false);
  };

  const givenAlready = React.useMemo(() => {
    if (!promoterId || !itemId) return 0;
    const row = distribution.find(
      (d) => d.promoter_id === promoterId && d.item_id === itemId,
    );
    return row?.qty_given ?? 0;
  }, [promoterId, itemId, distribution]);

  const available = itemId ? stock[itemId] ?? 0 : 0;
  const qtyNum = qty === "" ? 0 : Math.max(0, Math.floor(Number(qty) || 0));
  const exceedsStock = qtyNum > available;

  const handleSubmit = async () => {
    if (!promoterId || !itemId) {
      toast({
        variant: "destructive",
        title: "بيانات ناقصة",
        description: "اختر المروّج والصنف.",
      });
      return;
    }
    if (qtyNum <= 0) {
      toast({
        variant: "destructive",
        title: "كمية غير صحيحة",
        description: "أدخل كمية أكبر من صفر.",
      });
      return;
    }
    if (exceedsStock) {
      toast({
        variant: "destructive",
        title: "الكمية تتجاوز المخزون",
        description: `المتوفر لديك من هذا الصنف: ${formatNumber(available)}.`,
      });
      return;
    }

    setSubmitting(true);
    const res = await addExtraDistribution(session.id, [
      { promoter_id: promoterId, item_id: itemId, qty_extra: qtyNum },
    ]);
    setSubmitting(false);

    if (res.ok) {
      toast({
        variant: "success",
        title: "تمت الإضافة",
        description: "تم تسجيل الكمية الإضافية وتحديث المخزون.",
      });
      close();
      router.refresh();
    } else {
      toast({
        variant: "destructive",
        title: "تعذّرت الإضافة",
        description: res.error,
      });
    }
  };

  if (!open) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-amber-50 p-2 text-amber-600">
              <PackagePlus className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold">إعطاء كمية إضافية</div>
              <div className="text-sm text-muted-foreground">
                إذا انتهت كمية أحد المروّجين خلال اليوم يمكنك تزويده بكمية إضافية
                هنا — يتم خصمها من مخزونك تلقائياً.
              </div>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            إضافة كمية
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">إعطاء كمية إضافية</CardTitle>
          <CardDescription>
            ستُضاف الكمية إلى ما تم توزيعه مسبقاً وتُخصم من مخزونك.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={close}
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="extra-promoter">المروّج</Label>
            <select
              id="extra-promoter"
              className={selectClass}
              value={promoterId}
              onChange={(e) => setPromoterId(e.target.value)}
              disabled={submitting}
            >
              <option value="">— اختر —</option>
              {promoters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="extra-item">الصنف</Label>
            <select
              id="extra-item"
              className={selectClass}
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              disabled={submitting}
            >
              <option value="">— اختر —</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.item_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="extra-qty">الكمية الإضافية</Label>
            <Input
              id="extra-qty"
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={qty}
              onChange={(e) =>
                setQty(e.target.value.replace(/[^\d]/g, ""))
              }
              onFocus={(e) => e.currentTarget.select()}
              placeholder="0"
              disabled={submitting}
              className={cn(exceedsStock && "border-rose-400")}
            />
          </div>
        </div>

        {itemId && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>المتوفر بمخزونك:</span>
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
            {promoterId && (
              <>
                <span>•</span>
                <span>سبق إعطاؤه لهذا المروّج:</span>
                <Badge variant="outline">{formatNumber(givenAlready)}</Badge>
              </>
            )}
          </div>
        )}

        {exceedsStock && (
          <p className="text-sm text-rose-700">
            الكمية المطلوبة تتجاوز المتوفر بمخزونك.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={submitting}>
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || exceedsStock || !promoterId || !itemId || qtyNum <= 0}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            تأكيد الإضافة
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
