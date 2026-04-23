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
import type { Supervisor, Team } from "@/lib/types/database";
import {
  createSupervisor,
  setSupervisorActive,
  updateSupervisor,
} from "@/app/(protected)/teams/actions";

interface Props {
  supervisors: (Supervisor & { team_name: string })[];
  teams: Team[];
  canEdit: boolean;
}

export function SupervisorsSection({ supervisors, teams, canEdit }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [form, setForm] = React.useState({
    full_name: "",
    team_id: "",
    phone: "",
  });

  const reset = () => {
    setForm({ full_name: "", team_id: "", phone: "" });
    setAdding(false);
    setEditingId(null);
  };

  const startAdd = () => {
    setEditingId(null);
    setForm({ full_name: "", team_id: teams[0]?.id ?? "", phone: "" });
    setAdding(true);
  };

  const startEdit = (s: Supervisor) => {
    setAdding(false);
    setEditingId(s.id);
    setForm({
      full_name: s.full_name,
      team_id: s.team_id,
      phone: s.phone ?? "",
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      full_name: form.full_name,
      team_id: form.team_id,
      phone: form.phone || null,
    };
    const res = editingId
      ? await updateSupervisor(editingId, payload)
      : await createSupervisor(payload);
    setSubmitting(false);
    if (res.ok) {
      toast({ variant: "success", title: res.message ?? "تم" });
      reset();
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "خطأ", description: res.error });
    }
  };

  const toggleActive = async (s: Supervisor) => {
    setBusyId(s.id);
    const res = await setSupervisorActive(s.id, !s.active);
    setBusyId(null);
    if (res.ok) {
      toast({ variant: "success", title: s.active ? "تم التعطيل" : "تم التفعيل" });
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "خطأ", description: res.error });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>المشرفون</CardTitle>
        {canEdit && !adding && !editingId && (
          <Button size="sm" onClick={startAdd} disabled={teams.length === 0}>
            <Plus className="h-4 w-4" />
            إضافة مشرف
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {(adding || editingId) && (
          <form
            onSubmit={onSubmit}
            className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3"
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">الاسم</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, full_name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team_id">الفريق</Label>
              <select
                id="team_id"
                value={form.team_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, team_id: e.target.value }))
                }
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— اختر الفريق —</option>
                {teams
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.team_name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">الهاتف</Label>
              <Input
                id="phone"
                dir="ltr"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="اختياري"
              />
            </div>
            <div className="flex gap-2 sm:col-span-3">
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
              <TableHead>الفريق</TableHead>
              <TableHead>الهاتف</TableHead>
              <TableHead>الحالة</TableHead>
              {canEdit && <TableHead className="text-left">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {supervisors.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 5 : 4}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  لا يوجد مشرفون.
                </TableCell>
              </TableRow>
            )}
            {supervisors.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {s.team_name}
                </TableCell>
                <TableCell dir="ltr" className="text-muted-foreground">
                  {s.phone ?? "—"}
                </TableCell>
                <TableCell>
                  {s.active ? (
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
                        onClick={() => startEdit(s)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={s.active ? "outline" : "secondary"}
                        onClick={() => toggleActive(s)}
                        disabled={busyId === s.id}
                      >
                        {busyId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                        {s.active ? "تعطيل" : "تفعيل"}
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
