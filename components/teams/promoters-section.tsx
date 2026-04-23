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
import type { Promoter, Supervisor, Team } from "@/lib/types/database";
import {
  createPromoter,
  setPromoterActive,
  updatePromoter,
} from "@/app/(protected)/teams/actions";

interface Props {
  promoters: (Promoter & { team_name: string; supervisor_name: string })[];
  teams: Team[];
  supervisors: Supervisor[];
  canEdit: boolean;
}

export function PromotersSection({
  promoters,
  teams,
  supervisors,
  canEdit,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [form, setForm] = React.useState({
    full_name: "",
    team_id: "",
    supervisor_id: "",
  });

  // Filter supervisors by selected team
  const teamSupervisors = React.useMemo(
    () => supervisors.filter((s) => s.active && s.team_id === form.team_id),
    [supervisors, form.team_id],
  );

  // Auto-pick supervisor when team changes (and current one is invalid)
  React.useEffect(() => {
    if (
      form.team_id &&
      form.supervisor_id &&
      !teamSupervisors.some((s) => s.id === form.supervisor_id)
    ) {
      setForm((f) => ({ ...f, supervisor_id: teamSupervisors[0]?.id ?? "" }));
    }
  }, [form.team_id, form.supervisor_id, teamSupervisors]);

  const reset = () => {
    setForm({ full_name: "", team_id: "", supervisor_id: "" });
    setAdding(false);
    setEditingId(null);
  };

  const startAdd = () => {
    setEditingId(null);
    setForm({ full_name: "", team_id: "", supervisor_id: "" });
    setAdding(true);
  };

  const startEdit = (p: Promoter) => {
    setAdding(false);
    setEditingId(p.id);
    setForm({
      full_name: p.full_name,
      team_id: p.team_id,
      supervisor_id: p.supervisor_id,
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      full_name: form.full_name,
      team_id: form.team_id,
      supervisor_id: form.supervisor_id,
    };
    const res = editingId
      ? await updatePromoter(editingId, payload)
      : await createPromoter(payload);
    setSubmitting(false);
    if (res.ok) {
      toast({ variant: "success", title: res.message ?? "تم" });
      reset();
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "خطأ", description: res.error });
    }
  };

  const toggleActive = async (p: Promoter) => {
    setBusyId(p.id);
    const res = await setPromoterActive(p.id, !p.active);
    setBusyId(null);
    if (res.ok) {
      toast({ variant: "success", title: p.active ? "تم التعطيل" : "تم التفعيل" });
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "خطأ", description: res.error });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>المروّجون</CardTitle>
        {canEdit && !adding && !editingId && (
          <Button
            size="sm"
            onClick={startAdd}
            disabled={teams.length === 0 || supervisors.length === 0}
          >
            <Plus className="h-4 w-4" />
            إضافة مروّج
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
              <Label htmlFor="p_full_name">الاسم</Label>
              <Input
                id="p_full_name"
                value={form.full_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, full_name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p_team_id">الفريق</Label>
              <select
                id="p_team_id"
                value={form.team_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    team_id: e.target.value,
                    supervisor_id: "",
                  }))
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
              <Label htmlFor="p_supervisor_id">المشرف</Label>
              <select
                id="p_supervisor_id"
                value={form.supervisor_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, supervisor_id: e.target.value }))
                }
                required
                disabled={!form.team_id}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">— اختر المشرف —</option>
                {teamSupervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
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
              <TableHead>المشرف</TableHead>
              <TableHead>الحالة</TableHead>
              {canEdit && <TableHead className="text-left">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {promoters.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 5 : 4}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  لا يوجد مروّجون.
                </TableCell>
              </TableRow>
            )}
            {promoters.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.team_name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.supervisor_name}
                </TableCell>
                <TableCell>
                  {p.active ? (
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
                        onClick={() => startEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={p.active ? "outline" : "secondary"}
                        onClick={() => toggleActive(p)}
                        disabled={busyId === p.id}
                      >
                        {busyId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                        {p.active ? "تعطيل" : "تفعيل"}
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
