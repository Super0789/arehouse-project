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
import type { Team } from "@/lib/types/database";
import {
  createTeam,
  setTeamActive,
  updateTeam,
} from "@/app/(protected)/teams/actions";

interface Props {
  teams: Team[];
  canEdit: boolean;
}

export function TeamsSection({ teams, canEdit }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({ team_name: "", area: "" });
  const [submitting, setSubmitting] = React.useState(false);

  const reset = () => {
    setForm({ team_name: "", area: "" });
    setAdding(false);
    setEditingId(null);
  };

  const startAdd = () => {
    setEditingId(null);
    setForm({ team_name: "", area: "" });
    setAdding(true);
  };

  const startEdit = (t: Team) => {
    setAdding(false);
    setEditingId(t.id);
    setForm({ team_name: t.team_name, area: t.area ?? "" });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      team_name: form.team_name,
      area: form.area || null,
    };
    const res = editingId
      ? await updateTeam(editingId, payload)
      : await createTeam(payload);
    setSubmitting(false);
    if (res.ok) {
      toast({ variant: "success", title: res.message ?? "تم" });
      reset();
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "خطأ", description: res.error });
    }
  };

  const toggleActive = async (t: Team) => {
    setBusyId(t.id);
    const res = await setTeamActive(t.id, !t.active);
    setBusyId(null);
    if (res.ok) {
      toast({ variant: "success", title: t.active ? "تم التعطيل" : "تم التفعيل" });
      router.refresh();
    } else {
      toast({ variant: "destructive", title: "خطأ", description: res.error });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>الفرق</CardTitle>
        {canEdit && !adding && !editingId && (
          <Button size="sm" onClick={startAdd}>
            <Plus className="h-4 w-4" />
            إضافة فريق
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {(adding || editingId) && (
          <form
            onSubmit={onSubmit}
            className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="team_name">اسم الفريق</Label>
              <Input
                id="team_name"
                value={form.team_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, team_name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">المنطقة</Label>
              <Input
                id="area"
                value={form.area}
                onChange={(e) =>
                  setForm((f) => ({ ...f, area: e.target.value }))
                }
                placeholder="اختياري"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
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
              <TableHead>اسم الفريق</TableHead>
              <TableHead>المنطقة</TableHead>
              <TableHead>الحالة</TableHead>
              {canEdit && <TableHead className="text-left">إجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 4 : 3}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  لا توجد فرق.
                </TableCell>
              </TableRow>
            )}
            {teams.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.team_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {t.area ?? "—"}
                </TableCell>
                <TableCell>
                  {t.active ? (
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
                        onClick={() => startEdit(t)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={t.active ? "outline" : "secondary"}
                        onClick={() => toggleActive(t)}
                        disabled={busyId === t.id}
                      >
                        {busyId === t.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                        {t.active ? "تعطيل" : "تفعيل"}
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
