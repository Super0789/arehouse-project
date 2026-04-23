"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import type { Item, Supervisor } from "@/lib/types/database";
import { transferOpeningStock } from "@/app/(protected)/stock/transfers/actions";

interface Props {
  supervisors: (Supervisor & { team_name: string })[];
  items: Item[];
}

export function TransferForm({ supervisors, items }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    supervisor_id: "",
    item_id: "",
    qty: "",
    notes: "",
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(form.qty);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      toast({
        variant: "destructive",
        title: "كمية غير صالحة",
        description: "أدخل عدداً صحيحاً موجباً.",
      });
      return;
    }
    setSubmitting(true);
    const res = await transferOpeningStock({
      supervisor_id: form.supervisor_id,
      item_id: form.item_id,
      qty: n,
      notes: form.notes || null,
    });
    setSubmitting(false);
    if (res.ok) {
      toast({ variant: "success", title: res.message ?? "تم" });
      setForm({ supervisor_id: "", item_id: "", qty: "", notes: "" });
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "خطأ", description: res.error });
    }
  };

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Card>
      <CardHeader>
        <CardTitle>تحويل مخزون إلى مشرف</CardTitle>
        <CardDescription>
          إضافة كمية افتتاحية من المخزن المركزي إلى مخزون مشرف معيّن.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1 sm:col-span-2 lg:col-span-2">
            <Label htmlFor="supervisor_id">المشرف</Label>
            <select
              id="supervisor_id"
              value={form.supervisor_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, supervisor_id: e.target.value }))
              }
              required
              className={selectClass}
            >
              <option value="">— اختر المشرف —</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} — {s.team_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="item_id">الصنف</Label>
            <select
              id="item_id"
              value={form.item_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, item_id: e.target.value }))
              }
              required
              className={selectClass}
            >
              <option value="">— اختر الصنف —</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.item_name}
                  {it.item_code ? ` (${it.item_code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="qty">الكمية</Label>
            <Input
              id="qty"
              dir="ltr"
              type="text"
              inputMode="numeric"
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1 lg:col-span-3">
            <Label htmlFor="notes">ملاحظات</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="اختياري"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              تنفيذ التحويل
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
