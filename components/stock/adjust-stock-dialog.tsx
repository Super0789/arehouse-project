"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sliders, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { adjustStock } from "@/app/(protected)/stock/supervisors/actions";

interface Props {
  supervisorId: string;
  supervisorName: string;
  itemId: string;
  itemName: string;
  currentQty: number;
}

export function AdjustStockButton(props: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const trimmed = target.trim();
  const parsedTarget = trimmed === "" ? NaN : Number(trimmed);
  const isValidTarget =
    Number.isInteger(parsedTarget) && parsedTarget >= 0;
  const delta = isValidTarget ? parsedTarget - props.currentQty : 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTarget) {
      toast({
        variant: "destructive",
        title: "كمية غير صالحة",
        description: "أدخل عدداً صحيحاً (0 أو أكبر).",
      });
      return;
    }
    if (delta === 0) {
      toast({
        variant: "destructive",
        title: "لا يوجد تغيير",
        description: "الكمية المُدخلة مطابقة للرصيد الحالي.",
      });
      return;
    }
    setSubmitting(true);
    const res = await adjustStock({
      supervisor_id: props.supervisorId,
      item_id: props.itemId,
      qty: delta,
      reason,
    });
    setSubmitting(false);
    if (res.ok) {
      toast({ variant: "success", title: res.message ?? "تم" });
      setOpen(false);
      setTarget("");
      setReason("");
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "خطأ", description: res.error });
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sliders className="h-4 w-4" />
        تعديل
      </Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border bg-muted/40 p-3 text-right"
    >
      <div className="mb-2 text-xs text-muted-foreground">
        {props.supervisorName} — {props.itemName} (الحالي:{" "}
        <span className="font-semibold">{props.currentQty}</span>)
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`qty-${props.itemId}`}>الكمية الجديدة</Label>
          <Input
            id={`qty-${props.itemId}`}
            dir="ltr"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="مثلاً: 0 أو 25"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-32"
            required
          />
          {isValidTarget && delta !== 0 && (
            <p
              className={`text-xs ${
                delta > 0 ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {delta > 0 ? `+${delta}` : delta} عن الرصيد الحالي
            </p>
          )}
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <Label htmlFor={`reason-${props.itemId}`}>السبب</Label>
          <Input
            id={`reason-${props.itemId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={submitting || !isValidTarget || delta === 0}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            حفظ
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setOpen(false);
              setTarget("");
              setReason("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
