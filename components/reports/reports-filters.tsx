"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  Item,
  Promoter,
  Supervisor,
  Team,
} from "@/lib/types/database";

interface Props {
  teams: Team[];
  supervisors: Supervisor[];
  promoters: Promoter[];
  items: Item[];
  showTeamFilter: boolean;
  showSupervisorFilter: boolean;
  initial: {
    date_from: string;
    date_to: string;
    team_id: string;
    supervisor_id: string;
    promoter_id: string;
    item_id: string;
  };
}

export function ReportsFilters({
  teams,
  supervisors,
  promoters,
  items,
  showTeamFilter,
  showSupervisorFilter,
  initial,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [form, setForm] = React.useState(initial);

  const updField =
    <K extends keyof typeof form>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(search.toString());
    (Object.keys(form) as (keyof typeof form)[]).forEach((k) => {
      if (form[k]) next.set(k, form[k]);
      else next.delete(k);
    });
    router.push(`?${next.toString()}`);
  };

  const onReset = () => {
    setForm({
      date_from: "",
      date_to: "",
      team_id: "",
      supervisor_id: "",
      promoter_id: "",
      item_id: "",
    });
    router.push("?");
  };

  // Cascading: if team selected, only show its supervisors and promoters
  const filteredSupervisors = form.team_id
    ? supervisors.filter((s) => s.team_id === form.team_id)
    : supervisors;
  const filteredPromoters = form.supervisor_id
    ? promoters.filter((p) => p.supervisor_id === form.supervisor_id)
    : form.team_id
      ? promoters.filter((p) => p.team_id === form.team_id)
      : promoters;

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          عوامل التصفية
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <Label htmlFor="date_from">من تاريخ</Label>
            <Input
              id="date_from"
              type="date"
              dir="ltr"
              value={form.date_from}
              onChange={updField("date_from")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date_to">إلى تاريخ</Label>
            <Input
              id="date_to"
              type="date"
              dir="ltr"
              value={form.date_to}
              onChange={updField("date_to")}
            />
          </div>

          {showTeamFilter && (
            <div className="space-y-1">
              <Label htmlFor="team_id">الفريق</Label>
              <select
                id="team_id"
                className={selectClass}
                value={form.team_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    team_id: e.target.value,
                    supervisor_id: "",
                    promoter_id: "",
                  }))
                }
              >
                <option value="">— الكل —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.team_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showSupervisorFilter && (
            <div className="space-y-1">
              <Label htmlFor="supervisor_id">المشرف</Label>
              <select
                id="supervisor_id"
                className={selectClass}
                value={form.supervisor_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    supervisor_id: e.target.value,
                    promoter_id: "",
                  }))
                }
              >
                <option value="">— الكل —</option>
                {filteredSupervisors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="promoter_id">المروّج</Label>
            <select
              id="promoter_id"
              className={selectClass}
              value={form.promoter_id}
              onChange={updField("promoter_id")}
            >
              <option value="">— الكل —</option>
              {filteredPromoters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="item_id">الصنف</Label>
            <select
              id="item_id"
              className={selectClass}
              value={form.item_id}
              onChange={updField("item_id")}
            >
              <option value="">— الكل —</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.item_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit">
              <Filter className="h-4 w-4" />
              تطبيق
            </Button>
            <Button type="button" variant="outline" onClick={onReset}>
              <RefreshCw className="h-4 w-4" />
              إعادة تعيين
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
