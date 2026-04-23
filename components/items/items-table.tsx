"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Power, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import type { Item } from "@/lib/types/database";
import {
  createItem,
  setItemActive,
  updateItem,
  type ItemInput,
} from "@/app/(protected)/items/actions";

interface Props {
  items: Item[];
  canEdit: boolean;
}

export function ItemsTable({ items, canEdit }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [form, setForm] = React.useState<ItemInput>({
    item_name: "",
    item_code: "",
    category: "",
    unit: "pcs",
  });

  const reset = () => {
    setForm({ item_name: "", item_code: "", category: "", unit: "pcs" });
    setAdding(false);
    setEditingId(null);
  };

  const startAdd = () => {
    setEditingId(null);
    setForm({ item_name: "", item_code: "", category: "", unit: "pcs" });
    setAdding(true);
  };

  const startEdit = (it: Item) => {
    setAdding(false);
    setEditingId(it.id);
    setForm({
      item_name: it.item_name,
      item_code: it.item_code ?? "",
      category: it.category ?? "",
      unit: it.unit,
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = editingId
      ? await updateItem(editingId, form)
      : await createItem(form);
    setSubmitting(false);
    if (res.ok) {
      toast({ variant: "success", title: res.message ?? "تم" });
      reset();
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "خطأ", description: res.error });
    }
  };

  const toggleActive = async (it: Item) => {
    setBusyId(it.id);
    const res = await setItemActive(it.id, !it.active);
    setBusyId(null);
    if (res.ok) {
      toast({
        variant: "success",
        title: it.active ? "تم التعطيل" : "تم التفعيل",
      });
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "خطأ", description: res.error });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>الأصناف الترويجية</CardTitle>
        {canEdit && !adding && !editingId && (
          <Button size="sm" onClick={startAdd}>
            <Plus className="h-4 w-4" />
            إضافة صنف
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {(adding || editingId) && (
          <form
            onSubmit={onSubmit}
            className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="item_name">اسم الصنف</Label>
              <Input
                id="item_name"
                value={form.item_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, item_name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item_code">الرمز (SKU)</Label>
              <Input
                id="item_code"
                dir="ltr"
                value={form.item_code ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, item_code: e.target.value }))
                }
                placeholder="اختياري"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">الوحدة</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unit: e.target.value }))
                }
                placeholder="pcs"
                required
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="category">الفئة</Label>
              <Input
                id="category"
                value={form.category ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                placeholder="اختياري"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "حفظ" : "إضافة"}
              </Button>
              <Button type="button" variant="outline" onClick={reset}>
                <X className="h-4 w-4" />
                إلغاء
              </Button>
            </div>
          </form>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الرمز</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>الوحدة</TableHead>
              <TableHead>الحالة</TableHead>
              {canEdit && <TableHead className="text-left">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 6 : 5}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  لا توجد أصناف.
                </TableCell>
              </TableRow>
            )}
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell className="font-medium">{it.item_name}</TableCell>
                <TableCell dir="ltr" className="text-muted-foreground">
                  {it.item_code ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {it.category ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {it.unit}
                </TableCell>
                <TableCell>
                  {it.active ? (
                    <Badge variant="success">نشط</Badge>
                  ) : (
                    <Badge variant="secondary">معطّل</Badge>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell className="text-left">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(it)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={it.active ? "outline" : "secondary"}
                        onClick={() => toggleActive(it)}
                        disabled={busyId === it.id}
                      >
                        {busyId === it.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                        {it.active ? "تعطيل" : "تفعيل"}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
