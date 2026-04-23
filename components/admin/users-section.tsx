"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Power, X } from "lucide-react";
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
import type { UserProfile, UserRole } from "@/lib/types/database";
import { setUserProfileActive, updateUserProfile } from "@/app/(protected)/admin/users/actions";

type SupervisorOption = {
  id: string;
  full_name: string;
  team_id: string;
  team_name: string;
  active: boolean;
};

type TeamOption = {
  id: string;
  team_name: string;
  active: boolean;
};

type UserRow = UserProfile & {
  team_name: string;
  supervisor_name: string;
};

interface Props {
  users: UserRow[];
  teams: TeamOption[];
  supervisors: SupervisorOption[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "\u0645\u062f\u064a\u0631",
  supervisor: "\u0645\u0634\u0631\u0641",
  viewer: "\u0645\u0634\u0627\u0647\u062f",
};

export function UsersSection({ users, teams, supervisors }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState<{
    full_name: string;
    role: UserRole;
    linked_supervisor_id: string;
    linked_team_id: string;
  }>({
    full_name: "",
    role: "viewer",
    linked_supervisor_id: "",
    linked_team_id: "",
  });

  const reset = () => {
    setEditingId(null);
    setForm({
      full_name: "",
      role: "viewer",
      linked_supervisor_id: "",
      linked_team_id: "",
    });
  };

  const startEdit = (user: UserRow) => {
    setEditingId(user.id);
    setForm({
      full_name: user.full_name,
      role: user.role,
      linked_supervisor_id: user.linked_supervisor_id ?? "",
      linked_team_id: user.linked_team_id ?? "",
    });
  };

  const selectedSupervisor = supervisors.find(
    (supervisor) => supervisor.id === form.linked_supervisor_id,
  );

  const availableSupervisors = React.useMemo(() => {
    if (!form.linked_team_id) return supervisors.filter((supervisor) => supervisor.active);
    return supervisors.filter(
      (supervisor) =>
        supervisor.active && supervisor.team_id === form.linked_team_id,
    );
  }, [form.linked_team_id, supervisors]);

  React.useEffect(() => {
    if (!selectedSupervisor) return;
    if (form.linked_team_id !== selectedSupervisor.team_id) {
      setForm((current) => ({
        ...current,
        linked_team_id: selectedSupervisor.team_id,
      }));
    }
  }, [selectedSupervisor, form.linked_team_id]);

  React.useEffect(() => {
    if (!form.linked_supervisor_id) return;
    const stillValid = availableSupervisors.some(
      (supervisor) => supervisor.id === form.linked_supervisor_id,
    );
    if (!stillValid) {
      setForm((current) => ({ ...current, linked_supervisor_id: "" }));
    }
  }, [availableSupervisors, form.linked_supervisor_id]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    setSubmitting(true);
    const result = await updateUserProfile(editingId, {
      full_name: form.full_name,
      role: form.role,
      linked_supervisor_id: form.linked_supervisor_id || null,
      linked_team_id: form.linked_team_id || null,
    });
    setSubmitting(false);
    if (result.ok) {
      toast({
        variant: "success",
        title: "\u062a\u0645 \u062d\u0641\u0638 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645",
      });
      reset();
      router.refresh();
    } else {
      toast({
        variant: "destructive",
        title: "\u062e\u0637\u0623",
        description: result.error,
      });
    }
  };

  const toggleActive = async (user: UserRow) => {
    setBusyId(user.id);
    const result = await setUserProfileActive(user.id, !user.active);
    setBusyId(null);
    if (result.ok) {
      toast({
        variant: "success",
        title: user.active
          ? "\u062a\u0645 \u062a\u0639\u0637\u064a\u0644 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645"
          : "\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645",
      });
      router.refresh();
    } else {
      toast({
        variant: "destructive",
        title: "\u062e\u0637\u0623",
        description: result.error,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {"\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {editingId && (
          <form
            onSubmit={onSubmit}
            className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="full_name">
                {"\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644"}
              </Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">
                {"\u0627\u0644\u062f\u0648\u0631"}
              </Label>
              <select
                id="role"
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value as UserRole,
                    linked_supervisor_id:
                      event.target.value === "supervisor"
                        ? current.linked_supervisor_id
                        : "",
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="admin">{ROLE_LABELS.admin}</option>
                <option value="supervisor">{ROLE_LABELS.supervisor}</option>
                <option value="viewer">{ROLE_LABELS.viewer}</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="team">
                {"\u0627\u0644\u0641\u0631\u064a\u0642"}
              </Label>
              <select
                id="team"
                value={form.linked_team_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    linked_team_id: event.target.value,
                    linked_supervisor_id:
                      selectedSupervisor?.team_id === event.target.value
                        ? current.linked_supervisor_id
                        : "",
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  {"\u2014 \u0628\u062f\u0648\u0646 \u0641\u0631\u064a\u0642 \u2014"}
                </option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.team_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="supervisor">
                {"\u0627\u0644\u0645\u0634\u0631\u0641 \u0627\u0644\u0645\u0631\u062a\u0628\u0637"}
              </Label>
              <select
                id="supervisor"
                value={form.linked_supervisor_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    linked_supervisor_id: event.target.value,
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">
                  {"\u2014 \u0628\u062f\u0648\u0646 \u0631\u0628\u0637 \u2014"}
                </option>
                {availableSupervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.full_name} - {supervisor.team_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {"\u062d\u0641\u0638"}
              </Button>
              <Button type="button" variant="outline" onClick={reset}>
                <X className="h-4 w-4" />
                {"\u0625\u0644\u063a\u0627\u0621"}
              </Button>
            </div>
          </form>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {"\u0627\u0644\u0627\u0633\u0645"}
              </TableHead>
              <TableHead>
                {"\u0627\u0644\u062f\u0648\u0631"}
              </TableHead>
              <TableHead>
                {"\u0627\u0644\u0641\u0631\u064a\u0642"}
              </TableHead>
              <TableHead>
                {"\u0627\u0644\u0645\u0634\u0631\u0641"}
              </TableHead>
              <TableHead>
                {"\u0627\u0644\u062d\u0627\u0644\u0629"}
              </TableHead>
              <TableHead className="text-left">
                {"\u0625\u062c\u0631\u0627\u0621\u0627\u062a"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  {"\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646."}
                </TableCell>
              </TableRow>
            )}

            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.team_name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.supervisor_name}
                </TableCell>
                <TableCell>
                  {user.active ? (
                    <Badge variant="success">
                      {"\u0646\u0634\u0637"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      {"\u0645\u0639\u0637\u0644"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-left">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(user)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={user.active ? "outline" : "secondary"}
                      onClick={() => toggleActive(user)}
                      disabled={busyId === user.id}
                    >
                      {busyId === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                      {user.active
                        ? "\u062a\u0639\u0637\u064a\u0644"
                        : "\u062a\u0641\u0639\u064a\u0644"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
